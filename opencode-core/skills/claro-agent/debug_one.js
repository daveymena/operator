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

  await page.goto("https://mail.google.com/mail/u/0/", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(4000);

  // Just test with OT 7725439
  await page.goto("https://mail.google.com/mail/u/0/#search/7725439", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(5000);

  const count = await page.evaluate(() => document.querySelectorAll("tr.zA").length);
  console.log("Results for 7725439:", count);

  // Get subject and snippet of first result
  const firstInfo = await page.evaluate(() => {
    const r = document.querySelector("tr.zA");
    if (!r) return "none";
    const subj = r.querySelector("span.bog");
    const snip = r.querySelector("span.y2");
    return {
      subject: subj ? subj.innerText : "no subject",
      snippet: snip ? snip.innerText : "no snippet",
      html: r.innerHTML.substring(0, 500)
    };
  });
  console.log("Subject:", firstInfo.subject);
  console.log("Snippet:", firstInfo.snippet);

  // Click first result
  await page.evaluate(() => { const r = document.querySelector("tr.zA"); if (r) r.click(); });
  await delay(6000);

  // Log current URL
  console.log("Current URL:", await page.url());

  // Try to find "Correo" in the body
  const hasCorreo = await page.evaluate(() => {
    const body = document.body.innerText;
    const idx = body.indexOf("Correo");
    if (idx > 0) return body.substring(Math.max(0, idx-20), idx + 100);
    return "NOT FOUND";
  });
  console.log("Around 'Correo':", hasCorreo);

  // Also check the a3s element
  const a3s = await page.evaluate(() => {
    const el = document.querySelector(".a3s");
    if (!el) return "NO a3s";
    return el.innerText.substring(0, 3000);
  });
  console.log("\na3s content (first 2000):");
  console.log(a3s.substring(0, 2000));

  await browser.close();
})().catch(e => { console.error("ERR:", e); process.exit(1); });
