const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const path = require("path");
const fs = require("fs");

const DIR = __dirname;
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const linkPath = path.join(DIR, "real_user_data_link");
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
  await page.goto("https://www.google.com", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(2000);
  let text = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => "");
  if (!text.includes("Acceder") && !text.includes("Iniciar sesi")) {
    console.log("Sesion Gmail activa");
    return true;
  }
  console.log("Auto-login en Google...");
  await page.goto("https://accounts.google.com/signin", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(2000);
  await waitAndType(page, 'input[type="email"], input[name="identifier"]', EMAIL);
  await waitAndClick(page, '#identifierNext, button[jsname*="V67aGc"]');
  await delay(3000);
  await waitAndType(page, 'input[type="password"], input[name="Passwd"]', PASSWORD);
  await waitAndClick(page, '#passwordNext, button[jsname*="V67aGc"]');
  await delay(5000);
  return true;
}

(async () => {
  console.log("Matando Chrome...");
  try { require("child_process").execSync("taskkill /F /IM chrome.exe 2>nul", { stdio: "pipe" }); } catch(e) {}
  await delay(3000);

  console.log("Lanzando Chrome con Profile 2...");
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    userDataDir: linkPath,
    headless: false,
    args: ["--profile-directory=Profile 2", "--start-maximized", "--disable-blink-features=AutomationControlled", "--no-first-run", "--no-default-browser-check"],
    defaultViewport: null,
  });

  const [page] = await browser.pages();
  page.setDefaultTimeout(30000);
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    try { const url = req.url(); if (url.includes("analytics") || url.includes("doubleclick") || url.includes("googleadservices") || url.includes("pagead2")) req.abort(); else req.continue(); } catch (_) {}
  });

  await ensureSession(page);

  console.log("Abriendo Gmail...");
  await page.goto("https://mail.google.com/mail/u/0/", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(5000);

  const inboxCheck = await page.evaluate(() => document.body.innerText.substring(0, 300)).catch(() => "");
  if (inboxCheck.includes("Iniciar sesi")) { console.log("No se pudo autenticar"); await browser.close(); return; }
  console.log("Inbox OK");

  console.log("Buscando confirmaciones...");
  await page.evaluate(() => {
    const sb = document.querySelector('input[aria-label*="Buscar"], input[aria-label*="Search"], input[name="q"]');
    if (sb) { sb.value = ""; }
  });
  await delay(500);
  const searchBox = await page.$('input[aria-label*="Buscar"], input[aria-label*="Search"]');
  if (searchBox) {
    await searchBox.click();
    await delay(300);
    await searchBox.type("Gracias por completar el formulario Orden de Trabajo Virtual", { delay: 10 });
    await delay(500);
    await page.keyboard.press("Enter");
    await delay(5000);
  }

  let resultados = [];
  const seen = new Set();

  for (let idx = 0; idx < 50; idx++) {
    await delay(1000);
    const count = await page.evaluate(() => document.querySelectorAll("tr.zA").length);
    if (idx >= count) { console.log("Total correos:", count); break; }

    await page.evaluate((i) => { const r = document.querySelectorAll("tr.zA"); if (r[i]) r[i].click(); }, idx);
    await delay(5000);

    const body = await page.evaluate(() => {
      const el = document.querySelector(".a3s");
      return el ? el.innerText : "";
    });

    if (!body) { console.log("  sin contenido"); continue; }

    const lines = body.split("\n").map(l => l.trim()).filter(l => l);
    let correo = "", orden = "";
    for (let li = 0; li < lines.length; li++) {
      const l = lines[li];
      if ((l.includes("Correo electrónico") || l === "Correo electrónico *") && !correo) {
        for (let j = li + 1; j < Math.min(li + 10, lines.length); j++) {
          if (lines[j] && lines[j].length > 4 && !lines[j].includes("*") && !lines[j].includes("Correo")) {
            correo = lines[j]; break;
          }
        }
      }
      if ((l === "Orden *" || l === "Orden" || l === "Orden*") && !orden) {
        for (let j = li + 1; j < Math.min(li + 5, lines.length); j++) {
          if (lines[j] && lines[j].length > 3 && !lines[j].includes("*")) {
            orden = lines[j].replace(/_L_CO_\d+/g, "").trim(); break;
          }
        }
      }
    }

    if (orden && seen.has(orden)) { console.log("  duplicado"); continue; }
    if (orden) seen.add(orden);

    const esNumero = correo && /^[\d\s\-\(\)]+$/.test(correo.replace(/\s/g, ""));
    const problema = !!correo && esNumero;
    resultados.push({ orden, correo, problema });
    console.log("  OT " + (orden || "?") + " | Correo: " + (correo || "?") + (problema ? " <<< PROBLEMA" : ""));

    await page.goto("https://mail.google.com/mail/u/0/#search/Gracias+por+completar+el+formulario+Orden+de+Trabajo+Virtual", { waitUntil: "networkidle2", timeout: 30000 });
    await delay(3000);
  }

  console.log("\n========================================");
  const prob = resultados.filter(r => r.problema);
  console.log("Total: " + resultados.length + " | Con telefono en correo: " + prob.length);
  for (const r of prob) console.log("  OT " + r.orden + " -> \"" + r.correo + "\"");
  console.log("\nTodas:");
  for (const r of resultados) console.log("  OT " + (r.orden || "?") + " | " + (r.correo || "?") + (r.problema ? " ** PROBLEMA **" : ""));
  fs.writeFileSync("gmail_check_result.json", JSON.stringify(resultados, null, 2));
  await browser.close();
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
