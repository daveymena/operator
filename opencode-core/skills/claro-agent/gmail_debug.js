const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const path = require("path");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DIR = path.join(__dirname, "perfil_chrome");

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chromePath, userDataDir: DIR, headless: false,
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
    defaultViewport: null,
  });
  const [page] = await browser.pages();

  await page.goto("https://accounts.google.com/signin", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(3000);
  await page.screenshot({ path: "login_screen.png" });
  console.log("Screenshot login guardado");

  try {
    await page.waitForSelector('input[type="email"], input[name="identifier"]', { timeout: 10000 });
    await delay(300);
    await page.type('input[type="email"], input[name="identifier"]', "daveymena16@gmail.com", { delay: 20 });
    await delay(500);
    await page.click("#identifierNext, button[jsname*='V67aGc']");
    await delay(4000);
  } catch(e) { console.log("Fallo paso 1:", e.message); }

  try {
    await page.waitForSelector('input[type="password"], input[name="Passwd"]', { timeout: 10000 });
    await delay(300);
    await page.type('input[type="password"], input[name="Passwd"]', "6715320Dvd.", { delay: 20 });
    await delay(500);
    await page.click("#passwordNext, button[jsname*='V67aGc']");
    await delay(8000);
  } catch(e) { console.log("Fallo paso 2:", e.message); }

  await page.screenshot({ path: "after_login.png" });
  console.log("Screenshot post-login guardado");

  // Try Gmail
  await page.goto("https://mail.google.com/mail/u/0/", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(5000);
  await page.screenshot({ path: "gmail_inbox.png" });
  console.log("Screenshot gmail guardado");

  const txt = await page.evaluate(() => document.body.innerText.substring(0, 300)).catch(() => "");
  console.log("Gmail dice:", txt.substring(0, 200));

  // Search
  await page.goto("https://mail.google.com/mail/u/0/#search/Orden+de+Trabajo+Virtual", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(5000);
  await page.screenshot({ path: "gmail_search.png" });
  const rows = await page.evaluate(() => document.querySelectorAll("tr.zA").length);
  console.log("Resultados busqueda:", rows);

  await browser.close();
})().catch(e => console.error("FATAL:", e.message));
