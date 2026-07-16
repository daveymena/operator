const puppeteer = require("puppeteer");
const fs = require("fs");
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  console.log("Conectando a Chrome (Profile 10)...");
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222" });
  const pages = await browser.pages();
  const page = pages[0];

  await page.goto("https://mail.google.com/mail/u/0/", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(5000);

  const check = await page.evaluate(() => document.body.innerText.substring(0, 300)).catch(() => "");
  console.log("Gmail:", check.substring(0, 150));

  if (check.includes("Iniciar sesi") || check.includes("Acceder")) {
    console.log("No autenticado. Revisando si es la pagina de login...");
    // Maybe go to Gmail search directly
  }

  await page.goto("https://mail.google.com/mail/u/0/#search/Gracias+por+completar+el+formulario+Orden+de+Trabajo+Virtual", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(6000);

  let resultados = [];
  const seen = new Set();
  const count = await page.evaluate(() => document.querySelectorAll("tr.zA").length);
  console.log("Resultados busqueda:", count);

  for (let idx = 0; idx < count; idx++) {
    await page.evaluate((i) => { const r = document.querySelectorAll("tr.zA"); if (r[i]) r[i].click(); }, idx);
    await delay(4000);

    const body = await page.evaluate(() => {
      const el = document.querySelector(".a3s");
      return el ? el.innerText : "";
    });
    if (!body) { console.log("  [" + (idx+1) + "] sin contenido"); continue; }

    const lines = body.split("\n").map(l => l.trim()).filter(l => l);
    let correo = "", orden = "";
    for (let li = 0; li < lines.length; li++) {
      const l = lines[li];
      if ((l.includes("Correo electrónico") || l === "Correo electrónico *") && !correo) {
        for (let j = li + 1; j < Math.min(li + 10, lines.length); j++) {
          if (lines[j] && lines[j].length > 4 && !lines[j].includes("*") && !lines[j].includes("Correo")) {
            correo = lines[j]; break;
          }
        }
      }
      if ((l === "Orden *" || l === "Orden" || l === "Orden*") && !orden) {
        for (let j = li + 1; j < Math.min(li + 5, lines.length); j++) {
          if (lines[j] && lines[j].length > 3 && !lines[j].includes("*")) {
            orden = lines[j].replace(/_L_CO_\d+/g, "").trim(); break;
          }
        }
      }
    }

    if (orden && seen.has(orden)) { console.log("  duplicado"); continue; }
    if (orden) seen.add(orden);

    const esNum = correo && /^\d[\d\s\-\(\)]*\d$/.test(correo.replace(/\s/g, ""));
    const prob = !!correo && esNum;
    resultados.push({ orden, correo, problema: prob });
    console.log("  OT " + (orden || "?") + " | Correo: " + (correo || "?") + (prob ? " <<< PROBLEMA" : ""));

    await page.goto("https://mail.google.com/mail/u/0/#search/Gracias+por+completar+el+formulario+Orden+de+Trabajo+Virtual", { waitUntil: "networkidle2", timeout: 30000 });
    await delay(3000);
  }

  console.log("\n========================================");
  const probList = resultados.filter(r => r.problema);
  console.log("Total correos: " + resultados.length + " | Con telefono: " + probList.length);
  for (const r of probList) console.log("  OT " + r.orden + " -> \"" + r.correo + "\"");
  console.log("\nCOMPLETA:");
  for (const r of resultados) console.log("  OT " + (r.orden || "?") + " | " + (r.correo || "?") + (r.problema ? " ** PROBLEMA **" : ""));
  fs.writeFileSync("gmail_check_result.json", JSON.stringify(resultados, null, 2));
  console.log("\nGuardado en gmail_check_result.json");
  await browser.disconnect();
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
