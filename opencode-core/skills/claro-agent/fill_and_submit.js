const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const path = require("path");
const fs = require("fs");

const DIR = __dirname;
const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfd9f3bIBYdrMps4YlASFWr2Zsg81eiIsXF8wtq2bZ_xaSsYA/viewform";

const DATA = {
  correo: "daveymena16@gmail.com", ciudad: "Cali", cuenta: "2133956",
  nodo: "OCDGCF", orden: "7735847", tipoTrabajo: "MANTENIMIENTOS FTTH",
  cedulaTec: "1077449318", nombreTec: "Duvier Davey Mena Mosquera",
  cedulaAux: "0", nombreAux: "X", aplicaMaterial: "No",
};

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function log(msg) { console.log("[" + new Date().toLocaleTimeString() + "] " + msg); }

async function qwenVision(prompt, imageBase64) {
  try {
    const resp = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "qwen3-vl:235b-cloud", prompt, images: [imageBase64], stream: false }),
      signal: AbortSignal.timeout(90000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.response || null;
  } catch (e) { return null; }
}

async function fillInput(page, heading, value) {
  const idx = await page.evaluate((h) => {
    const items = document.querySelectorAll('[role="listitem"]');
    for (let i = 0; i < items.length; i++) {
      if (items[i].querySelector('[role="heading"]')?.textContent.trim().toLowerCase().includes(h.toLowerCase())) return i;
    }
    return -1;
  }, heading);
  if (idx < 0) return false;
  for (let n = 0; n < 5; n++) {
    const el = await page.evaluateHandle((i) => document.querySelectorAll('[role="listitem"]')[i]?.querySelector('input.whsOnd, input[type="text"], input[type="email"], input[type="number"]'), idx);
    if (!el?.asElement()) { await delay(300); continue; }
    try {
      await el.asElement().click(); await delay(100);
      await page.keyboard.down("Control"); await page.keyboard.press("a"); await page.keyboard.up("Control");
      await page.keyboard.press("Backspace"); await delay(100);
      await page.keyboard.type(String(value), { delay: 10 }); await delay(200);
      return true;
    } catch (e) {}
    await delay(300);
  }
  return false;
}

async function selectDropdown(page, heading, value) {
  const idx = await page.evaluate((h) => {
    const items = document.querySelectorAll('[role="listitem"]');
    for (let i = 0; i < items.length; i++) {
      if (items[i].querySelector('[role="heading"]')?.textContent.trim().toLowerCase().includes(h.toLowerCase())) return i;
    }
    return -1;
  }, heading);
  if (idx < 0) return false;
  for (let n = 0; n < 6; n++) {
    const lb = await page.evaluateHandle((i) => document.querySelectorAll('[role="listitem"]')[i]?.querySelector('[role="listbox"]'), idx);
    if (!lb?.asElement()) { await delay(300); continue; }
    try {
      await lb.asElement().scrollIntoView({ block: "center" }); await delay(200);
      await lb.asElement().click(); await delay(1500);
      const ok = await page.evaluate((v) => {
        for (const o of document.querySelectorAll('[role="option"]')) {
          if (o.textContent.trim().toLowerCase() === v.toLowerCase()) { o.scrollIntoView({ block: "center" }); o.click(); return true; }
        }
        return false;
      }, value);
      if (ok) return true;
    } catch (e) {}
    await delay(400);
  }
  return false;
}

async function selectRadio(page, heading, value) {
  const idx = await page.evaluate((h) => {
    const items = document.querySelectorAll('[role="listitem"]');
    for (let i = 0; i < items.length; i++) {
      if (items[i].querySelector('[role="heading"]')?.textContent.trim().toLowerCase().includes(h.toLowerCase())) return i;
    }
    return -1;
  }, heading);
  if (idx < 0) return false;
  for (let n = 0; n < 5; n++) {
    const r = await page.evaluateHandle(([i, v]) => {
      for (const r2 of document.querySelectorAll('[role="listitem"]')[i]?.querySelectorAll('[role="radio"]') || []) {
        if (r2.getAttribute("data-value") === v || r2.textContent.trim().toLowerCase() === v.toLowerCase()) return r2;
      }
      return null;
    }, [idx, value]);
    if (!r?.asElement()) { await delay(300); continue; }
    try {
      await r.asElement().scrollIntoView({ block: "center" }); await delay(200);
      await r.asElement().click(); await delay(500);
      return true;
    } catch (e) {}
    await delay(300);
  }
  return false;
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

async function solveCaptcha(page) {
  log("Buscando captcha...");
  await delay(2000);
  
  // Look for reCAPTCHA iframe
  const frames = page.frames();
  const captchaFrame = frames.find(f => f.url().includes("recaptcha/api") && !f.url().includes("bframe"));
  
  if (captchaFrame) {
    log("Checkbox reCAPTCHA encontrado");
    const checked = await captchaFrame.evaluate(() => document.querySelector("#recaptcha-anchor")?.getAttribute("aria-checked") === "true").catch(() => false);
    if (!checked) {
      log("Click checkbox...");
      await captchaFrame.evaluate(() => document.querySelector("#recaptcha-anchor")?.click());
      await delay(3000);
    }
  }

  // Check for bframe (challenge)
  const bf = page.frames().find(f => f.url().includes("bframe"));
  if (!bf) {
    log("No hay desafio, captcha probablemente superado");
    return true;
  }

  log("Desafio captcha detectado");

  // Take screenshot of the captcha
  const shot = await page.screenshot({ encoding: "base64" });
  
  // Ask qwen3-vl to analyze
  const prompt = `reCAPTCHA visual challenge visible in this screenshot. 
Look at the grid of images. What is the challenge asking for? 
Identify which tiles contain the requested object.
Number tiles 1-9 (or however many there are) left-to-right, top-to-bottom.
Respond EXACTLY with: TILES: <comma-separated tile numbers>
Example: TILES: 2,5,7
If none match: TILES: NONE`;

  log("Enviando a qwen3-vl para analisis...");
  const response = await qwenVision(prompt, shot);
  log("Respuesta: " + (response ? response.substring(0, 200) : "NULA"));

  if (!response) {
    log("qwen3-vl no respondio, refrescando...");
    try { bf.evaluate(() => document.querySelector("#recaptcha-reload-button")?.click()); } catch(e) {}
    await delay(3000);
    return false;
  }

  // Parse tile numbers
  const match = response.match(/TILES:\s*([0-9,\s]+)/i);
  let tiles = [];
  if (match) {
    tiles = match[1].split(",").map(t => parseInt(t.trim())).filter(t => !isNaN(t) && t > 0);
  }
  
  if (tiles.length === 0) {
    // Try to find any numbers in the response
    const nums = response.match(/\b([1-9]|1[0-6])\b/g);
    if (nums) tiles = [...new Set(nums.map(Number))];
  }

  if (tiles.length === 0) {
    log("qwen3-vl no identifico tiles, probando metodo alternativo...");
    // Click tiles that have high variance (sharp analysis)
    const shotBuffer = Buffer.from(shot, 'base64');
    const sharp2 = require('sharp');
    const tileInfo = await getTilesInfo(bf);
    if (tileInfo && tileInfo.length > 0) {
      log("Analizando " + tileInfo.length + " tiles con sharp...");
      const bframePos = await getBframePos(page);
      const features = [];
      for (const t of tileInfo) {
        try {
          const buf = await sharp2(shotBuffer)
            .extract({ left: Math.max(0, t.x + bframePos.x), top: Math.max(0, t.y + bframePos.y), width: Math.round(t.w), height: Math.round(t.h) })
            .resize(30, 30).raw().toBuffer();
          let e = 0;
          for (let i = 0; i < buf.length - 3; i += 3) { e += Math.abs(buf[i] - buf[i+3]); }
          features.push({ idx: t.idx, edge: e / (30*30) });
        } catch(e2) {}
      }
      const avg = features.reduce((s, t) => s + t.edge, 0) / features.length;
      tiles = features.filter(t => t.edge > avg * 0.8).map(t => t.idx);
      log("Sharp tiles: " + JSON.stringify(tiles));
    }
  }

  // Click tiles
  for (const t of tiles) {
    try { bf.evaluate((idx) => document.querySelectorAll("td")[idx - 1]?.click(), t); } catch(e) {}
    await delay(500);
  }

  // Click Verify
  await delay(1000);
  try { bf.evaluate(() => document.querySelector("#recaptcha-verify-button")?.click()); } catch(e) {}
  await delay(5000);

  // Check if bframe disappeared
  if (!page.frames().find(f => f.url().includes("bframe"))) {
    log("Captcha SUPERADO!");
    return true;
  }
  return false;
}

async function getTilesInfo(bf) {
  try {
    return await bf.evaluate(() => {
      const tds = document.querySelectorAll("td");
      return Array.from(tds).filter(td => td.offsetWidth > 20).map((td, i) => {
        const r = td.getBoundingClientRect();
        return { idx: i + 1, x: r.left, y: r.top, w: r.width, h: r.height };
      });
    });
  } catch(e) { return null; }
}

async function getBframePos(page) {
  const iframes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('iframe')).map(f => {
      const r = f.getBoundingClientRect();
      return { src: (f.src || "").substring(0, 200), x: r.left, y: r.top };
    });
  });
  const bf = iframes.find(f => f.src.includes("bframe"));
  return bf ? { x: bf.x, y: bf.y } : { x: 0, y: 0 };
}

// ====== MAIN ======
(async () => {
  log("Iniciando Chrome...");
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    userDataDir: path.join(DIR, "real_user_data_link"),
    headless: false,
    args: ["--profile-directory=Profile 2", "--start-maximized", "--disable-blink-features=AutomationControlled"],
    defaultViewport: null,
  });
  const [page] = await browser.pages();
  await page.setViewport({ width: 1920, height: 1080 });

  // Load form
  log("Abriendo formulario...");
  await page.goto(FORM_URL + "?_t=" + Date.now(), { waitUntil: "networkidle2", timeout: 60000 });
  await delay(3000);

  // Fill page 1
  log("Llenando pagina 1...");
  await fillInput(page, "Correo", DATA.correo);
  await selectDropdown(page, "Ciudad", DATA.ciudad);
  await fillInput(page, "Cuenta", DATA.cuenta);
  await fillInput(page, "Nodo", DATA.nodo);
  await fillInput(page, "Orden", DATA.orden);
  await selectDropdown(page, "Tipo de Trabajo", DATA.tipoTrabajo);
  await fillInput(page, "Cedula Tecnico", DATA.cedulaTec);
  await fillInput(page, "Nombre del Tecnico", DATA.nombreTec);
  await fillInput(page, "Cedula Auxiliar", DATA.cedulaAux);
  await fillInput(page, "Nombre del Auxiliar", DATA.nombreAux);
  await selectRadio(page, "Aplica Material", DATA.aplicaMaterial);
  log("Pagina 1 completa");

  // Click Siguiente
  log("Click Siguiente...");
  await clickButton(page, "Siguiente");
  await delay(3000);

  // Now on final page - click Enviar
  log("Click Enviar...");
  await clickButton(page, "Enviar");
  await delay(5000);

  // Handle captcha (up to 3 rounds)
  for (let round = 0; round < 3; round++) {
    const solved = await solveCaptcha(page);
    if (solved) break;
    log("Reintento " + (round + 1) + "...");
    // Try clicking Enviar again
    await clickButton(page, "Enviar");
    await delay(4000);
  }

  // Check result
  await delay(3000);
  const body = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => "");
  if (body.includes("registrada") || body.includes("gracias") || body.includes("enviada")) {
    log("✅ FORMULARIO ENVIADO EXITOSAMENTE!");
  } else {
    log("Estado actual: " + body.substring(0, 200));
  }

  await page.screenshot({ path: path.join(DIR, "resultado.png") });
  log("Screenshot final guardado");

  await browser.close();
  log("Listo!");
})().catch(e => { console.error("FATAL:", e.message, e.stack?.substring(0, 500)); process.exit(1); });
