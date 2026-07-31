const sharp = require('sharp');
const path = require("path");
const fs = require("fs");
const os = require("os");
const cp = require("child_process");

const CAPTCHA_DATA_DIR = process.env.CLARO_DATA_DIR || __dirname;

// Delay humano más realista (base + variación aleatoria)
function delay(ms) {
  const variation = ms * 0.4; // 40% de variación
  const humanDelay = ms + (Math.random() * variation * 2 - variation);
  return new Promise(r => setTimeout(r, Math.max(100, humanDelay)));
}

// Delay largo para simular comportamiento humano (lectura, pensamiento)
function humanDelay(minMs = 2000, maxMs = 5000) {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise(r => setTimeout(r, ms));
}

function getBframe(page) {
  return page.frames().find(f => f.url().includes("bframe"));
}

async function getBframePagePosition(page) {
  const iframes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('iframe')).map(f => {
      const r = f.getBoundingClientRect();
      return { src: (f.src || "").substring(0, 200), x: r.left, y: r.top, w: r.width, h: r.height };
    });
  });
  const bf = iframes.find(f => f.src.includes("bframe"));
  return bf ? { x: bf.x, y: bf.y } : { x: 0, y: 0 };
}

async function getCaptchaTileInfo(page, bframe) {
  try {
    const iframeData = await bframe.evaluate(() => {
      const results = { tiles: [], challengeText: "" };
      const inst = document.querySelector(".rc-imageselect-instructions strong");
      results.challengeText = inst ? inst.textContent.trim() : "";
      const tables = document.querySelectorAll("table.rc-imageselect-table");
      if (tables.length > 0) {
        tables[0].querySelectorAll("td").forEach((td, idx) => {
          const r = td.getBoundingClientRect();
          if (r.width > 20 && r.height > 20) {
            results.tiles.push({
              idx: idx + 1, x: r.left, y: r.top, w: r.width, h: r.height,
              isSelected: td.classList.contains("rc-imageselect-checked"),
            });
          }
        });
      }
      if (results.tiles.length === 0) {
        document.querySelectorAll("img").forEach((img, idx) => {
          const r = img.getBoundingClientRect();
          if (r.width > 30 && r.height > 30) {
            results.tiles.push({
              idx: idx + 1, x: r.left, y: r.top, w: r.width, h: r.height,
              isSelected: false,
            });
          }
        });
      }
      return results;
    });
    const bframePos = await getBframePagePosition(page);
    const tiles = iframeData.tiles.map(t => ({
      ...t,
      pageX: Math.round(t.x + bframePos.x),
      pageY: Math.round(t.y + bframePos.y),
    }));
    return { tiles, gridSize: Math.round(Math.sqrt(tiles.length)) || 3, challengeText: iframeData.challengeText, bframePos };
  } catch (e) {
    console.log("  [CAPTCHA] Error tile info:", e.message);
    return null;
  }
}

async function clickVerify(bframe) {
  try {
    // Mover mouse al botón primero (comportamiento humano)
    await bframe.evaluate(() => {
      const btn = document.querySelector("#recaptcha-verify-button");
      if (btn) {
        // Simular hover primero
        btn.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      }
    });
    await delay(300 + Math.random() * 400); // Pausa humana

    // Click
    await bframe.evaluate(() => {
      document.querySelector("#recaptcha-verify-button")?.click();
    });
    await humanDelay(2000, 4000); // Esperar respuesta
    return true;
  } catch (e) { return false; }
}

// Descarga el audio usando interceptacion de red (response.buffer) con timeout
async function downloadAudioViaNetwork(page, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      page.removeListener('response', handler);
      reject(new Error('timeout'));
    }, timeoutMs);

    const handler = async (response) => {
      try {
        const url = response.url() || '';
        const ct = (response.headers()['content-type'] || '').toLowerCase();
        if (!ct.includes('audio') && !url.includes('audio') && !url.match(/\/recaptcha\/api2\/.*payload/)) return;
        page.removeListener('response', handler);
        clearTimeout(timer);
        const buf = await response.buffer().catch(() => null);
        if (buf && buf.length > 1000) {
          resolve(buf);
        }
      } catch (_) {}
    };
    page.on('response', handler);
  });
}

async function downloadAudioDirect(bframe) {
  const audioUrl = await bframe.evaluate(() => {
    const a = document.querySelector("audio");
    return a ? (a.currentSrc || a.src || "") : "";
  }).catch(() => "");
  if (!audioUrl || audioUrl.startsWith("blob:")) return null;
  try {
    const b64 = await bframe.evaluate((url) => {
      return fetch(url, { credentials: 'include' }).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.arrayBuffer();
      }).then(b => {
        const bytes = new Uint8Array(b);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
      });
    }, audioUrl).catch(() => null);
    if (b64) {
      console.log("  [CAPTCHA-AUDIO] Audio descargado por fetch directo");
      return Buffer.from(b64, "base64");
    }
  } catch (e) {
    console.log("  [CAPTCHA-AUDIO] Fetch directo fallo: " + e.message.substring(0, 50));
  }
  return null;
}

// Obtener clave Groq desde env o sistema
function _getGroqKey() {
  const direct = process.env.GROQ_API_KEY;
  if (direct) return direct;
  try {
    const r1 = cp.execSync(
      "powershell -NoProfile -Command \"[Environment]::GetEnvironmentVariable('GROQ_API_KEY','User')\"",
      { encoding: "utf8", timeout: 5000 }
    ).trim();
    if (r1) return r1;
    const r2 = cp.execSync(
      "powershell -NoProfile -Command \"[Environment]::GetEnvironmentVariable('GROQ_API_KEY','Machine')\"",
      { encoding: "utf8", timeout: 5000 }
    ).trim();
    if (r2) return r2;
  } catch (e) {}
  return "";
}

async function transcribeGroq(audioFilePath) {
  const apiKey = _getGroqKey();
  if (!apiKey) {
    console.log("  [CAPTCHA-AUDIO] Groq SKIP: no API key");
    return null;
  }
  try {
    const buf = fs.readFileSync(audioFilePath);
    const form = new FormData();
    form.append("file", new Blob([buf], { type: "audio/wav" }), "audio.wav");
    form.append("model", "whisper-large-v3");
    form.append("language", "es");
    form.append("response_format", "json");
    const resp = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey },
      body: form,
      signal: AbortSignal.timeout(60000)
    });
    if (resp.ok) {
      const data = await resp.json();
      const text = (data.text || "").trim();
      if (text) {
        console.log("  [CAPTCHA-AUDIO] Groq OK: \"" + text.substring(0, 60) + "\"");
        return text;
      }
    }
    console.log("  [CAPTCHA-AUDIO] Groq fail: HTTP " + resp.status);
  } catch (e) {
    console.log("  [CAPTCHA-AUDIO] Groq error: " + e.message.substring(0, 60));
  }
  return null;
}

// AI refine: si la transcripción no tiene números claros, preguntar al LLM
async function aiRefineNumbers(rawText) {
  if (!rawText) return null;
  const zenKey = (process.env.OPENCODE_ZEN_API_KEY || "").trim();
  if (!zenKey) return null;
  try {
    const resp = await fetch("https://opencode.ai/zen/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + zenKey
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash-free",
        messages: [
          { role: "system", content: "Eres un extractor de números de audios captcha de Google reCAPTCHA. Los captchas dictan una secuencia de números (ej. '5 2 8 3') o una palabra clave. Responde SOLO con los números/dígitos separados por espacio. Si no hay números claros responde 'NADA'." },
          { role: "user", content: "Transcripción del audio captcha: \"" + rawText + "\". Extrae SOLO los números hablados." }
        ],
        max_tokens: 50,
        stream: false
      }),
      signal: AbortSignal.timeout(30000)
    });
    if (resp.ok) {
      const data = await resp.json();
      const content = (data.choices?.[0]?.message?.content || "").trim();
      if (content && content !== "NADA") {
        console.log("  [CAPTCHA-AUDIO] AI refine: \"" + rawText.substring(0, 40) + "\" -> \"" + content + "\"");
        return content;
      }
    }
  } catch (e) {
    console.log("  [CAPTCHA-AUDIO] AI refine error: " + e.message.substring(0, 60));
  }
  return null;
}

async function transcribeAudio(audioFilePath) {
  console.log("  [CAPTCHA-AUDIO] Transcribiendo audio...");

  // Método 1: Groq whisper-large-v3 (cloud, mejor precisión)
  let transcription = await transcribeGroq(audioFilePath);
  let methodUsed = "groq";

  // Método 2: faster-whisper LOCAL (sin API, sin costo)
  if (!transcription || !/[0-9]/.test(transcription)) {
    console.log("  [CAPTCHA-AUDIO] Fallback a whisper local...");
    try {
      const out = cp.execSync(
        `python "${path.join(__dirname, "local_transcribe.py")}" "${audioFilePath}"`,
        { encoding: "utf8", timeout: 180000 }
      );
      for (const line of out.trim().split("\n")) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.numeros && /[0-9]/.test(parsed.numeros)) {
            console.log("  [CAPTCHA-AUDIO] Whisper local números: \"" + parsed.numeros + "\" (método: " + (parsed.metodo || "whisper_local") + ")");
            transcription = parsed.numeros;
            methodUsed = parsed.metodo || "whisper_local";
            break;
          }
          if (parsed.texto && parsed.texto.trim().length > 0) {
            const cleanText = parsed.texto.trim().replace(/[.,!?;:]/g, '').trim();
            if (cleanText.length > 0) {
              console.log("  [CAPTCHA-AUDIO] Whisper local texto: \"" + cleanText + "\" (método: " + (parsed.metodo || "whisper_local") + ")");
              transcription = cleanText;
              methodUsed = parsed.metodo || "whisper_local";
              break;
            }
          }
        } catch (e) {}
      }
    } catch (e) {
      console.log("  [CAPTCHA-AUDIO] Whisper local error: " + e.message.substring(0, 60));
    }
  }

  // Método 3: AI refine con OpenCode Zen (última línea)
  if (transcription && !/[0-9]/.test(transcription)) {
    console.log("  [CAPTCHA-AUDIO] Sin números claros, AI refine...");
    const refined = await aiRefineNumbers(transcription);
    if (refined) {
      transcription = refined;
      methodUsed = "ai_refined";
    }
  }

  if (!transcription) {
    console.log("  [CAPTCHA-AUDIO] Sin transcripción");
    return null;
  }

  console.log("  [CAPTCHA-AUDIO] Transcripción final (\"" + methodUsed + "\"): \"" + transcription.substring(0, 120) + "\"");
  return transcription;
}

async function solveAudioChallenge(page, bframe) {
  console.log("  [CAPTCHA-AUDIO] Cambiando a modo audio...");

  // Recargar challenge primero para tener estado limpio
  try {
    await bframe.evaluate(() => document.querySelector("#recaptcha-reload-button")?.click());
    await humanDelay(3000, 5000);
  } catch (e) {}

  bframe = getBframe(page);
  if (!bframe) return false;

  // Click boton de audio
  try {
    const clicked = await bframe.evaluate(() => {
      const btn = document.querySelector("#recaptcha-audio-button, .rc-audiochallenge-tab, button[aria-label*='audio'], button[aria-label*='Audio']");
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (!clicked) { console.log("  [CAPTCHA-AUDIO] No se encontro boton de audio"); return false; }
    await delay(5000);
  } catch (e) {
    console.log("  [CAPTCHA-AUDIO] Error boton audio: " + e.message.substring(0, 60));
    return false;
  }

  bframe = getBframe(page);
  if (!bframe) { console.log("  [CAPTCHA-AUDIO] bframe perdido al cambiar a audio"); return false; }

  // Debug: ver qué hay en el bframe
  const bframeContent = await bframe.evaluate(() => {
    return {
      url: window.location.href.substring(0, 100),
      hasAudio: !!document.querySelector("audio"),
      hasPlayBtn: !!document.querySelector(".rc-audiochallenge-play-button"),
      hasInput: !!document.querySelector("#audio-response, .rc-audiochallenge-response-input, input[type='text']"),
      bodyText: document.body.innerText.substring(0, 200),
    };
  }).catch(e => ({error: e.message}));
  console.log("  [CAPTCHA-AUDIO] bframe state:", JSON.stringify(bframeContent));

  // Detectar rate limit de Google
  const bodyText = bframeContent.bodyText || "";
  if (bodyText.includes("Try again later") || bodyText.includes("automated queries")) {
    console.log("  [CAPTCHA-AUDIO] ⚠ RATE LIMIT detectado! Esperando 30 segundos y reintentando...");
    await delay(30000);
    return false;
  }

  // Esperar a que exista elemento <audio> (más tiempo)
  let hasAudio = false;
  for (let i = 0; i < 20; i++) {
    hasAudio = await bframe.evaluate(() => !!document.querySelector("audio")).catch(() => false);
    if (hasAudio) break;
    // Si hay input de audio pero no hay <audio>, el challenge ya está en modo audio
    const hasInput = await bframe.evaluate(() => !!document.querySelector("#audio-response, .rc-audiochallenge-response-input")).catch(() => false);
    if (hasInput) {
      console.log("  [CAPTCHA-AUDIO] Input de audio encontrado, intentando extraer URL...");
      break;
    }
    await delay(1000);
  }
  if (!hasAudio) {
    // Intentar extraer URL del audio de otra forma
    const audioUrl = await bframe.evaluate(() => {
      const a = document.querySelector("audio");
      return a ? (a.currentSrc || a.src || "") : "";
    }).catch(() => "");
    console.log("  [CAPTCHA-AUDIO] Audio URL directa:", audioUrl.substring(0, 80));
    if (!audioUrl) { console.log("  [CAPTCHA-AUDIO] No se cargo el elemento audio"); return false; }
  }

  // Click play
  console.log("  [CAPTCHA-AUDIO] Click Play...");
  try {
    await bframe.evaluate(() => {
      const playBtn = document.querySelector(".rc-audiochallenge-play-button, button[aria-label*='play'], button[aria-label*='Play'], .rc-audiochallenge-control, button.rc-audiochallenge-play-button");
      if (playBtn) { playBtn.click(); return true; }
      const audio = document.querySelector("audio");
      if (audio) { audio.play(); return true; }
      return false;
    });
    await delay(3000);
  } catch (e) {
    console.log("  [CAPTCHA-AUDIO] Error click play: " + e.message.substring(0, 60));
  }

  // Debug: mostrar URL del audio
  const audioSrc = await bframe.evaluate(() => {
    const a = document.querySelector("audio");
    return a ? { src: a.currentSrc || a.src || "", duration: a.duration, readyState: a.readyState } : null;
  }).catch(() => null);
  console.log("  [CAPTCHA-AUDIO] Audio source:", JSON.stringify(audioSrc));

  // MÉTODO 1: fetch directo desde el bframe (más confiable)
  let audioBuffer = await downloadAudioDirect(bframe);

  // MÉTODO 2: intercepción de red (fallback)
  if (!audioBuffer) {
    console.log("  [CAPTCHA-AUDIO] Intentando intercepción de red...");
    const networkPromise = downloadAudioViaNetwork(page, 15000);
    await delay(2000);
    try {
      audioBuffer = await networkPromise;
      if (audioBuffer) console.log("  [CAPTCHA-AUDIO] Audio capturado por red (" + audioBuffer.length + " bytes)");
    } catch (e) {
      console.log("  [CAPTCHA-AUDIO] Network interception fallo: " + e.message.substring(0, 50));
    }
  }

  // MÉTODO 3: blob URL con AudioContext (último recurso)
  if (!audioBuffer) {
    const audioUrl2 = await bframe.evaluate(() => {
      const a = document.querySelector("audio");
      return a ? (a.currentSrc || a.src || "") : "";
    }).catch(() => "");
    if (audioUrl2 && audioUrl2.startsWith("blob:")) {
      console.log("  [CAPTCHA-AUDIO] Audio blob, extrayendo con AudioContext...");
      const b64 = await bframe.evaluate(() => {
        return new Promise((resolve) => {
          const audio = document.querySelector("audio");
          if (!audio) return resolve(null);
          try {
            const ac = new (window.AudioContext || window.webkitAudioContext)();
            const src = ac.createMediaElementSource(audio);
            const dest = ac.createMediaStreamDestination();
            src.connect(dest);
            const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
            const chunks = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = () => {
              const blob = new Blob(chunks, { type: 'audio/webm' });
              blob.arrayBuffer().then(buf => {
                const bytes = new Uint8Array(buf);
                let binary = "";
                for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
                resolve(btoa(binary));
              });
            };
            recorder.start();
            audio.currentTime = 0;
            audio.play().catch(() => {});
            setTimeout(() => { recorder.stop(); ac.close(); }, 10000);
          } catch(e) { resolve(null); }
        });
      }).catch(() => null);
      if (b64) {
        audioBuffer = Buffer.from(b64, "base64");
        console.log("  [CAPTCHA-AUDIO] Audio extraido por MediaRecorder (" + audioBuffer.length + " bytes)");
      }
    }
  }

  if (!audioBuffer || audioBuffer.length < 1000) {
    console.log("  [CAPTCHA-AUDIO] No se pudo obtener el audio");
    return false;
  }

  // Guardar audio
  const audioFile = path.join(CAPTCHA_DATA_DIR, "_captcha_" + Date.now() + ".mp3");
  fs.writeFileSync(audioFile, audioBuffer);
  console.log("  [CAPTCHA-AUDIO] Audio guardado (" + audioBuffer.length + " bytes) en " + path.basename(audioFile));

  // Transcribir
  const transcription = await transcribeAudio(audioFile);

  if (!transcription) {
    console.log("  [CAPTCHA-AUDIO] Transcripcion vacia");
    // GUARDAR ANTES DE BORRAR (bug: antes se borraba el archivo y la copia fallaba)
    const failedDir = path.join(CAPTCHA_DATA_DIR, "failed_captchas");
    if (!fs.existsSync(failedDir)) fs.mkdirSync(failedDir, { recursive: true });
    const failedFile = path.join(failedDir, "captcha_" + Date.now() + ".mp3");
    try { fs.copyFileSync(audioFile, failedFile); } catch (e) {
      console.log("  [CAPTCHA-AUDIO] No se pudo guardar audio fallido: " + e.message.substring(0, 60));
    }
    console.log("  [CAPTCHA-AUDIO] Audio guardado para operator: " + failedFile);
  }
  try { fs.unlinkSync(audioFile); } catch (e) {}
  try {
    const wavFile = audioFile + ".wav";
    if (fs.existsSync(wavFile)) fs.unlinkSync(wavFile);
  } catch (e) {}
  if (!transcription) return false;
  console.log("  [CAPTCHA-AUDIO] Transcripcion: \"" + transcription.substring(0, 120) + "\"");

  bframe = getBframe(page);
  if (!bframe) { console.log("  [CAPTCHA-AUDIO] bframe perdido al escribir respuesta"); return false; }

  // Esperar un momento antes de escribir (como si estuviera leyendo)
  await humanDelay(1500, 3000);

  // Escribir respuesta carácter por carácter (comportamiento humano)
  const inputSelector = "#audio-response, .rc-audiochallenge-response-input, input[type='text'";
  for (let i = 0; i < transcription.length; i++) {
    const char = transcription[i];
    await bframe.evaluate((sel, c) => {
      const inp = document.querySelector(sel);
      if (inp) {
        inp.value = (inp.value || '') + c;
        inp.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, inputSelector, char);
    // Delay humano entre caracteres (50-150ms)
    await delay(80 + Math.random() * 70);
  }
  await humanDelay(800, 1500); // Pausa antes de verificar

  // Click Verify con delay humano
  await clickVerify(bframe);
  await humanDelay(3000, 6000); // Esperar resultado

  if (!getBframe(page)) {
    console.log("  [CAPTCHA-AUDIO] Captcha superado!");
    return true;
  }
  console.log("  [CAPTCHA-AUDIO] Fallo, reintentando...");
  return false;
}

// ===================================================================
// NUEVO: Resolver captcha visual con Gemma4 via Ollama
// ===================================================================
async function solveVisualWithGemma4(page, bframe) {
  console.log("  [CAPTCHA-VISION-GEMMA] Iniciando vision con Gemma4...");

  const tileInfo = await getCaptchaTileInfo(page, bframe);
  if (!tileInfo || !tileInfo.tiles || tileInfo.tiles.length < 4) {
    console.log("  [CAPTCHA-VISION-GEMMA] No hay grid de imagenes (solo " + (tileInfo?.tiles?.length || 0) + " tiles)");
    return false;
  }

  const challenge = tileInfo.challengeText || "unknown";
  const tiles = tileInfo.tiles;
  const gridSize = tileInfo.gridSize || 3;
  console.log("  [CAPTCHA-VISION-GEMMA] Desafio: \"" + challenge + "\" (" + (tiles.length) + " tiles, grid " + gridSize + "x" + gridSize + ")");

  // Tomar screenshot del area del grid
  const minX = Math.min(...tiles.map(t => t.pageX));
  const maxX = Math.max(...tiles.map(t => t.pageX + t.w));
  const minY = Math.min(...tiles.map(t => t.pageY));
  const maxY = Math.max(...tiles.map(t => t.pageY + t.h));

  const clip = {
    x: Math.max(0, minX - 15),
    y: Math.max(0, minY - 80),
    width: Math.min(maxX - minX + 30, 1920),
    height: Math.min(maxY - minY + 120, 1080)
  };

  let screenshotBase64 = await page.screenshot({ clip, encoding: 'base64' }).catch(() => null);
  if (!screenshotBase64) {
    console.log("  [CAPTCHA-VISION-GEMMA] No se pudo tomar screenshot");
    return false;
  }

  // Llamar a Ollama con gemma4:31b-cloud via /api/chat (formato multimodal)
  const OLLAMA_ENDPOINT = "http://localhost:11434/api/chat";
  const MODEL = "minicpm-v:latest";

  const prompt = `You are a reCAPTCHA solver. This is a ${gridSize}x${gridSize} grid of images. The challenge asks to select images containing: "${challenge}".

Look at each tile carefully (numbered 1 to ${tiles.length}, left-to-right, top-to-bottom). Which tiles contain the requested object?

Reply ONLY with the tile numbers separated by spaces, like: "2 5 7"
Do NOT include any other text or explanation.`;

  console.log("  [CAPTCHA-VISION-GEMMA] Enviando a Ollama (" + MODEL + ")...");

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(OLLAMA_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "user",
              content: prompt,
              images: [screenshotBase64]
            }
          ],
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 50
          }
        }),
        signal: AbortSignal.timeout(120000)
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        console.log("  [CAPTCHA-VISION-GEMMA] HTTP " + resp.status + ": " + errText.substring(0, 100));
        await humanDelay(3000, 5000);
        continue;
      }

      const data = await resp.json();
      const response = (data?.message?.content || data.response || "").trim();
      console.log("  [CAPTCHA-VISION-GEMMA] Respuesta: \"" + response.substring(0, 100) + "\"");

      if (!response) {
        console.log("  [CAPTCHA-VISION-GEMMA] Respuesta vacia");
        await humanDelay(3000, 5000);
        continue;
      }

      // Extraer numeros
      const numbers = response.match(/\d+/g);
      if (!numbers || numbers.length === 0) {
        console.log("  [CAPTCHA-VISION-GEMMA] No se encontraron numeros en la respuesta");
        await humanDelay(3000, 5000);
        continue;
      }

      const tileIndices = [...new Set(numbers.map(n => parseInt(n, 10)))].filter(n => n >= 1 && n <= tiles.length);
      console.log("  [CAPTCHA-VISION-GEMMA] Click tiles: " + JSON.stringify(tileIndices));

      // Click en los tiles
      for (const idx of tileIndices) {
        const tile = tiles[idx - 1];
        try {
          await page.mouse.move(tile.pageX + tile.w / 2, tile.pageY + tile.h / 2, { steps: 5 });
          await delay(100 + Math.random() * 100);
          await page.mouse.click(tile.pageX + tile.w / 2, tile.pageY + tile.h / 2);
          await delay(300 + Math.random() * 200);
        } catch (e) {
          console.log("  [CAPTCHA-VISION-GEMMA] Error click tile " + idx + ": " + e.message.substring(0, 40));
        }
      }

      await delay(1000);

      // Click Verify
      const bf = getBframe(page);
      if (!bf) return true;
      await clickVerify(bf);
      await delay(5000);

      if (!getBframe(page)) {
        console.log("  [CAPTCHA-VISION-GEMMA] Captcha superado!");
        return true;
      }

      console.log("  [CAPTCHA-VISION-GEMMA] Verify no fue suficiente, reintentando ronda " + (attempt + 2) + "...");
      try {
        // Refresh the challenge
        const bf2 = getBframe(page);
        if (bf2) {
          await bf2.evaluate(() => document.querySelector("#recaptcha-reload-button, .rc-reload-button")?.click());
          await humanDelay(3000, 5000);
        }
        // Take FRESH screenshot after refresh
        const newBfBox = await (bf2 || page).evaluate(() => {
          const body = document.body;
          const r = body.getBoundingClientRect();
          return {
            x: r.left, y: r.top,
            width: Math.max(r.width, document.documentElement.scrollWidth),
            height: Math.max(r.height, document.documentElement.scrollHeight)
          };
        }).catch(() => null);
        if (newBfBox) {
          const newBfPos = await getBframePagePosition(page);
          const newClip = {
            x: Math.max(0, newBfBox.x + newBfPos.x - 5),
            y: Math.max(0, newBfBox.y + newBfPos.y - 5),
            width: Math.min(newBfBox.width + 10, 1920),
            height: Math.min(newBfBox.height + 10, 1080)
          };
          const newShot = await page.screenshot({ clip: newClip, encoding: 'base64' }).catch(() => null);
          if (newShot) {
            screenshotBase64 = newShot;
            console.log("  [CAPTCHA-VISION-GEMMA] Nuevo screenshot tomado tras refresh");
          }
        }
      } catch (e) {}
    } catch (e) {
      console.log("  [CAPTCHA-VISION-GEMMA] Error: " + e.message.substring(0, 80));
      await humanDelay(3000, 5000);
    }
  }

  console.log("  [CAPTCHA-VISION-GEMMA] Fallaron los intentos de vision");
  return false;
}
// ===================================================================
// FIN: nueva funcion
// ===================================================================

async function solveVisualWithAI(page, bframe, tileInfo) {
  if (!tileInfo || !tileInfo.tiles || tileInfo.tiles.length === 0) return false;

  const challenge = tileInfo.challengeText || "";
  console.log("  [CAPTCHA-VISION] Desafio: \"" + challenge.substring(0, 80) + "\"");

  const tiles = tileInfo.tiles;
  const minX = Math.min(...tiles.map(t => t.pageX));
  const maxX = Math.max(...tiles.map(t => t.pageX + t.w));
  const minY = Math.min(...tiles.map(t => t.pageY));
  const maxY = Math.max(...tiles.map(t => t.pageY + t.h));
  const clip = {
    x: Math.max(0, minX - 10),
    y: Math.max(0, minY - 60),
    width: maxX - minX + 20,
    height: maxY - minY + 100
  };

  const screenshot = await page.screenshot({ clip, encoding: 'base64' }).catch(() => null);
  if (!screenshot) { console.log("  [CAPTCHA-VISION] No screenshot"); return false; }

  console.log("  [CAPTCHA-VISION] Enviando a OpenCode Zen...");
  const gridSize = tileInfo.gridSize || 3;

  const { callOpenCodeZen } = require('./ai_supervisor.js');

  for (let vRound = 0; vRound < 3; vRound++) {
    try {
      const bf = getBframe(page);
      if (!bf) return true;
      const currentTiles = await getCaptchaTileInfo(page, bf);
      if (!currentTiles || currentTiles.tiles.length === 0) break;
      const ct = currentTiles.tiles;
      const cMinX = Math.min(...ct.map(t => t.pageX));
      const cMaxX = Math.max(...ct.map(t => t.pageX + t.w));
      const cMinY = Math.min(...ct.map(t => t.pageY));
      const cMaxY = Math.max(...ct.map(t => t.pageY + t.h));
      const newScreenshot = await page.screenshot({ clip: {
        x: Math.max(0, cMinX - 10), y: Math.max(0, cMinY - 60),
        width: cMaxX - cMinX + 20, height: cMaxY - cMinY + 100
      }, encoding: 'base64' }).catch(() => null);
      if (!newScreenshot) break;

      const prompt = vRound === 0
        ? `You are an image analysis assistant. This is a ${gridSize}x${gridSize} grid of small photos. Each photo is numbered 1 to ${ct.length}. Describe what object is SHOWN in each photo. Reply with a JSON array like [{"tile":1,"shows":"object"},{"tile":2,"shows":"object"}]. Target to find: "${challenge}". Be concise. One word per object.`
        : `Which tile numbers show "${challenge}"? Reply with ONLY the tile numbers separated by spaces. Numbers only.`;

      const systemMsg = "Eres un asistente de analisis de imagenes. Responde solo con el formato solicitado.";

      const aiText = await callOpenCodeZen(prompt, systemMsg, newScreenshot);
      if (!aiText) { console.log("  [CAPTCHA-VISION] Sin respuesta de IA"); continue; }

      console.log("  [CAPTCHA-VISION] R" + (vRound+1) + ": \"" + aiText.substring(0, 120) + "\"");

      let tileIndices = [];

      if (vRound === 0) {
        try {
          const jsonMatch = aiText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const arr = JSON.parse(jsonMatch[0]);
            const challengeLower = challenge.toLowerCase().trim();
            const challengeWords = challengeLower.split(/\s+/).filter(w => w.length > 2);
            for (const item of arr) {
              const shows = (item.shows || "").toLowerCase().trim();
              const showWords = shows.split(/\s+/).filter(w => w.length > 2);
              // Match if any word overlaps, or if one contains the other
              const wordMatch = challengeWords.some(cw => showWords.some(sw =>
                cw === sw || cw.includes(sw) || sw.includes(cw)
              ));
              const directMatch = shows.includes(challengeLower) || challengeLower.includes(shows);
              if (wordMatch || directMatch) {
                tileIndices.push(item.tile);
              }
            }
          }
        } catch (e) {}
      } else {
        const nums = aiText.match(/\d+/g);
        if (nums) tileIndices = nums.map(n => parseInt(n, 10));
      }

      tileIndices = [...new Set(tileIndices)].filter(n => n >= 1 && n <= currentTiles.tiles.length);
      if (tileIndices.length === 0) {
        console.log("  [CAPTCHA-VISION] Sin matches, refresh...");
        try { await bf.evaluate(() => document.querySelector("#recaptcha-reload-button")?.click()); await humanDelay(3000, 5000); } catch(e) {}
        continue;
      }

      console.log("  [CAPTCHA-VISION] Click: " + JSON.stringify(tileIndices));
      for (const idx of tileIndices) {
        const t = currentTiles.tiles[idx - 1];
        if (!t) continue;
        await page.mouse.move(t.pageX + t.w / 2, t.pageY + t.h / 2, { steps: 5 });
        await delay(150);
        await page.mouse.click(t.pageX + t.w / 2, t.pageY + t.h / 2);
        await delay(300);
      }

      await delay(1000);
      const bfAfter = getBframe(page);
      if (bfAfter) {
        await clickVerify(bfAfter);
        await delay(5000);
        if (!getBframe(page)) {
          console.log("  [CAPTCHA-VISION] Resuelto!");
          return true;
        }
      }
    } catch (e) {
      console.log("  [CAPTCHA-VISION] Error: " + e.message.substring(0, 60));
    }
  }
  return false;
}

async function solveVisualChallenge(page, bframe, tileInfo) {
  // Intentar primero con AI vision
  if (tileInfo && tileInfo.tiles && tileInfo.tiles.length > 0) {
    const aiResult = await solveVisualWithAI(page, bframe, tileInfo);
    if (aiResult) return true;
  }

  console.log("  [CAPTCHA] Intentando visual solve (click aleatorio)...");
  try {
    const tiles = tileInfo && tileInfo.tiles;
    if (!tiles || tiles.length === 0) {
      console.log("  [CAPTCHA-VISUAL] Sin tiles");
      return false;
    }
    const toClick = tiles.filter((t, i) => i % 2 === 0);
    console.log("  [CAPTCHA-VISUAL] Click " + toClick.length + "/" + tiles.length + " tiles");
    for (const t of toClick) {
      await page.mouse.move(t.pageX + t.w / 2, t.pageY + t.h / 2, { steps: 5 });
      await delay(100);
      await page.mouse.click(t.pageX + t.w / 2, t.pageY + t.h / 2);
      await delay(300);
    }
    await delay(1000);
    const bf = getBframe(page);
    if (bf) {
      await clickVerify(bf);
      await humanDelay(4000, 7000);
      return !getBframe(page);
    }
  } catch (e) {
    console.log("  [CAPTCHA-VISUAL] Error: " + e.message.substring(0, 60));
  }
  return false;
}

async function isCaptchaChecked(page) {
  const frames = page.frames();
  for (const f of frames) {
    if (f.url().includes("recaptcha/api") && !f.url().includes("bframe")) {
      try {
        const checked = await f.evaluate(() => {
          const a = document.querySelector("#recaptcha-anchor");
          return a && a.getAttribute("aria-checked") === "true";
        }).catch(() => false);
        return checked;
      } catch (e) { return false; }
    }
  }
  return false;
}

async function tryDirectSubmit(page) {
  console.log("  [CAPTCHA] Intentando envio directo...");
  try {
    const result = await page.evaluate(async () => {
      const form = document.querySelector('form');
      if (!form) return { ok: false, error: 'no form' };
      const fd = new FormData(form);
      const entries = [];
      for (const [k, v] of fd.entries()) {
        if (k !== 'g-recaptcha-response') entries.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
      }
      const body = entries.join('&');
      const resp = await fetch(form.action, { method: 'POST', body, redirect: 'manual' });
      return { status: resp.status, redirected: resp.headers.get('location') || '', textStart: (await resp.text()).substring(0, 300) };
    });
    console.log("  [CAPTCHA] Direct submit status:", result?.status);
    if (result?.redirected || (result?.textStart && (result.textStart.includes('registrada') || result.textStart.includes('Respuesta')))) {
      console.log("  [CAPTCHA] Envio directo exitoso!");
      return true;
    }
    console.log("  [CAPTCHA] Direct submit fallo:", result?.textStart?.substring(0, 100) || "sin respuesta");
  } catch (e) {
    console.log("  [CAPTCHA] Error direct submit:", e.message.substring(0, 60));
  }
  return false;
}

async function waitForManualCaptcha(page, timeoutMs = 300000) {
  console.log("\n  ╔═══════════════════════════════════════════╗");
  console.log("  ║     CAPTCHA REQUIERE INTERVENCION MANUAL    ║");
  console.log("  ╠═══════════════════════════════════════════╣");
  console.log("  ║ Resuelve el captcha EN LA VENTANA DEL      ║");
  console.log("  ║ navegador que se abrio.                    ║");
  console.log("  ║ 1. Marca el checkbox \"No soy un robot\"      ║");
  console.log("  ║ 2. Si aparece desafio, resuelvelo.         ║");
  console.log("  ║ 3. Luego haz click en ENVIAR de nuevo.     ║");
  console.log("  ║                                           ║");
  console.log("  ║ El script continuara automaticamente       ║");
  console.log("  ║ cuando detecte el captcha resuelto.        ║");
  console.log("  ║ Espera maximo: " + (timeoutMs / 60000).toFixed(0) + " min                  ║");
  console.log("  ╚═══════════════════════════════════════════╝\n");

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await humanDelay(3000, 5000);

    // Check if captcha is checked
    const checked = await isCaptchaChecked(page).catch(() => false);
    if (checked) {
      console.log("  [CAPTCHA] ✓ Resuelto manualmente!");
      return true;
    }

    // Check if form already submitted (user clicked Enviar after solving)
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => "");
    if (bodyText.includes("registrada") || bodyText.includes("Respuesta enviada") || bodyText.includes("hemos registrado") || bodyText.includes("Muchas gracias") || bodyText.includes("Enviar otra respuesta")) {
      console.log("  [CAPTCHA] Formulario ya enviado manualmente!");
      return true;
    }

    // Check if no captcha frames exist anymore (page changed, form submitted)
    const hasRecaptcha = await page.evaluate(() => !!document.querySelector('iframe[title*="recaptcha"]')).catch(() => false);
    if (!hasRecaptcha && !getBframe(page)) {
      // No recaptcha at all - might have been submitted
      if (bodyText.includes("gracias") || bodyText.includes("respuesta") || bodyText.length < 200) {
        console.log("  [CAPTCHA] Captcha ya no visible, posiblemente enviado!");
        return true;
      }
    }

    await delay(2000);
  }
  console.log("  [CAPTCHA] ✗ Timeout de resolucion manual");
  return false;
}

async function solveCaptchaMultiRound(page, maxRounds = 2) {
  console.log("\n  [CAPTCHA] Iniciando...");
  await humanDelay(2000, 4000);

  // Click checkbox con movimientos de mouse
  const frames = page.frames();
  for (const f of frames) {
    if (f.url().includes("recaptcha/api") && !f.url().includes("bframe")) {
      try {
        const checked = await f.evaluate(() => {
          const a = document.querySelector("#recaptcha-anchor");
          return a && a.getAttribute("aria-checked") === "true";
        }).catch(() => false);
        if (!checked) {
          console.log("  [CAPTCHA] Click checkbox (movimiento humano)...");
          const box = await f.$("#recaptcha-anchor");
          if (box) {
            const r = await box.boundingBox();
            if (r) {
              const startX = r.x + r.width / 2 + (Math.random() * 80 - 40);
              const startY = r.y + r.height / 2 + (Math.random() * 50 - 25);
              await page.mouse.move(startX, startY, { steps: 5 });
              await delay(200 + Math.random() * 300);
              await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2, { steps: 8 + Math.floor(Math.random() * 5) });
              await delay(300 + Math.random() * 400);
              await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
              await humanDelay(3000, 5000);
            }
          }
        }
      } catch (e) {}
      break;
    }
  }

  if (!getBframe(page)) {
    const checked = await isCaptchaChecked(page);
    if (checked) { console.log("  [CAPTCHA] Superado (checkbox checked)"); return true; }
    console.log("  [CAPTCHA] Sin challenge pero checkbox no marcado, esperando...");
    await humanDelay(3000, 5000);
    if (!getBframe(page)) { console.log("  [CAPTCHA] Superado (sin challenge)"); return true; }
  }

  let rateLimited = false;

  for (let round = 0; round < maxRounds; round++) {
    const bf = getBframe(page);
    if (!bf) {
      const checked = await isCaptchaChecked(page);
      if (checked) { console.log("  [CAPTCHA] Superado en ronda " + (round + 1)); return true; }
      await humanDelay(3000, 5000);
      if (!getBframe(page)) { break; }
    }

    console.log("  [CAPTCHA] Ronda " + (round + 1) + "/" + maxRounds);

    // PRIMERO: audio con whisper local
    console.log("  [CAPTCHA] Intentando audio con whisper local...");
    const audioOk = await solveAudioChallenge(page, bf);

    // Detectar rate limit global por el texto del bframe
    if (!audioOk) {
      const bfAfter = getBframe(page);
      if (bfAfter) {
        const rateText = await bfAfter.evaluate(() => document.body.innerText.substring(0, 300)).catch(() => "");
        if (rateText.includes("Try again later") || rateText.includes("automated queries")) {
          console.log("  [CAPTCHA] ⚠ RATE LIMIT CONFIRMADO - Abortando intentos");
          rateLimited = true;
          break;
        }
      }
    }

    await humanDelay(4000, 7000);

    if (!getBframe(page)) {
      const checked = await isCaptchaChecked(page);
      if (checked) {
        console.log("  [CAPTCHA] Superado con audio!");
        return true;
      }
    }

    if (rateLimited) break;

    // Refrescar con backoff exponencial entre rondas
    if (round < maxRounds - 1) {
      const waitTime = 3000 + (round * 5000);
      console.log("  [CAPTCHA] Esperando " + (waitTime/1000).toFixed(0) + "s antes de reintentar...");
      await delay(waitTime);
      try {
        const cbf = getBframe(page);
        if (cbf) {
          await cbf.evaluate(() => document.querySelector("#recaptcha-reload-button, .rc-reload-button")?.click());
          await humanDelay(4000, 6000);
        }
      } catch (e) {}
    }
  }

  if (rateLimited) {
    console.log("  [CAPTCHA] ⚠ Google bloqueó temporalmente por rate limiting.");
    console.log("  [CAPTCHA] Espera 30-60 minutos antes de reintentar.");
  }

  console.log("  [CAPTCHA] Intentando envio directo como ultimo recurso...");
  if (await tryDirectSubmit(page)) return true;

  // Si en entorno interactivo (no headless), pedir ayuda manual
  if (!process.env.CLARO_HEADLESS) {
    console.log("  [CAPTCHA] Fallaron los intentos automaticos en modo visible");
    console.log("  [CAPTCHA] Resuelve el captcha manualmente en la ventana del navegador");
    return await waitForManualCaptcha(page, 300000);
  }

  console.log("  [CAPTCHA] Fallaron todos los intentos en modo headless");
  console.log("  [CAPTCHA] Guardando audio de captcha para inspeccion...");
  return false;
}

module.exports = { solveCaptchaMultiRound };
