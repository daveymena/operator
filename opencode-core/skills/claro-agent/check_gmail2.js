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
  const check = await page.evaluate(() => document.body.innerText.substring(0, 300));
  if (check.includes("Acceder")) { console.log("No autenticado"); await browser.close(); return; }

  const q = 'subject:"Gracias por completar el formulario Orden de Trabajo Virtual"';
  await page.goto("https://mail.google.com/mail/u/0/#search/" + encodeURIComponent(q), { waitUntil: "networkidle2", timeout: 30000 });
  await delay(8000);

  const total = await page.evaluate(() => document.querySelectorAll("tr.zA").length);
  console.log("Resultados con subject exacto:", total);
  await page.screenshot({ path: "search_results.png" });

  const emails = [];
  for (let idx = 0; idx < total; idx++) {
    await page.evaluate((i) => { const r = document.querySelectorAll("tr.zA"); if (r[i]) r[i].click(); }, idx);
    await delay(6000);

    // Click "Ver mensaje completo" if present
    try {
      const fullMsg = await page.$('a:has-text("Ver mensaje completo"), a:has-text("View entire message")');
      if (fullMsg) { await fullMsg.click(); await delay(3000); }
    } catch(e) {}

    const body = await page.evaluate(() => {
      const el = document.querySelector(".a3s");
      return el ? el.innerText : "";
    });

    // Also try getting the printable view
    let bodyFull = body;
    if (body.includes("[Mensaje acortado]") || body.includes("[Message clipped]")) {
      const links = await page.$$("a");
      for (const link of links) {
        const href = await link.evaluate(el => el.href).catch(() => "");
        if (href.includes("&view=lg&")) {
          const newPage = await browser.newPage();
          await newPage.goto(href, { waitUntil: "networkidle2", timeout: 20000 });
          await delay(3000);
          bodyFull = await newPage.evaluate(() => document.body.innerText).catch(() => "");
          await newPage.close();
          break;
        }
      }
    }

    const lines = bodyFull.split("\n").map(l => l.trim()).filter(l => l);
    let correo = "", orden = "";
    for (let li = 0; li < lines.length; li++) {
      const l = lines[li];
      if (l.includes("Correo electrónico")) {
        for (let j = li + 1; j < Math.min(li + 15, lines.length); j++) {
          if (lines[j] && lines[j].length >= 5 && !lines[j].includes("*") && !lines[j].includes("Correo") && !lines[j].startsWith("-")) {
            correo = lines[j]; break;
          }
        }
      }
      if (l === "Orden" || l === "Orden *" || l === "Orden*") {
        for (let j = li + 1; j < Math.min(li + 15, lines.length); j++) {
          if (lines[j] && lines[j].length >= 3 && !lines[j].includes("*") && !lines[j].startsWith("-")) {
            orden = lines[j].replace(/_L_CO_\d+/g, "").trim(); break;
          }
        }
      }
    }

    const esNum = correo && /^\d[\d\s\-\(\)]*\d$/.test(correo.replace(/\s/g, ""));
    emails.push({ orden, correo, problema: !!correo && esNum });
    console.log("  [" + (idx+1) + "/" + total + "] OT " + (orden || "?") + " | " + (correo || "?") + (esNum && correo ? " PROBLEMA" : ""));

    await page.goto("https://mail.google.com/mail/u/0/#search/" + encodeURIComponent(q), { waitUntil: "networkidle2", timeout: 30000 });
    await delay(3000);
  }

  console.log("\n========================================");
  console.log("Total:" + emails.length + " | Con problema: " + emails.filter(e => e.problema).length);
  for (const e of emails) console.log("  OT " + (e.orden||"?") + " | " + (e.correo||"?") + (e.problema ? " PROBLEMA" : ""));
  fs.writeFileSync("gmail_ots.json", JSON.stringify(emails, null, 2));
  console.log("\nGuardado gmail_ots.json");
  await browser.close();
})().catch(e => { console.error("ERR:", e); process.exit(1); });
