const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const path = require("path");
const fs = require("fs");

const DIR = __dirname;
const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfd9f3bIBYdrMps4YlASFWr2Zsg81eiIsXF8wtq2bZ_xaSsYA/viewform";

(async () => {
  console.log("Bootstrap iniciando...");
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    userDataDir: path.join(DIR, "real_user_data_link"),
    headless: false,
    args: ["--profile-directory=Profile 2", "--start-maximized", "--disable-blink-features=AutomationControlled"],
    defaultViewport: null,
  });

  const [page] = await browser.pages();
  await page.setViewport({ width: 1920, height: 1080 });

  console.log("Navegando al formulario...");
  await page.goto(FORM_URL + "?_t=" + Date.now(), { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  // Save screenshot
  const shot = await page.screenshot({ path: path.join(DIR, "_current.png"), fullPage: false });
  console.log("Screenshot guardado: _current.png");

  // Get page text
  const text = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  fs.writeFileSync(path.join(DIR, "_page.txt"), text);
  console.log("Texto guardado: _page.txt");

  // Get DOM structure summary
  const dom = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[role="listitem"]'));
    return items.map((item, i) => {
      const h = item.querySelector('[role="heading"]');
      const inp = item.querySelector('input.whsOnd, input[type="text"], input[type="email"], input[type="number"]');
      const sel = item.querySelector('[role="listbox"]');
      const radios = Array.from(item.querySelectorAll('[role="radio"]')).map(r => r.getAttribute("data-value") || r.textContent.trim());
      const title = h ? h.textContent.trim() : "";
      return {
        idx: i, title,
        type: inp ? "input" : sel ? "select" : radios.length > 0 ? "radio" : "unknown",
        value: inp ? inp.value : "",
        options: sel ? Array.from(document.querySelectorAll('[role="option"]')).map(o => o.textContent.trim()).filter(t => t.length > 0) : radios
      };
    });
  });
  fs.writeFileSync(path.join(DIR, "_fields.json"), JSON.stringify(dom, null, 2));
  console.log("Campos guardados: _fields.json (" + dom.length + " campos)");

  console.log("\nListo. Chrome abierto. Esperando instrucciones...");
  console.log("Browser PID:", browser.process().pid);
  
  // Keep alive
  process.on("SIGINT", async () => { await browser.close(); process.exit(); });
  await new Promise(() => {}); // keeps running
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
