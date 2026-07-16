const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const path = require("path");
const fs = require("fs");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DIR = __dirname;
const PROFILE = path.join(require("os").tmpdir(), "claro_gmail_" + Date.now());
const EMAIL = "daveymena16@gmail.com";
const PASSWORD = "6715320Dvd.";

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function ensureSession(page) {
  await page.goto("https://www.google.com", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(2000);
  let text = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => "");
  if (!text.includes("Acceder") && !text.includes("Iniciar sesi")) {
    console.log("Sesion activa");
    return true;
  }
  console.log("Login en Google...");
  await page.goto("https://accounts.google.com/signin", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(2000);

  const emailSel = 'input[type="email"], input[name="identifier"]';
  await page.waitForSelector(emailSel, { timeout: 15000 });
  await delay(500);
  await page.type(emailSel, EMAIL, { delay: 30 });
  await delay(500);
  await page.click("#identifierNext");
  await delay(4000);

  const passSel = 'input[type="password"], input[name="Passwd"]';
  await page.waitForSelector(passSel, { timeout: 15000 });
  await delay(500);
  await page.type(passSel, PASSWORD, { delay: 30 });
  await delay(500);
  await page.click("#passwordNext");
  await delay(8000);
  console.log("Login OK");
  return true;
}

(async () => {
  console.log("Lanzando Chrome...");
  const tempProfile = path.join(require("os").tmpdir(), "claro_gmail_" + Date.now());
  console.log("Perfil temporal:", tempProfile);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    userDataDir: tempProfile,
    headless: false,
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled", "--no-first-run", "--no-default-browser-check"],
    defaultViewport: null,
  });

  const [page] = await browser.pages();
  page.setDefaultTimeout(30000);

  await ensureSession(page);

  console.log("Abriendo Gmail...");
  await page.goto("https://mail.google.com/mail/u/0/", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(5000);

  const inboxCheck = await page.evaluate(() => document.body.innerText.substring(0, 300)).catch(() => "");
  if (inboxCheck.includes("Acceder") || inboxCheck.includes("Iniciar sesi")) {
    console.log("No se pudo acceder a Gmail. Tomando screenshot...");
    await page.screenshot({ path: "gmail_error.png" });
    await browser.close();
    return;
  }
  console.log("Gmail OK");

  console.log("Buscando confirmaciones...");
  await page.goto("https://mail.google.com/mail/u/0/#search/Gracias+por+completar+el+formulario+Orden+de+Trabajo+Virtual", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(8000);

  let resultados = [];
  const seen = new Set();
  const total = await page.evaluate(() => document.querySelectorAll("tr.zA").length);
  console.log("Resultados encontrados:", total);

  for (let idx = 0; idx < total; idx++) {
    await page.evaluate((i) => { const r = document.querySelectorAll("tr.zA"); if (r[i]) r[i].click(); }, idx);
    await delay(5000);

    const body = await page.evaluate(() => {
      const el = document.querySelector(".a3s");
      return el ? el.innerText : "";
    });

    if (!body) { console.log("  [" + (idx+1) + "] sin contenido"); continue; }

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

    const esNum = correo && /^\d[\d\s\-\(\)]*\d$/.test(correo.replace(/\s/g, ""));
    const prob = !!correo && esNum;
    resultados.push({ orden, correo, problema: prob });
    console.log("  OT " + (orden || "?") + " | Correo: " + (correo || "?") + (prob ? " <<< PROBLEMA" : ""));

    await page.goto("https://mail.google.com/mail/u/0/#search/Gracias+por+completar+el+formulario+Orden+de+Trabajo+Virtual", { waitUntil: "networkidle2", timeout: 30000 });
    await delay(3000);
  }

  console.log("\n========================================");
  const probList = resultados.filter(r => r.problema);
  console.log("Total correos: " + resultados.length + " | Con telefono en correo: " + probList.length);
  console.log("\n--- OTs CON PROBLEMA ---");
  for (const r of probList) console.log("  OT " + r.orden + " -> \"" + r.correo + "\"");
  console.log("\n--- LISTA COMPLETA ---");
  for (const r of resultados) console.log("  OT " + (r.orden || "?") + " | " + (r.correo || "?") + (r.problema ? " ** PROBLEMA **" : ""));
  fs.writeFileSync("gmail_check_result.json", JSON.stringify(resultados, null, 2));
  console.log("\nGuardado en gmail_check_result.json");
  await browser.close();
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
