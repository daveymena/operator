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
  await delay(5000);
  const check = await page.evaluate(() => document.body.innerText.substring(0, 300));
  if (check.includes("Acceder")) { console.log("No autenticado"); await browser.close(); return; }

  // Use search box to search for OT confirmation emails
  const searchBox = await page.$('input[aria-label*="Buscar"], input[name="q"], input[aria-label*="Search"]');
  if (!searchBox) { console.log("No search box found"); await browser.close(); return; }
  await searchBox.click();
  await searchBox.click({ clickCount: 3 });
  await searchBox.type('subject:"Gracias por completar el formulario Orden de Trabajo Virtual"', { delay: 10 });
  await delay(1000);
  await page.keyboard.press("Enter");
  await delay(8000);

  const total = await page.evaluate(() => document.querySelectorAll("tr.zA").length);
  console.log("Resultados:", total);

  const allOts = JSON.parse(fs.readFileSync("ordenes_procesadas.json", "utf8")).map(o => o.ot);
  const found = [];

  for (let idx = 0; idx < total; idx++) {
    await page.evaluate((i) => { const r = document.querySelectorAll("tr.zA"); if (r[i]) r[i].click(); }, idx);
    await delay(6000);

    // Get the view full message link URL
    const viewFullUrl = await page.evaluate(() => {
      const a = document.querySelector('a[href*="view=lg"]');
      return a ? a.href : null;
    });

    let bodyFull = "";
    if (viewFullUrl) {
      try {
        const np = await browser.newPage();
        await np.goto(viewFullUrl, { waitUntil: "networkidle2", timeout: 20000 });
        await delay(3000);
        bodyFull = await np.evaluate(() => document.body.innerText);
        await np.close();
      } catch(e) { console.log("Error full view:", e.message); }
    } else {
      bodyFull = await page.evaluate(() => {
        const el = document.querySelector(".a3s");
        return el ? el.innerText : "";
      });
    }

    const lines = bodyFull.split("\n").map(l => l.trim()).filter(l => l);
    let correo = "", orden = "";
    for (let li = 0; li < lines.length; li++) {
      const l = lines[li];
      if (l.includes("Correo electrónico")) {
        for (let j = li + 1; j < Math.min(li + 20, lines.length); j++) {
          const v = lines[j];
          if (v && v.length >= 5 && !v.includes("*") && !v.includes("Correo") && !v.match(/^[-=]+$/) && !v.startsWith("_")) {
            correo = v; break;
          }
        }
      }
      if (l === "Orden" || l === "Orden *" || l === "Orden*" || l.startsWith("Orden")) {
        for (let j = li + 1; j < Math.min(li + 20, lines.length); j++) {
          const v = lines[j];
          if (v && v.length >= 3 && !v.includes("*") && !v.match(/^[-=]+$/) && !v.startsWith("_")) {
            orden = v.replace(/_L_CO_\d+/g, "").replace(/\s/g, "").trim(); break;
          }
        }
      }
    }

    const esNum = correo && /^\d[\d\s\-\(\)]*\d$/.test(correo.replace(/\s/g, ""));
    found.push({ orden, correo, problema: !!correo && esNum });
    console.log("  [" + (idx+1) + "/" + total + "] OT " + (orden || "?") + " | " + (correo || "?") + (esNum && correo ? " PROBLEMA" : ""));

    // Go back to search results
    await page.goto("https://mail.google.com/mail/u/0/", { waitUntil: "networkidle2", timeout: 30000 });
    await delay(3000);
  }

  console.log("\n========================================");
  const prob = found.filter(f => f.problema);
  console.log("Total:" + found.length + " | Con problema:" + prob.length);
  for (const f of prob) console.log("  OT " + (f.orden||"?") + " -> \"" + (f.correo||"") + "\"");
  console.log("\n--- COMPLETA ---");
  for (const f of found) console.log("  OT " + (f.orden||"?") + " | " + (f.correo||"?") + (f.problema ? " PROBLEMA" : ""));
  fs.writeFileSync("gmail_check_v2.json", JSON.stringify(found, null, 2));
  await browser.close();
})().catch(e => { console.error("ERR:", e); process.exit(1); });
