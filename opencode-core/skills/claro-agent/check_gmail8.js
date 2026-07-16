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

  // Search from:googleforms-noreply@google.com to get only form responses
  const searchQuery = 'from:googleforms-noreply@google.com "Orden de Trabajo"';
  const sb = await page.$('input[aria-label*="Buscar"], input[aria-label*="Search"], input[name="q"]');
  if (!sb) { console.log("No search box"); await browser.close(); return; }
  await sb.click({ clickCount: 3 });
  await sb.type(searchQuery, { delay: 5 });
  await delay(500);
  await page.keyboard.press("Enter");
  await delay(8000);

  console.log("URL:", await page.url());
  let total = await page.evaluate(() => document.querySelectorAll("tr.zA").length);
  console.log("Results:", total);

  // Check subjects of first few
  const subjects = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("tr.zA")).slice(0, 5).map(r => {
      const s = r.querySelector("span.bog");
      return s ? s.innerText : "";
    });
  });
  console.log("First subjects:", subjects);

  const results = [];
  for (let idx = 0; idx < total; idx++) {
    await page.evaluate((i) => {
      const rows = document.querySelectorAll("tr.zA");
      if (rows[i]) rows[i].click();
    }, idx);
    await delay(5000);

    const viewUrl = await page.evaluate(() => {
      const a = document.querySelector('a[href*="view=lg"]');
      return a ? a.href : null;
    });

    let bodyText = "";
    if (viewUrl) {
      try {
        const np = await browser.newPage();
        await np.goto(viewUrl, { waitUntil: "networkidle2", timeout: 20000 });
        await delay(2000);
        bodyText = await np.evaluate(() => document.body.innerText);
        await np.close();
      } catch(e) { bodyText = ""; }
    } else {
      bodyText = await page.evaluate(() => { const el = document.querySelector(".a3s"); return el ? el.innerText : ""; });
    }

    const lines = bodyText.split("\n").map(l => l.trim());
    let correo = "", orden = "";
    for (let li = 0; li < lines.length; li++) {
      const l = lines[li];
      if (l.includes("Correo electrónico")) {
        for (let j = li + 1; j < Math.min(li + 5, lines.length); j++) {
          const v = lines[j];
          if (v && v.length >= 5 && !v.includes("Correo") && !v.includes("*") && !v.match(/^[-_=]+$/)) {
            correo = v; break;
          }
        }
      }
      if (l === "Orden" || l === "Orden *" || l.startsWith("Orden")) {
        for (let j = li + 1; j < Math.min(li + 5, lines.length); j++) {
          const v = lines[j].replace(/\s/g, "");
          if (v && v.length >= 3 && !v.includes("*") && !v.match(/^[-_=]+$/)) {
            orden = v; break;
          }
        }
      }
    }

    const esNum = correo && /^\d[\d\s\-\(\)]*\d$/.test(correo.replace(/\s/g, ""));
    results.push({ orden, correo, problema: !!correo && esNum });
    const mark = !!correo && esNum ? " PROBLEMA" : "";
    console.log("[" + (idx+1) + "/" + total + "] OT " + (orden || "?") + " -> " + (correo || "?") + mark);

    await page.goto("https://mail.google.com/mail/u/0/", { waitUntil: "networkidle2", timeout: 30000 });
    await delay(2000);
    const sb2 = await page.$('input[aria-label*="Buscar"], input[aria-label*="Search"], input[name="q"]');
    if (sb2) {
      await sb2.click({ clickCount: 3 });
      await sb2.type(searchQuery, { delay: 5 });
      await delay(500);
      await page.keyboard.press("Enter");
      await delay(6000);
    }
  }

  console.log("\n========================================");
  const prob = results.filter(r => r.problema);
  console.log("Total:" + results.length + " | Con problema:" + prob.length);
  for (const r of prob) console.log("  OT " + r.orden + " -> \"" + r.correo + "\"");
  console.log("\n--- COMPLETA ---");
  for (const r of results) console.log("  OT " + (r.orden||"?") + " | " + (r.correo||"?") + (r.problema ? " PROBLEMA" : ""));
  fs.writeFileSync("gmail_from_googleforms.json", JSON.stringify(results, null, 2));
  await browser.close();
})().catch(e => { console.error("ERR:", e); process.exit(1); });
