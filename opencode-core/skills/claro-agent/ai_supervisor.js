// Cargar variables de entorno del archivo .env del directorio raíz
try {
  const path = require("path");
  require("dotenv").config({ path: path.join(__dirname, "../.env") });
} catch (e) {}

const OLLAMA_ENDPOINT = "http://localhost:11434/api/generate";
const VISION_MODEL = "qwen3-vl:235b-cloud";
const REASON_MODEL = "gemma4:e2b-it-q4_K_M";
const FAST_MODEL = "llama-free:latest";

const ZEN_API_KEY = process.env.OPENCODE_ZEN_API_KEY || (() => {
  try {
    const yaml = require("fs").readFileSync(
      require("path").join(process.env.LOCALAPPDATA || "", "hermes", "config.yaml"),
      "utf8"
    );
    const match = yaml.match(/opencode:\s*(sk-[^\s]+)/);
    return match ? match[1] : "sk-dummy";
  } catch (e) {
    return "sk-dummy";
  }
})();

const OPENCODE_ZEN_URL = "https://opencode.ai/zen/v1/chat/completions";
const OPENCODE_ZEN_MODEL = "deepseek-v4-flash-free";

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callOpenCodeZen(prompt) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(OPENCODE_ZEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + ZEN_API_KEY
        },
        body: JSON.stringify({
          model: OPENCODE_ZEN_MODEL,
          messages: [
            { role: "system", content: "Responde siempre con una accion clara y concisa. No incluyas pensamiento ni razonamiento, solo la respuesta final." },
            { role: "user", content: prompt }
          ],
          max_tokens: 8192,
          stream: false
        }),
        signal: AbortSignal.timeout(120000),
      });
      if (!resp.ok) {
        console.log("  [AI-Zen] HTTP " + resp.status + ", reintento " + (attempt + 1));
        await delay(2000);
        continue;
      }
      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content || "";
      if (content.trim()) return content.trim();
    } catch (e) {
      console.log("  [AI-Zen] Error: " + e.message.substring(0, 80) + ", reintento " + (attempt + 1));
      await delay(2000);
    }
  }
  return null;
}

async function callOllama(model, prompt, imageBase64 = null) {
  const isVision = !!imageBase64;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let body, endpoint;
      if (isVision) {
        endpoint = OLLAMA_ENDPOINT.replace(/\/api\/generate(\?.*)?$/, "/api/chat");
        body = {
          model,
          messages: [{ role: "user", content: prompt, images: [imageBase64] }],
          stream: false
        };
      } else {
        endpoint = OLLAMA_ENDPOINT;
        body = { model, prompt, stream: false };
      }
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000),
      });
      if (!resp.ok) {
        if (resp.status === 410) {
          console.log("  [AI] HTTP 410 (modelo " + model + " no soporta endpoint), fallback...");
          return null;
        }
        console.log("  [AI] HTTP " + resp.status + ", reintento " + (attempt + 1));
        await delay(2000);
        continue;
      }
      const data = await resp.json();
      if (data.response) return data.response;
      if (isVision && data.message?.content) return data.message.content;
    } catch (e) {
      console.log("  [AI] Error: " + e.message.substring(0, 80) + ", reintento " + (attempt + 1));
      await delay(2000);
    }
  }
  return null;
}


async function callVision(prompt, imageBase64) {
  const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (geminiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
    const body = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/png",
              data: imageBase64
            }
          }
        ]
      }]
    };
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (resp.ok) {
        const data = await resp.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
      }
    } catch (e) {}
  }
  
  // Fallback a Moondream local de Ollama si no hay API Key o falla
  return await callOllama(VISION_MODEL, prompt, imageBase64);
}

async function callReason(prompt) {
  const zen = await callOpenCodeZen(prompt);
  if (zen) return zen;
  return await callOllama(REASON_MODEL, prompt);
}

async function callFast(prompt) {
  const zen = await callOpenCodeZen(prompt);
  if (zen) return zen;
  return await callOllama(FAST_MODEL, prompt);
}

async function askAI(page, prompt) {
  const zen = await callOpenCodeZen(prompt);
  if (zen) return zen;
  return await callOllama(FAST_MODEL, prompt);
}

async function describeScreenshot(page) {
  const shot = await page.screenshot({ encoding: "base64" });
  const desc = await callVision(
    "Describe this webpage in detail. What do you see? What fields, buttons, text, and elements are visible? " +
    "Is there a form? A captcha? Error messages? What is the current state of the page? " +
    "List ALL visible text, buttons, and interactive elements.",
    shot
  );
  return { description: desc || "(no description)", screenshotBase64: shot };
}

async function analyzeCaptchaArea(page) {
  const shot = await page.screenshot({ encoding: "base64" });
  const analysis = await callVision(
    "I see a reCAPTCHA challenge on this page. " +
    "Look at the grid of images. What is the challenge asking for? " +
    "Describe EACH tile in the grid and what object/pattern it contains. " +
    "Then tell me EXACTLY which tile numbers (1-based, left-to-right, top-to-bottom) contain the requested object. " +
    "Format: CHALLENGE: <text> TILES: <numbers separated by commas>",
    shot
  );
  return analysis || "";
}

async function analyzeIndividualTile(tileImageBase64, challengeText) {
  const analysis = await callVision(
    "This is one tile from a reCAPTCHA challenge. The challenge asks to click images containing: \"" + challengeText + "\". " +
    "Does THIS tile contain the requested object? Answer ONLY: YES or NO. Then briefly explain why.",
    tileImageBase64
  );
  return analysis || "NO";
}

async function decideAction(pageState, context) {
  const prompt = `You are an AI supervisor for an automated form-filling bot. The bot is filling a Google Form.

CURRENT STATE:
${pageState}

CONTEXT: ${context}

TASK: Analyze the situation and decide what action the bot should take next.

Possible actions:
- CLICK "button text" - click a button with specific text
- FILL "field heading" = "value" - fill a field
- SCROLL - scroll down
- WAIT - wait and retry
- REFRESH - reload the page
- RELAUNCH - close and restart
- SOLVED - the form was submitted successfully

If there's a captcha challenge visible, describe what the captcha shows.

Respond with EXACTLY ONE action line, nothing else.`;
  
  return await callReason(prompt);
}

async function supervise(page, context = "Form filling progress") {
  console.log("\n🤖 [SUPERVISOR] Activando supervision IA...");
  
  const { description, screenshotBase64 } = await describeScreenshot(page);
  console.log("  [SUPERVISOR] Vision: " + (description ? description.substring(0, 200) + "..." : "sin descripcion"));
  
  const action = await decideAction(description, context);
  console.log("  [SUPERVISOR] Razonamiento: " + (action ? action.substring(0, 300) : "sin respuesta"));

  return { action, screenshotBase64, description };
}

async function executeAction(page, actionStr) {
  if (!actionStr) return false;
  
  const action = actionStr.trim().toLowerCase();

  // Detectar scroll en lenguaje natural
  if (action.includes("scroll") || action.includes("despláz") || action.includes("desplaz") || action.includes("abajo") || action.includes("zoom out")) {
    console.log("  [SUPERVISOR] Scroll/zoom...");
    await page.evaluate(() => window.scrollBy(0, 400));
    await delay(1000);
    return true;
  }

  // Detectar wait/espera
  if (action.includes("wait") || action.includes("esper") || action.includes("delay") || action.includes("reintent")) {
    console.log("  [SUPERVISOR] Esperando...");
    await delay(3000);
    return true;
  }

  // Detectar refresh/recargar
  if (action.includes("refresh") || action.includes("recarg") || action.includes("reload")) {
    console.log("  [SUPERVISOR] Recargando pagina...");
    await page.reload({ waitUntil: "networkidle2" });
    await delay(3000);
    return true;
  }

  // Detectar completado
  if (action.includes("solved") || action.includes("complet") || action.includes("enviad") || action.includes("listo") || action.includes("termin")) {
    console.log("  [SUPERVISOR] Detecta formulario completado!");
    return true;
  }

  // CLICK action (formato estructurado o lenguaje natural)
  const clickMatch = actionStr.trim().match(/CLICK\s+"([^"]+)"/i);
  if (clickMatch) {
    const btnText = clickMatch[1];
    console.log("  [SUPERVISOR] Click en \"" + btnText + "\"...");
    for (let i = 0; i < 10; i++) {
      const ok = await page.evaluate((txt) => {
        const btns = document.querySelectorAll('[role="button"], button, input[type="submit"], span, a');
        for (const b of btns) {
          const t = (b.innerText || b.value || b.textContent || "").trim().toLowerCase();
          if (t === txt.toLowerCase() || t.includes(txt.toLowerCase())) {
            b.scrollIntoView({ block: "center" });
            b.click();
            return true;
          }
        }
        return false;
      }, btnText);
      if (ok) { await delay(500); return true; }
      await delay(300);
    }
    return false;
  }

  // FILL action
  const fillMatch = actionStr.trim().match(/FILL\s+"([^"]+)"\s*=\s*"([^"]*)"/i);
  if (fillMatch) {
    const [_, heading, value] = fillMatch;
    const headingLower = String(heading || "").toLowerCase();
    let safeValue = String(value || "");
    if ((headingLower.includes("correo") || headingLower.includes("email") || headingLower.includes("gmail")) && !safeValue.includes("@")) {
      console.log("  [SUPERVISOR] Proteccion: corrigiendo campo correo para evitar telefono");
      safeValue = "daveymena16@gmail.com";
    }
    if ((headingLower.includes("telefono") || headingLower.includes("teléfono") || headingLower.includes("celular") || headingLower.includes("contacto")) && safeValue.includes("@")) {
      console.log("  [SUPERVISOR] Proteccion: corrigiendo campo telefono para evitar correo");
      safeValue = "3136174267";
    }
    if (isMaterialField(headingLower) && safeValue === "3136174267") {
      console.log("  [SUPERVISOR] Proteccion: no se escribe telefono en campo de material/conector");
      return false;
    }
    console.log("  [SUPERVISOR] Llenar \"" + heading.substring(0, 20) + "\" = \"" + safeValue + "\"...");
    const ok = await page.evaluate(([h, v]) => {
      const items = document.querySelectorAll('[role="listitem"]');
      for (const item of items) {
        const hd = item.querySelector('[role="heading"]');
        if (hd && hd.textContent.trim().toLowerCase().includes(h.toLowerCase())) {
          const inp = item.querySelector('input.whsOnd, input[type="text"], input[type="email"], input[type="number"], textarea');
          if (inp) {
            inp.focus();
            inp.value = v;
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          }
        }
      }
      return false;
    }, [heading, safeValue]);
    await delay(300);
    return ok;
  }

  console.log("  [SUPERVISOR] Accion no reconocida: " + action.substring(0, 100));
  return false;
}

// Compatibility wrapper for old callAI (uses moondream now)
async function callAI(prompt, screenshotBase64) {
  console.log("  [AI] Usando moondream para analisis...");
  return await callVision(prompt, screenshotBase64);
}

function isMaterialField(ft) {
  return ft.includes("conector") || ft.includes("rj") || ft.includes("material") || ft.includes("cable") || ft.includes("telefonico") || ft.includes("telefónico");
}

module.exports = {
  callVision, callReason, callFast, callAI, askAI, executeAIAction: executeAction,
  describeScreenshot, analyzeCaptchaArea, analyzeIndividualTile,
  decideAction, supervise, executeAction
};
