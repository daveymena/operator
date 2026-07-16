const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const path = require("path");
const fs = require("fs");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DIR = __dirname;
const PROFILE = path.join(DIR, "perfil_chrome");

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chromePath, userDataDir: PROFILE, headless: false,
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
    defaultViewport: null,
  });
  const [page] = await browser.pages();
  page.setDefaultTimeout(30000);

  await page.goto("https://mail.google.com/mail/u/0/", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(5000);

  const check = await page.evaluate(() => document.body.innerText.substring(0, 300)).catch(() => "");
  if (check.includes("Acceder")) { console.log("No autenticado"); await browser.close(); return; }

  console.log("Buscando...");
  await page.goto("https://mail.google.com/mail/u/0/#search/Gracias+por+completar+el+formulario+Orden+de+Trabajo+Virtual", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(8000);

  // Process only first 3 to debug
  for (let idx = 0; idx < 3; idx++) {
    await page.evaluate((i) => { const r = document.querySelectorAll("tr.zA"); if (r[i]) r[i].click(); }, idx);
    await delay(5000);

    const {html, text} = await page.evaluate(() => {
      const el = document.querySelector(".a3s");
      return { html: el ? el.innerHTML.substring(0, 3000) : "", text: el ? el.innerText.substring(0, 2000) : "" };
    });

    console.log("\n=== EMAIL " + (idx+1) + " ===");
    console.log("--- TEXT ---");
    console.log(text.substring(0, 1000));
    console.log("--- HTML (primeros 1500) ---");
    console.log(html.substring(0, 1500));

    await page.goto("https://mail.google.com/mail/u/0/#search/Gracias+por+completar+el+formulario+Orden+de+Trabajo+Virtual", { waitUntil: "networkidle2", timeout: 30000 });
    await delay(3000);
  }

  await browser.close();
})().catch(e => { console.error("ERR:", e); process.exit(1); });
