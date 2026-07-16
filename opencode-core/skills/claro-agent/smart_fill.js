const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const DIR = __dirname;
const FFMPEG = require("ffmpeg-static");
const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfd9f3bIBYdrMps4YlASFWr2Zsg81eiIsXF8wtq2bZ_xaSsYA/viewform";

const ORDER = { cuenta: "2133956", ot: "7735847", ciudad: "Yumbo", nodo: "OCDGCF", tipo: "MANTENIMIENTO FTTH", aplicaMaterial: "No" };
const FIXED = {
  correo: "daveymena16@gmail.com", ciudad: "Cali",
  cedulaTecnico: "1077449318", nombreTecnico: "Duvier Davey Mena Mosquera",
  telefono: "3136174267", tipoTrabajo: "MANTENIMIENTOS FTTH",
  cedulaAuxiliar: "0", nombreAuxiliar: "X",
};

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(msg) { console.log("[" + new Date().toLocaleTimeString() + "] " + msg); }

// ===== Puppeteer interaction helpers =====

async function fillText(page, idx, val) {
  for (let n = 0; n < 6; n++) {
    const el = await page.evaluateHandle((i) => document.querySelectorAll('[role="listitem"]')[i]?.querySelector('input.whsOnd, input[type="text"], input[type="email"], input[type="number"]'), idx);
    if (!el?.asElement()) { await delay(300); continue; }
    try {
      await el.asElement().click(); await delay(100);
      await page.keyboard.down("Control"); await page.keyboard.press("a"); await page.keyboard.up("Control");
      await page.keyboard.press("Backspace"); await delay(100);
      await page.keyboard.type(String(val), { delay: 15 }); await delay(200);
      const cur = await page.evaluate((i) => document.querySelectorAll('[role="listitem"]')[i]?.querySelector("input.whsOnd")?.value || "", idx);
      if (String(cur) === String(val)) return true;
    } catch(e) {}
    await delay(300);
  }
  return false;
}

async function selectDropdown2(page, idx, label) {
  for (let n = 0; n < 6; n++) {
    const lb = await page.evaluateHandle((i) => document.querySelectorAll('[role="listitem"]')[i]?.querySelector('[role="listbox"]'), idx);
    if (!lb?.asElement()) { await delay(300); continue; }
    try {
      await lb.asElement().scrollIntoView({ block: "center" }); await delay(200);
      await lb.asElement().click(); await delay(1500);
      const ok = await page.evaluate((lbl) => {
        for (const o of document.querySelectorAll('[role="option"]')) {
          if (o.textContent.trim().toLowerCase() === lbl.toLowerCase()) { o.scrollIntoView({ block: "center" }); o.click(); return true; }
        }
        return false;
      }, label);
      if (ok) return true;
    } catch(e) {}
    await delay(400);
  }
  return false;
}

async function selectRadio2(page, idx, val) {
  for (let n = 0; n < 5; n++) {
    const r = await page.evaluateHandle(([i, v]) => {
      for (const r2 of document.querySelectorAll('[role="listitem"]')[i]?.querySelectorAll('[role="radio"]') || []) {
        if (r2.getAttribute("data-value") === v || r2.textContent.trim().toLowerCase() === v.toLowerCase()) return r2;
      }
      return null;
    }, [idx, val]);
    if (!r?.asElement()) { await delay(300); continue; }
    try {
      await r.asElement().scrollIntoView({ block: "center" }); await delay(200);
      await r.asElement().click(); await delay(500);
      return true;
    } catch(e) {}
    await delay(300);
  }
  return false;
}

function matchField(title) {
  const ft = title.toLowerCase();
  if (ft.includes("correo") || ft.includes("email") || ft.includes("gmail")) return { type: "text", value: FIXED.correo };
  if (ft.includes("ciudad")) return { type: "dropdown", value: FIXED.ciudad };
  if (ft.includes("cuenta")) return { type: "text", value: String(ORDER.cuenta) };
  if (ft.includes("nodo")) return { type: "text", value: String(ORDER.nodo) };
  if (ft.includes("orden") || ft.includes("ot")) return { type: "text", value: String(ORDER.ot) };
  if (ft.includes("tipo de trabajo") || ft.includes("tipo trabajo")) return { type: "dropdown", value: FIXED.tipoTrabajo };
  if (ft.includes("cedula") && (ft.includes("tec") || ft.includes("tecnico"))) return { type: "text", value: FIXED.cedulaTecnico };
  if (ft.includes("nombre") && (ft.includes("tec") || ft.includes("tecnico"))) return { type: "text", value: FIXED.nombreTecnico };
  if (ft.includes("cedula") && (ft.includes("aux") || ft.includes("auxiliar"))) return { type: "text", value: FIXED.cedulaAuxiliar };
  if (ft.includes("nombre") && (ft.includes("aux") || ft.includes("auxiliar"))) return { type: "text", value: FIXED.nombreAuxiliar };
  if (ft.includes("aplica material")) return { type: "radio", value: ORDER.aplicaMaterial || "Si" };
  if ((ft.includes("telefono") || ft.includes("teléfono") || ft.includes("contacto") || ft.includes("celular")) && !isMaterialField(ft)) return { type: "text", value: FIXED.telefono };
  if (ft.includes("serial") || ft.includes("mac")) return { type: "text", value: ORDER.serial_ont || ORDER.serial_deco || "" };
  return null;
}

function isMaterialField(ft) {
  return ft.includes("conector") || ft.includes("rj") || ft.includes("material") || ft.includes("cable") || ft.includes("telefonico") || ft.includes("telefónico");
}

async function getFields(page) {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="listitem"]')).map((item, idx) => {
      const h = item.querySelector('[role="heading"]');
      const title = h ? h.innerText.trim().replace(/[*.]/g, "").trim() : "";
      const inp = item.querySelector('input.whsOnd, input[type="text"], input[type="email"], input[type="number"]');
      return { idx, title, hasInput: !!inp, hasSelect: !!item.querySelector('[role="listbox"]'), radios: Array.from(item.querySelectorAll('[role="radio"]')).map(r => r.getAttribute("data-value")), value: inp ? inp.value : "" };
    });
  });
}

async function fillAllFields(page) {
  const fields = await getFields(page);
  let filled = 0, total = 0;
  for (const f of fields) {
    const m = matchField(f.title);
    if (!m) continue;
    total++;
    let ok = false;
    if (m.type === "text") { if (f.value !== m.value) ok = await fillText(page, f.idx, m.value); else ok = true; }
    else if (m.type === "dropdown") ok = await selectDropdown2(page, f.idx, m.value);
    else if (m.type === "radio") ok = await selectRadio2(page, f.idx, m.value);
    if (ok) filled++;
  }
  log("Llenados " + filled + "/" + total + " campos");
  return filled === total;
}

async function clickButton(page, text) {
  for (let i = 0; i < 10; i++) {
    const ok = await page.evaluate((t) => {
      for (const b of document.querySelectorAll('[role="button"], button')) {
        const txt = (b.innerText || b.value || "").trim().toLowerCase();
        if (txt === t.toLowerCase() || txt.includes(t.toLowerCase())) { b.scrollIntoView({ block: "center" }); b.click(); return true; }
      }
      return false;
    }, text);
    if (ok) { await delay(500); return true; }
    await delay(300);
  }
  return false;
}

// ===== CAPTCHA SOLVER WITH AUDIO =====

async function qwenVision(prompt, imageBase64) {
  try {
    const resp = await fetch("http://localhost:11434/api/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "qwen3-vl:235b-cloud", prompt, images: [imageBase64], stream: false }),
      signal: AbortSignal.timeout(90000),
    });
    if (!resp.ok) return null;
    return (await resp.json()).response || null;
  } catch (e) { return null; }
}

async function downloadFile(url, dest) {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const buf = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(dest, buf);
    return buf;
  } catch (e) { return null; }
}

function convertToFlac(inputPath, outputPath) {
  try {
    execSync(`"${FFMPEG}" -y -i "${inputPath}" -ac 1 -ar 44100 -sample_fmt s16 "${outputPath}"`, { stdio: 'pipe', timeout: 15000 });
    return true;
  } catch (e) { return false; }
}

async function googleSpeechAPI(flacPath) {
  try {
    const audioBuf = fs.readFileSync(flacPath);
    const resp = await fetch("https://www.google.com/speech-api/v2/recognize?output=json&lang=en-US&key=AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw", {
      method: "POST",
      headers: { "Content-Type": "audio/x-flac; rate=44100" },
      body: audioBuf,
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    // Parse the JSON lines response
    const lines = text.split("\n").filter(l => l.trim());
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.result && data.result[0] && data.result[0].alternative && data.result[0].alternative[0]) {
          return data.result[0].alternative[0].transcript;
        }
      } catch(e) {}
    }
    return null;
  } catch (e) { return null; }
}

async function solveWithAudio(page) {
  log("Cambiando a audio challenge...");
  
  const bf = page.frames().find(f => f.url().includes("bframe"));
  if (!bf) { log("No bframe para audio"); return false; }
  
  // Click audio button
  try {
    await bf.evaluate(() => document.querySelector("#recaptcha-audio-button")?.click());
    await delay(3000);
  } catch(e) { log("Error click audio button"); return false; }
  
  // Get audio URL
  const audioUrl = await bf.evaluate(() => {
    const audio = document.querySelector("audio");
    return audio ? audio.src : "";
  }).catch(() => "");
  
  if (!audioUrl) { log("No se encontro audio URL"); return false; }
  log("Audio URL: " + audioUrl.substring(0, 80) + "...");
  
  // Download MP3
  const mp3Path = path.join(DIR, "_captcha.mp3");
  const buf = await downloadFile(audioUrl, mp3Path);
  if (!buf) { log("Error descargando audio"); return false; }
  log("Audio descargado: " + (buf.length / 1024).toFixed(0) + "KB");
  
  // Convert to FLAC
  const flacPath = path.join(DIR, "_captcha.flac");
  if (!convertToFlac(mp3Path, flacPath)) { log("Error convirtiendo a FLAC"); return false; }
  log("Convertido a FLAC");
  
  // Transcribe with Google Speech API
  const transcript = await googleSpeechAPI(flacPath);
  if (!transcript) { log("Google Speech no respondio"); return false; }
  log("Transcripcion: \"" + transcript + "\"");
  
  // Type the answer
  const answerInput = await bf.$("input#audio-response, input[type=text]");
  if (!answerInput) { log("No se encontro input de respuesta"); return false; }
  
  await answerInput.click();
  await delay(200);
  await answerInput.type(transcript, { delay: 50 });
  await delay(500);
  
  // Click Verify
  log("Click Verify (audio)...");
  try { await bf.evaluate(() => document.querySelector("#recaptcha-verify-button")?.click()); } catch(e) {}
  await delay(5000);
  
  if (!page.frames().find(f => f.url().includes("bframe"))) { log("✅ CAPTCHA SUPERADO!"); return true; }
  return false;
}

async function solveCaptcha(page) {
  await delay(2000);
  
  // Try visual with qwen3-vl first
  let bf = page.frames().find(f => f.url().includes("bframe"));
  
  if (!bf) {
    const cf = page.frames().find(f => f.url().includes("recaptcha/api") && !f.url().includes("bframe"));
    if (cf) {
      const checked = await cf.evaluate(() => document.querySelector("#recaptcha-anchor")?.getAttribute("aria-checked") === "true").catch(() => false);
      if (!checked) {
        log("Click checkbox...");
        await cf.evaluate(() => document.querySelector("#recaptcha-anchor")?.click());
        await delay(4000);
        bf = page.frames().find(f => f.url().includes("bframe"));
      }
    }
  }
  
  if (!bf) { log("No captcha"); return true; }
  log("Desafio captcha detectado");
  
  // Try visual first (1 attempt)
  log("Intento visual con qwen3-vl...");
  
  // Crop bframe area
  const bframeClip = await page.evaluate(() => {
    for (const f of document.querySelectorAll("iframe")) {
      if ((f.src || "").includes("bframe")) { const r = f.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }
    }
    return null;
  });
  
  let shotB64;
  if (bframeClip) {
    const full = await page.screenshot({ encoding: 'buffer' });
    const sharp2 = require('sharp');
    if (bframeClip.w > 100 && bframeClip.h > 100) {
      const c = await sharp2(full).extract({ left: Math.round(bframeClip.x), top: Math.round(bframeClip.y), width: Math.round(bframeClip.w), height: Math.round(bframeClip.h) }).png().toBuffer();
      shotB64 = c.toString('base64');
    } else {
      shotB64 = (await page.screenshot({ encoding: 'base64' }));
    }
  } else {
    shotB64 = (await page.screenshot({ encoding: 'base64' }));
  }
  
  const visResult = await qwenVision(
    `reCAPTCHA challenge grid. Look at the tiles. Which ones contain the requested object? Numbers 1-based, left-to-right, top-to-bottom. ONLY respond: TILES: <comma-separated numbers>`,
    shotB64
  );
  log("qwen3-vl: " + (visResult || "N/A").substring(0, 200));
  
  let tiles = [];
  if (visResult) {
    const m = visResult.match(/TILES:\s*([0-9,\s]+)/i);
    if (m) tiles = [...new Set(m[1].split(",").map(t => parseInt(t.trim())).filter(t => !isNaN(t)))];
  }
  
  if (tiles.length > 0) {
    log("Click visual tiles: " + JSON.stringify(tiles));
    for (const t of tiles) { try { bf.evaluate((idx) => document.querySelectorAll("td")[idx - 1]?.click(), t); } catch(e) {} await delay(800); }
    await delay(1000);
    try { bf.evaluate(() => document.querySelector("#recaptcha-verify-button")?.click()); } catch(e) {}
    await delay(5000);
    if (!page.frames().find(f => f.url().includes("bframe"))) { log("✅ CAPTCHA SUPERADO!"); return true; }
    log("Visual fallo, refrescando...");
    try { bf.evaluate(() => document.querySelector("#recaptcha-reload-button, .rc-reload-button")?.click()); } catch(e) {}
    await delay(3000);
  }
  
  // Try audio (2 attempts)
  log("Pasando a audio challenge...");
  for (let a = 0; a < 2; a++) {
    const ok = await solveWithAudio(page);
    if (ok) return true;
    log("Audio intento " + (a + 1) + " fallo");
    await delay(2000);
    // Re-audio button if needed
    const bf2 = page.frames().find(f => f.url().includes("bframe"));
    if (bf2) {
      try { bf2.evaluate(() => document.querySelector("#recaptcha-audio-button")?.click()); } catch(e) {}
      await delay(3000);
    }
  }
  
  return false;
}

// ===== MAIN =====
async function processForm(page) {
  log("Cargando formulario...");
  await page.goto(FORM_URL + "?_t=" + Date.now(), { waitUntil: "networkidle2", timeout: 60000 });
  await delay(3000);

  for (let attempt = 0; attempt < 15; attempt++) {
    log("\n--- Intento " + (attempt + 1) + " ---");
    await page.screenshot({ path: path.join(DIR, "state_" + attempt + ".png") });

    const body = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => "");
    if (body.includes("registrada") || body.includes("gracias") || body.includes("Respuesta enviada") || body.includes("Enviar otra respuesta")) {
      log("✅ FORMULARIO ENVIADO!");
      return true;
    }

    // Captcha check
    if (page.frames().some(f => f.url().includes("recaptcha"))) {
      log("Captcha presente...");
      const ok = await solveCaptcha(page);
      if (ok) { log("Captcha resuelto!"); await delay(2000); continue; }
      log("Captcha no resuelto, continuando...");
      await delay(2000);
      continue;
    }

    // Fill fields
    const fields = await getFields(page);
    const emptyReq = fields.filter(f => (f.hasInput && !f.value) || (!f.hasInput && !f.radios.length));
    if (emptyReq.length > 0) {
      log("Campos vacios: " + emptyReq.map(f => f.title.substring(0, 15)).join(", "));
      await fillAllFields(page);
      await delay(1000);
    }

    // Click buttons
    if (await page.evaluate(() => Array.from(document.querySelectorAll('[role="button"], button')).some(b => (b.innerText || "").trim().toLowerCase().includes("siguiente"))).catch(() => false)) {
      log("Click Siguiente..."); await clickButton(page, "Siguiente"); await delay(3000); continue;
    }
    if (await page.evaluate(() => Array.from(document.querySelectorAll('[role="button"], button')).some(b => (b.innerText || "").trim().toLowerCase().includes("enviar"))).catch(() => false)) {
      log("Click Enviar..."); await clickButton(page, "Enviar"); await delay(5000); continue;
    }

    log("Sin botones, esperando..."); await delay(3000);
  }
  return false;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    userDataDir: path.join(DIR, "real_user_data_link"),
    headless: false, args: ["--profile-directory=Profile 2", "--start-maximized", "--disable-blink-features=AutomationControlled"],
    defaultViewport: null,
  });
  const [page] = await browser.pages();
  await page.setViewport({ width: 1920, height: 1080 });

  const result = await processForm(page);
  log(result ? "✅ EXITO" : "❌ FALLO");
  await page.screenshot({ path: path.join(DIR, "final.png") });
  await browser.close();
})().catch(e => { console.error("FATAL:", e.message, e.stack?.substring(0, 500)); process.exit(1); });
