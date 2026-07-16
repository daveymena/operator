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

  // Open u/1 directly
  await page.goto("https://mail.google.com/mail/u/1/", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(5000);
  console.log("u/1 URL:", await page.url());

  const text = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log("u/1 body:", text.substring(0, 300));

  // Try user's exact URL
  console.log("\nAbriendo URL del usuario...");
  await page.goto("https://mail.google.com/mail/u/1/?ogbl#search/7725439/FMfcgzQgMVZLKnHpNcWSSscNRTWcCWhV", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(6000);
  console.log("URL:", await page.url());

  const body = await page.evaluate(() => {
    // First try a3s
    const el = document.querySelector(".a3s");
    if (el) return { source: "a3s", content: el.innerText.substring(0, 4000) };
    return { source: "body", content: document.body.innerText.substring(0, 2000) };
  });
  console.log("Source:", body.source);
  console.log("Content:");
  console.log(body.content);

  await browser.close();
})().catch(e => { console.error("ERR:", e); process.exit(1); });
