const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const path = require("path");
const os = require("os");
const fs = require("fs");

const { agentLoop } = require("./vision_agent.js");
const { solveCaptchaMultiRound } = require("./captcha_solver_final.js");
const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfd9f3bIBYdrMps4YlASFWr2Zsg81eiIsXF8wtq2bZ_xaSsYA/viewform";
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const linkPath = path.join(os.tmpdir(), "puppeteer_profile_" + Date.now());
const EMAIL = "daveymena16@gmail.com";
const PASSWORD = "6715320Dvd.";

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitAndType(page, selector, text, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { timeout });
    await delay(500);
    await page.type(selector, text, { delay: 20 + Math.random() * 30 });
    return true;
  } catch (e) { return false; }
}

async function waitAndClick(page, selector, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { timeout, visible: true });
    await delay(500);
    await page.click(selector);
    await delay(1000);
    return true;
  } catch (e) { return false; }
}

async function ensureSession(page) {
  await page.goto("https://www.google.com", { waitUntil: "networkidle2", timeout: 90000 });
  await delay(2000);
  let text = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => "");
  if (!text.includes("Acceder") && !text.includes("Iniciar sesi")) {
    console.log("Sesion Gmail activa");
    return true;
  }
  console.log("Auto-login en Google...");
  await page.goto("https://accounts.google.com/signin", { waitUntil: "networkidle2", timeout: 90000 });
  await delay(2000);
  await waitAndType(page, 'input[type="email"], input[name="identifier"]', EMAIL);
  await waitAndClick(page, '#identifierNext, button[jsname*="V67aGc"]');
  await delay(3000);
  await waitAndType(page, 'input[type="password"], input[name="Passwd"]', PASSWORD);
  await waitAndClick(page, '#passwordNext, button[jsname*="V67aGc"]');
  await delay(5000);
  console.log("Login completado");
  return true;
}

async function clearFormFields(page) {
  console.log("  [VISION] Limpiando campos del formulario...");
  const cleared = await page.evaluate(() => {
    let count = 0;
    document.querySelectorAll('input.whsOnd, input[type="text"], input[type="email"], input[type="number"], textarea').forEach(inp => {
      if (inp.value && inp.value.trim() !== '') {
        inp.value = '';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        count++;
      }
    });
    return count;
  }).catch(() => 0);
  if (cleared > 0) console.log("  [VISION] " + cleared + " campos limpiados");
  else console.log("  [VISION] Campos ya estan vacios");
  await delay(500);
  try {
    const screenshot = await page.screenshot({ encoding: 'base64' });
    const { callAI } = require('./ai_supervisor.js');
    const visionCheck = await callAI(
      "[VISION] Analiza esta captura del formulario. Responde SOLO: OK si los campos estan vacios, o PROBLEMA si ves contenido precargado.",
      screenshot
    );
    if (visionCheck && visionCheck.includes("PROBLEMA")) {
      console.log("  [VISION] IA detecto campos con datos, relimpiando...");
      await page.evaluate(() => {
        document.querySelectorAll('input.whsOnd, input[type="text"], input[type="email"], input[type="number"], textarea').forEach(inp => {
          inp.value = '';
          inp.dispatchEvent(new Event('input', { bubbles: true }));
        });
      });
      await delay(500);
    } else {
      console.log("  [VISION] IA confirma campos vacios");
    }
  } catch(e) {
    console.log("  [VISION] Skip vision check: " + e.message);
  }
}

const FIXED = {
  correo: EMAIL,
  ciudad: "Cali",
  cedulaTecnico: "1077449318",
  nombreTecnico: "Duvier Davey Mena Mosquera",
  cedulaAuxiliar: "0",
  nombreAuxiliar: "X",
  tipoTrabajo: "MANTENIMIENTOS FTTH",
  tipoPostventa: "POSTVENTA FTTH",
  telefono: "3136174267",
};

async function getFields(page) {
  return await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="listitem"]')).map((item, idx) => {
      const h = item.querySelector('[role="heading"]');
      const title = h ? h.innerText.trim().replace(/\n/g, " ").trim().replace(/\s+/g, " ") : "";
      const cleanTitle = title.replace(/[*.]/g, "").trim().toLowerCase();
      const inp = item.querySelector('input.whsOnd, input[type="text"], input[type="email"], input[type="number"]');
      const radio = item.querySelector('[role="radio"]');
      return { idx, title: cleanTitle, rawTitle: title, hasInput: !!inp, hasSelect: !!item.querySelector('[role="listbox"]'), radios: Array.from(item.querySelectorAll('[role="radio"]')).map(r => r.getAttribute("data-value")) };
    })
  );
}

function matchField(fieldTitle, order) {
  const ft = fieldTitle.toLowerCase();
  if (ft.includes("correo") || ft.includes("email") || ft.includes("gmail")) return { type: "text", value: FIXED.correo };
  if (ft.includes("ciudad")) return { type: "dropdown", value: FIXED.ciudad };
  if (ft.includes("cuenta")) return { type: "text", value: String(order.cuenta || "") };
  if (ft.includes("nodo")) return { type: "text", value: String(order.nodo || "") };
  if (ft.includes("orden")) return { type: "text", value: String(order.ot || "") };
  if (ft.includes("tipo de trabajo") || ft.includes("tipo trabajo")) return { type: "dropdown", value: FIXED.tipoTrabajo };
  if (ft.includes("cedula") && (ft.includes("tec") || ft.includes("tecnico"))) return { type: "text", value: FIXED.cedulaTecnico };
  if (ft.includes("nombre") && (ft.includes("tec") || ft.includes("tecnico"))) return { type: "text", value: FIXED.nombreTecnico };
  if (ft.includes("cedula") && (ft.includes("aux") || ft.includes("auxiliar"))) return { type: "text", value: FIXED.cedulaAuxiliar };
  if (ft.includes("nombre") && (ft.includes("aux") || ft.includes("auxiliar"))) return { type: "text", value: FIXED.nombreAuxiliar };
  if (ft.includes("aplica material")) return { type: "radio", value: order.aplicaMaterial || "Si" };
  if ((ft.includes("telefono") || ft.includes("teléfono") || ft.includes("contacto") || ft.includes("celular")) && !isMaterialField(ft)) return { type: "text", value: FIXED.telefono };
  if (ft.includes("serial") || ft.includes("mac")) {
    const m = ft.match(/\d+/);
    const idx = m ? parseInt(m[0]) - 1 : 0;
    const sers = order.seriales || [];
    return { type: "text", value: sers[idx] || sers[0] || order.serial_ont || "" };
  }
  return null;
}

function isMaterialField(ft) {
  return ft.includes("conector") || ft.includes("rj") || ft.includes("material") || ft.includes("cable") || ft.includes("telefonico") || ft.includes("telefónico");
}

async function fillText(page, idx, val) {
  for (let n = 0; n < 4; n++) {
    const el = await page.evaluateHandle((i) => {
      const items = document.querySelectorAll('[role="listitem"]');
      if (!items[i]) return null;
      return items[i].querySelector('input.whsOnd, input[type="text"], input[type="email"], input[type="number"], textarea');
    }, idx);
    if (!el || el.asElement() === null) { await delay(300); continue; }
    try {
      await el.asElement().click(); await delay(100);
      await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control'); await delay(50);
      await page.keyboard.press('Backspace'); await delay(100);
      await el.asElement().type(String(val), { delay: 15 + Math.random() * 20 });
    } catch(e) {}
    try { await el.dispose(); } catch(e) {}
    await delay(200);
    const cur = await page.evaluate((i) => {
      const items = document.querySelectorAll('[role="listitem"]');
      if (!items[i]) return "";
      const inp = items[i].querySelector("input.whsOnd");
      return inp ? inp.value : "";
    }, idx);
    if (String(cur) === String(val)) return true;
    await delay(300);
  }
  return false;
}

async function selectDropdown(page, idx, label) {
  for (let n = 0; n < 6; n++) {
    const listbox = await page.evaluateHandle((i) => {
      const items = document.querySelectorAll('[role="listitem"]');
      if (!items[i]) return null;
      return items[i].querySelector('[role="listbox"]');
    }, idx);
    if (!listbox || listbox.asElement() === null) { await delay(300); continue; }
    await listbox.asElement().scrollIntoView({ block: "center" }); await delay(200);
    await listbox.asElement().click(); await delay(1200);
    try { await listbox.dispose(); } catch(e) {}
    const sel = await page.evaluate((lbl) => {
      const opts = document.querySelectorAll('[role="option"]');
      for (const o of opts) {
        if (o.textContent.trim().toLowerCase() === lbl.toLowerCase()) { o.scrollIntoView({ block: "center" }); o.click(); return o.textContent.trim(); }
      }
      return null;
    }, label);
    if (sel) { await delay(500); return true; }
    await delay(400);
  }
  return false;
}

async function selectRadio(page, idx, val) {
  for (let n = 0; n < 5; n++) {
    const radio = await page.evaluateHandle((i, v) => {
      const items = document.querySelectorAll('[role="listitem"]');
      if (!items[i]) return null;
      const radios = items[i].querySelectorAll('[role="radio"]');
      for (const r of radios) { if (r.getAttribute("data-value") === v) return r; }
      return null;
    }, idx, val);
    if (!radio || radio.asElement() === null) { await delay(300); continue; }
    await radio.asElement().scrollIntoView({ block: "center" }); await delay(200);
    await radio.asElement().click(); await delay(500);
    try { await radio.dispose(); } catch(e) {}
    const cur = await page.evaluate((i) => {
      const items = document.querySelectorAll('[role="listitem"]');
      if (!items[i]) return "";
      const radios = items[i].querySelectorAll('[role="radio"]');
      for (const r of radios) { if (r.getAttribute("aria-checked") === "true") return r.getAttribute("data-value"); }
      return "";
    }, idx);
    if (cur === val) return true;
    await delay(300);
  }
  return false;
}

(async () => {
  fs.writeFileSync(path.join(__dirname, "reporte_diario.txt"), "=== REPORTE DIARIO ===\nFecha: " + new Date().toLocaleString() + "\n");

  const isTest = process.argv.includes("--test");
  let orders = JSON.parse(fs.readFileSync(path.join(__dirname, "ordenes_procesadas.json"), "utf8"));
  orders = orders.filter(o => (o.status || "pending") === "pending");
  const startIdx = parseInt(process.argv.find(a => a.startsWith('--start='))?.split('=')[1]) || 0;
  const endIdx = parseInt(process.argv.find(a => a.startsWith('--end='))?.split('=')[1]) || orders.length;
  if (startIdx > 0 || endIdx < orders.length) {
    orders = orders.slice(startIdx, endIdx);
    console.log("Filtrado: indices " + startIdx + "-" + (endIdx-1) + " (" + orders.length + " ordenes)");
  }
  if (isTest) orders = orders.slice(0, 1);
  console.log(isTest ? "TEST 1 orden pendiente" : orders.length + " ordenes pendientes\n");
  if (orders.length === 0) {
    console.log("Sin ordenes pendientes");
    return;
  }

  console.log("Lanzando Chrome con perfil temporal...");
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    userDataDir: linkPath,
    headless: false,
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=9223"],
    defaultViewport: null,
  });

  const pages = await browser.pages();
  const page = pages[0];
  page.setDefaultTimeout(120000);

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    try {
      const url = req.url();
      if (url.includes("analytics") || url.includes("doubleclick") || url.includes("googleadservices") || url.includes("pagead2")) req.abort();
      else req.continue();
    } catch (_) {}
  });

  await ensureSession(page);

  const cleanURL = FORM_URL + '?_t=' + Date.now();
  await page.goto(cleanURL, { waitUntil: "networkidle2", timeout: 120000 });
  await delay(3000);

  await clearFormFields(page);

  const PARALLEL = isTest ? 1 : Math.min(2, orders.length);
  console.log(`\nProcesando ${orders.length} ordenes (${PARALLEL} en paralelo)...`);

  for (let batchStart = 0; batchStart < orders.length; batchStart += PARALLEL) {
    const batch = orders.slice(batchStart, batchStart + PARALLEL);
    const batchPromises = batch.map(async (order, batchIdx) => {
      const globalIdx = batchStart + batchIdx;
      const p = await browser.newPage();
      p.setDefaultTimeout(120000);
      await p.setViewport({ width: 1920, height: 1080 });
      
      await p.setRequestInterception(true);
      p.on("request", (req) => {
        try {
          const url = req.url();
          if (url.includes("analytics") || url.includes("doubleclick") || url.includes("googleadservices") || url.includes("pagead2")) req.abort();
          else req.continue();
        } catch (_) {}
      });

      try {
        console.log(`\n[${globalIdx + 1}/${orders.length}] OT ${order.ot} | ${order.ciudad || "N/A"}`);
        const cleanURL2 = FORM_URL + '?_t=' + Date.now() + Math.random();
        await p.goto(cleanURL2, { waitUntil: "networkidle2", timeout: 120000 });
        await delay(2000);
        await clearFormFields(p);
        
        const completado = await agentLoop(p, order, async (page2, order2) => {
          const fields = await getFields(page2);
          let filled = 0, total = 0;
          for (const f of fields) {
            const m = matchField(f.title, order2);
            if (!m) continue;
            total++;
            if (m.type === "text") { if (await fillText(page2, f.idx, m.value)) filled++; }
            else if (m.type === "dropdown") { if (await selectDropdown(page2, f.idx, m.value)) filled++; }
            else if (m.type === "radio") { if (await selectRadio(page2, f.idx, m.value)) filled++; }
          }
          return { filled, total, fields };
        });

        if (completado) {
          console.log(`  OT ${order.ot} COMPLETADA`);
          fs.appendFileSync(path.join(__dirname, "reporte_diario.txt"), `OT ${order.ot} COMPLETADA\n`);
        } else {
          console.log(`  OT ${order.ot} FALLIDA`);
          fs.appendFileSync(path.join(__dirname, "reporte_diario.txt"), `OT ${order.ot} FALLIDA\n`);
        }
      } catch (e) {
        console.error(`  ERROR OT ${order.ot}: ${e.message.substring(0, 200)}`);
        fs.appendFileSync(path.join(__dirname, "reporte_diario.txt"), `ERROR OT ${order.ot}: ${e.message.substring(0, 200)}\n`);
      } finally {
        try { await p.close(); } catch(_) {}
      }
    });
    await Promise.all(batchPromises);
    console.log(`\nLote ${Math.floor(batchStart / PARALLEL) + 1} completado\n`);
  }

  console.log("\nTODAS LAS ORDENES COMPLETADAS!");
  fs.appendFileSync(path.join(__dirname, "reporte_diario.txt"), "\nTODAS COMPLETADAS\n");
})().catch(e => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
