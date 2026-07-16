const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const path = require("path");
const fs = require("fs");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PROFILE = path.join(__dirname, "perfil_chrome");
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chromePath, userDataDir: PROFILE, headless: false,
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
    defaultViewport: null,
  });
  const [page] = await browser.pages();
  page.setDefaultTimeout(30000);

  // Use /u/1/ as shown by user
  await page.goto("https://mail.google.com/mail/u/1/", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(5000);

  console.log("URL:", await page.url());
  const header = await page.evaluate(() => {
    const img = document.querySelector('img[alt*="@gmail"]');
    if (img) return img.alt;
    const txt = document.body.innerText.substring(0, 500);
    return txt;
  });
  console.log("Header/body:", header.substring(0, 200));

  // Check if logged in
  const check = await page.evaluate(() => document.body.innerText.substring(0, 300));
  if (check.includes("Acceder") || check.includes("Iniciar sesi")) {
    console.log("No autenticado en u/1, probando u/0...");
    await page.goto("https://mail.google.com/mail/u/0/", { waitUntil: "networkidle2", timeout: 30000 });
    await delay(4000);
    console.log("URL:", await page.url());
    const check0 = await page.evaluate(() => document.body.innerText.substring(0, 300));
    if (check0.includes("Acceder")) { console.log("No autenticado en ninguna"); await browser.close(); return; }
  }

  console.log("\nBuscando OT 7725439...");
  await page.goto("https://mail.google.com/mail/u/0/#search/7725439", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(5000);
  console.log("URL:", await page.url());

  const count = await page.evaluate(() => document.querySelectorAll("tr.zA").length);
  console.log("Results:", count);

  if (count > 0) {
    const info = await page.evaluate(() => {
      const r = document.querySelector("tr.zA");
      const subj = r.querySelector("span.bog");
      const snip = r.querySelector("span.y2");
      return {
        subject: subj ? subj.innerText : "no subject",
        snippet: snip ? snip.innerText : "no snippet"
      };
    });
    console.log("Subject:", info.subject);
    console.log("Snippet:", info.snippet);

    await page.evaluate(() => { const r = document.querySelector("tr.zA"); if (r) r.click(); });
    await delay(6000);
    console.log("After click URL:", await page.url());

    const body = await page.evaluate(() => {
      const el = document.querySelector(".a3s");
      if (!el) return "NO a3s element";
      return el.innerText;
    });
    console.log("\n--- a3s content ---");
    console.log(body.substring(0, 3000));
  }

  await browser.close();
})().catch(e => { console.error("ERR:", e); process.exit(1); });
