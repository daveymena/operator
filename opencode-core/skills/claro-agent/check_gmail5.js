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

  const orders = JSON.parse(fs.readFileSync("ordenes_procesadas.json", "utf8"));
  const ots = orders.map(o => o.ot);
  const results = [];

  for (let i = 0; i < ots.length; i++) {
    const ot = ots[i];
    // Search by OT number + subject terms to narrow down to form response
    const query = ot + ' "Gracias por completar" "Orden de Trabajo Virtual"';
    await page.goto("https://mail.google.com/mail/u/0/#search/" + encodeURIComponent(query), { waitUntil: "networkidle2", timeout: 30000 });
    await delay(4000);

    const count = await page.evaluate(() => document.querySelectorAll("tr.zA").length);
    if (count === 0) {
      console.log("[" + (i+1) + "/" + ots.length + "] OT " + ot + " - no match");
      continue;
    }

    // Verify it's the right email by checking subject
    const subject = await page.evaluate(() => {
      const r = document.querySelector("tr.zA");
      if (!r) return "";
      const s = r.querySelector("span.bog");
      return s ? s.innerText : "";
    });

    if (!subject.includes("Gracias por completar")) {
      console.log("[" + (i+1) + "/" + ots.length + "] OT " + ot + " - wrong subject: " + subject.substring(0, 40));
      continue;
    }

    // Click it
    await page.evaluate(() => { const r = document.querySelector("tr.zA"); if (r) r.click(); });
    await delay(5000);

    // Get full view
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

    // Parse for "Correo electrónico"
    const lines = bodyText.split("\n").map(l => l.trim()).filter(l => l);
    let correo = "";
    for (let li = 0; li < lines.length; li++) {
      if (lines[li].includes("Correo electrónico")) {
        for (let j = li + 1; j < Math.min(li + 20, lines.length); j++) {
          const v = lines[j];
          if (v && v.length >= 5 && !v.includes("*") && !v.includes("Correo") && !v.match(/^[-=]+$/) && !v.startsWith("_")) {
            correo = v; break;
          }
        }
        break;
      }
    }

    const esNum = correo && /^\d[\d\s\-\(\)]*\d$/.test(correo.replace(/\s/g, ""));
    results.push({ ot, correo, problema: !!correo && esNum });
    const mark = !!correo && esNum ? " PROBLEMA" : "";
    console.log("[" + (i+1) + "/" + ots.length + "] OT " + ot + " -> " + (correo || "?") + mark);
  }

  console.log("\n========================================");
  const prob = results.filter(r => r.problema);
  console.log("Total encontrados: " + results.length + " | Con problema: " + prob.length);
  for (const r of prob) console.log("  OT " + r.ot + " -> \"" + r.correo + "\"");
  console.log("\n--- COMPLETA ---");
  for (const r of results) console.log("  OT " + r.ot + " | " + (r.correo || "?") + (r.problema ? " PROBLEMA" : ""));
  fs.writeFileSync("gmail_final.json", JSON.stringify(results, null, 2));
  console.log("\nGuardado gmail_final.json");
  await browser.close();
})().catch(e => { console.error("ERR:", e); process.exit(1); });
