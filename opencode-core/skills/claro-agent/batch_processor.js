const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const DIR = __dirname;
const FFMPEG = require("ffmpeg-static");
const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfd9f3bIBYdrMps4YlASFWr2Zsg81eiIsXF8wtq2bZ_xaSsYA/viewform";

const FIXED = {
  correo: "daveymena16@gmail.com", ciudad: "Cali",
  cedulaTecnico: "1077449318", nombreTecnico: "Duvier Davey Mena Mosquera",
  telefono: "3136174267", tipoTrabajo: "MANTENIMIENTOS FTTH",
  cedulaAuxiliar: "0", nombreAuxiliar: "X",
};

const JSON_PATH = path.join(DIR, "ordenes_procesadas.json");
let CURRENT_ORDER = null;

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(msg) { console.log("[" + new Date().toLocaleTimeString() + "] " + msg); }

function loadOrders() { return JSON.parse(fs.readFileSync(JSON_PATH, "utf8")); }
function saveOrders(orders) { fs.writeFileSync(JSON_PATH, JSON.stringify(orders, null, 4), "utf8"); }

function matchField(title) {
  const ft = title.toLowerCase();
  if (ft.includes("correo") || ft.includes("email") || ft.includes("gmail")) return { type: "text", value: FIXED.correo };
  if (ft.includes("ciudad")) return { type: "dropdown", value: FIXED.ciudad };
  if (ft.includes("cuenta")) return { type: "text", value: String(CURRENT_ORDER.cuenta) };
  if (ft.includes("nodo")) return { type: "text", value: String(CURRENT_ORDER.nodo) };
  if ((ft.includes("orden") || ft.includes("ot")) && !ft.includes("vir") && !ft.includes("virtual")) return { type: "text", value: String(CURRENT_ORDER.ot) };
  if (ft.includes("tipo de trabajo") || ft.includes("tipo trabajo")) return { type: "dropdown", value: FIXED.tipoTrabajo };
  if (ft.includes("cedula") && (ft.includes("tec") || ft.includes("tecnico"))) return { type: "text", value: FIXED.cedulaTecnico };
  if (ft.includes("nombre") && (ft.includes("tec") || ft.includes("tecnico"))) return { type: "text", value: FIXED.nombreTecnico };
  if (ft.includes("cedula") && (ft.includes("aux") || ft.includes("auxiliar"))) return { type: "text", value: FIXED.cedulaAuxiliar };
  if (ft.includes("nombre") && (ft.includes("aux") || ft.includes("auxiliar"))) return { type: "text", value: FIXED.nombreAuxiliar };
  if (ft.includes("aplica material")) return { type: "radio", value: CURRENT_ORDER.aplicaMaterial || "Si" };
  if ((ft.includes("telefono") || ft.includes("teléfono") || ft.includes("contacto") || ft.includes("celular")) && !isMaterialField(ft)) return { type: "text", value: FIXED.telefono };
  return null;
}

function isMaterialField(ft) {
  return ft.includes("conector") || ft.includes("rj") || ft.includes("material") || ft.includes("cable") || ft.includes("telefonico") || ft.includes("telefónico");
}

async function getFields(page) {
  return await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="listitem"]')).map((item, idx) => {
      const h = item.querySelector('[role="heading"]');
      const title = h ? h.innerText.trim().replace(/[*.]/g, "").trim() : "";
      const inp = item.querySelector('input.whsOnd, input[type="text"], input[type="email"], input[type="number"]');
      return { idx, title, hasInput: !!inp, hasSelect: !!item.querySelector('[role="listbox"]'), radios: Array.from(item.querySelectorAll('[role="radio"]')).map(r => r.getAttribute("data-value")), value: inp ? inp.value : "" };
    })
  );
}

async function forceFillField(page, idx, val) {
  await page.evaluate(([i, v]) => {
    const input = document.querySelectorAll('[role="listitem"]')[i]?.querySelector('input.whsOnd, input[type="text"], input[type="email"], input[type="number"]');
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    setter.call(input, String(v));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, [idx, val]).catch(() => {});
  await delay(150);
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

async function solveWithAudio(page) {
  log("Audio challenge...");
  const bf = page.frames().find(f => f.url().includes("bframe"));
  if (!bf) { log("No bframe"); return false; }
  try { await bf.evaluate(() => document.querySelector("#recaptcha-audio-button")?.click()); await delay(3000); } catch(e) { return false; }
  const audioUrl = await bf.evaluate(() => { const a = document.querySelector("audio"); return a ? a.src : ""; }).catch(() => "");
  if (!audioUrl) return false;
  const mp3Path = path.join(DIR, "_captcha.mp3");
  const buf = await downloadFile(audioUrl, mp3Path);
  if (!buf) return false;
  const flacPath = path.join(DIR, "_captcha.flac");
  if (!convertToFlac(mp3Path, flacPath)) return false;
  const transcript = await googleSpeechAPI(flacPath);
  if (!transcript) return false;
  log("Audio: \"" + transcript + "\"");
  const answerInput = await bf.$("input#audio-response, input[type=text]");
  if (!answerInput) return false;
  await answerInput.click(); await delay(200);
  await answerInput.type(transcript, { delay: 50 }); await delay(500);
  try { await bf.evaluate(() => document.querySelector("#recaptcha-verify-button")?.click()); } catch(e) {}
  await delay(5000);
  return !page.frames().find(f => f.url().includes("bframe"));
}

async function fillPage1(page) {
  const fields = await getFields(page);
  let filled = 0, total = 0;
  for (const f of fields) {
    const m = matchField(f.title);
    if (!m) continue;
    total++;
    let ok = false;
    if (m.type === "text") { await forceFillField(page, f.idx, m.value); ok = true; }
    else if (m.type === "dropdown") ok = await selectDropdown2(page, f.idx, m.value);
    else if (m.type === "radio") ok = await selectRadio2(page, f.idx, m.value);
    if (ok) filled++;
  }
  log("Llenados " + filled + "/" + total + " campos");
  return filled === total;
}

async function processSingleOrder(page, order) {
  CURRENT_ORDER = order;
  log("\n--- OT " + order.ot + " (" + order.cuenta + ", " + order.nodo + ") ---");

  // Load form fresh
  await page.goto(FORM_URL + "?_t=" + Date.now(), { waitUntil: "networkidle2", timeout: 60000 });
  await delay(4000);

  // Clear form if data exists
  const hasData = await page.evaluate(() => {
    for (const el of document.querySelectorAll('a, span, div[role="button"]')) {
      if (el.textContent.trim().toLowerCase().includes("borrar formulario")) return true;
    }
    return false;
  }).catch(() => false);

  if (hasData) {
    log("Limpiando formulario...");
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('a, span, div[role="button"]')) {
        if (el.textContent.trim().toLowerCase().includes("borrar formulario")) { el.click(); return; }
      }
    }).catch(() => {});
    await delay(2000);
    // Confirm dialog
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll('div[role="button"], button, span[role="button"]')) {
        const txt = btn.textContent.trim().toLowerCase();
        if (txt === "borrar" || txt === "eliminar" || txt === "clear") { btn.click(); return; }
      }
    }).catch(() => {});
    await delay(3000);
  }

  // Wait and verify we're on page 1
  await delay(2000);

  for (let attempt = 0; attempt < 40; attempt++) {
    const body = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => "");
    if (body.includes("registrada") || body.includes("gracias") || body.includes("Respuesta enviada") || body.includes("Enviar otra respuesta")) {
      log("ENVIADO!"); return true;
    }

    // Captcha
    if (page.frames().some(f => f.url().includes("recaptcha"))) {
      log("Captcha...");
      for (let a = 0; a < 3; a++) {
        if (await solveWithAudio(page)) { log("Captcha OK!"); break; }
        log("Audio " + (a + 1) + " fallo");
        await delay(2000);
        const bf = page.frames().find(f => f.url().includes("bframe"));
        if (bf) try { bf.evaluate(() => document.querySelector("#recaptcha-audio-button")?.click()); } catch(e) {}
        await delay(3000);
      }
      await delay(2000);
      continue;
    }

    // Fill any visible text/dropdown/radio fields that match
    const fields = await getFields(page);
    let matched = false;
    for (const f of fields) {
      const m = matchField(f.title);
      if (!m) continue;
      matched = true;
      if (m.type === "text") {
        if (f.value !== m.value) { await forceFillField(page, f.idx, m.value); }
      } else if (m.type === "dropdown") {
        await selectDropdown2(page, f.idx, m.value);
      } else if (m.type === "radio") {
        await selectRadio2(page, f.idx, m.value);
      }
    }
    if (matched) { await delay(1000); }

    // Navigate
    if (await page.evaluate(() => Array.from(document.querySelectorAll('[role="button"], button')).some(b => (b.innerText || "").trim().toLowerCase().includes("siguiente"))).catch(() => false)) {
      log("Siguiente..."); await clickButton(page, "Siguiente"); await delay(3000); continue;
    }
    if (await page.evaluate(() => Array.from(document.querySelectorAll('[role="button"], button')).some(b => (b.innerText || "").trim().toLowerCase().includes("enviar"))).catch(() => false)) {
      log("Enviar..."); await clickButton(page, "Enviar"); await delay(5000); continue;
    }

    log("..."); await delay(2000);
  }
  return false;
}

(async () => {
  const orders = loadOrders();
  const pending = orders.filter(o => o.status === "pending");
  log("Total: " + orders.length + ", Pendientes: " + pending.length);
  if (pending.length === 0) { log("Sin pendientes"); process.exit(0); }

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    userDataDir: path.join(DIR, "real_user_data_link"),
    headless: false, args: ["--profile-directory=Profile 2", "--start-maximized", "--disable-blink-features=AutomationControlled"],
    defaultViewport: null,
  });
  const [page] = await browser.pages();
  await page.setViewport({ width: 1920, height: 1080 });

  let okCount = 0, failCount = 0;
  for (const order of pending) {
    try {
      const ok = await processSingleOrder(page, order);
      order.status = ok ? "completed" : "failed";
      if (ok) { okCount++; log("OK OT " + order.ot); } else { failCount++; log("FAIL OT " + order.ot); }
    } catch(e) {
      order.status = "failed"; failCount++;
      log("ERR OT " + order.ot + ": " + e.message);
    }
    saveOrders(orders);
    await delay(2000);
  }

  log("\n--- RESULTADO: " + okCount + " OK, " + failCount + " FAIL ---");
  await page.screenshot({ path: path.join(DIR, "final.png") });
  await browser.close();
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
