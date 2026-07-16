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

  // Type search in the search box
  const q = 'subject:"Gracias por completar el formulario Orden de Trabajo Virtual"';
  const sb = await page.$('input[aria-label*="Buscar"], input[aria-label*="Search"], input[name="q"]');
  if (!sb) { console.log("No search box"); await browser.close(); return; }
  await sb.click({ clickCount: 3 });
  await sb.type(q, { delay: 5 });
  await delay(500);
  await page.keyboard.press("Enter");
  await delay(8000);

  // Get current URL to verify search worked
  console.log("Current URL:", await page.url());

  // See how many results
  const total = await page.evaluate(() => document.querySelectorAll("tr.zA").length);
  console.log("Results found:", total);

  // Get all visible result subjects to verify
  const subjects = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("tr.zA")).slice(0, 10).map(r => {
      const s = r.querySelector("span.bog");
      return s ? s.innerText : "";
    });
  });
  console.log("First subjects:", subjects);

  // Process each result
  const results = [];
  for (let idx = 0; idx < total; idx++) {
    await page.evaluate((i) => {
      const rows = document.querySelectorAll("tr.zA");
      if (rows[i]) rows[i].click();
    }, idx);
    await delay(6000);

    // Get full view link
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
      } catch(e) { console.log("View error:", e.message); }
    } else {
      bodyText = await page.evaluate(() => {
        const el = document.querySelector(".a3s");
        return el ? el.innerText : "";
      });
    }

    // Extract OT and correo from body
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
    console.log("[" + (idx+1) + "/" + total + "] OT " + (orden || "?") + " -> " + (correo || "?") + (esNum && correo ? " PROBLEMA" : ""));

    // Go back to search results (use navigate to search)
    await page.goto(await page.url().replace(/#.*/, "") + "#search/" + encodeURIComponent(q), { waitUntil: "networkidle2", timeout: 30000 });
    await delay(3000);
  }

  console.log("\n========================================");
  const prob = results.filter(r => r.problema);
  console.log("Total:" + results.length + " | Con problema:" + prob.length);
  for (const r of prob) console.log("  OT " + r.orden + " -> \"" + r.correo + "\"");
  console.log("\n--- COMPLETA ---");
  for (const r of results) console.log("  OT " + (r.orden||"?") + " | " + (r.correo||"?") + (r.problema ? " PROBLEMA" : ""));
  fs.writeFileSync("gmail_all.json", JSON.stringify(results, null, 2));
  console.log("\nGuardado gmail_all.json");
  await browser.close();
})().catch(e => { console.error("ERR:", e); process.exit(1); });
