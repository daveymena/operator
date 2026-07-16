const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const path = require("path");
const fs = require("fs");

const DIR = __dirname;
const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfd9f3bIBYdrMps4YlASFWr2Zsg81eiIsXF8wtq2bZ_xaSsYA/viewform";

const DATA = {
  correo: "daveymena16@gmail.com",
  ciudad: "Cali",
  cuenta: "2133956",
  nodo: "OCDGCF",
  orden: "7735847",
  tipoTrabajo: "MANTENIMIENTOS FTTH",
  cedulaTec: "1077449318",
  nombreTec: "Duvier Davey Mena Mosquera",
  cedulaAux: "0",
  nombreAux: "X",
  aplicaMaterial: "No",
};

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  console.log("Iniciando Chrome...");
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    userDataDir: path.join(DIR, "real_user_data_link"),
    headless: false,
    args: ["--profile-directory=Profile 2", "--start-maximized"],
    defaultViewport: null,
  });

  const [page] = await browser.pages();
  await page.setViewport({ width: 1920, height: 1080 });

  console.log("Abriendo formulario...");
  await page.goto(FORM_URL + "?_t=" + Date.now(), { waitUntil: "networkidle2", timeout: 60000 });
  await delay(3000);

  // Grab screenshot of page 1
  await page.screenshot({ path: path.join(DIR, "p1_initial.png") });

  // --- FILL PAGE 1 ---
  
  // Helper: fill text input by heading text
  async function fillInput(heading, value) {
    const idx = await page.evaluate((h) => {
      const items = document.querySelectorAll('[role="listitem"]');
      for (let i = 0; i < items.length; i++) {
        const hd = items[i].querySelector('[role="heading"]');
        if (hd && hd.textContent.trim().toLowerCase().includes(h.toLowerCase())) return i;
      }
      return -1;
    }, heading);
    if (idx < 0) { console.log("  No encontre: " + heading); return false; }
    
    for (let n = 0; n < 5; n++) {
      const el = await page.evaluateHandle((i) => {
        const items = document.querySelectorAll('[role="listitem"]');
        return items[i]?.querySelector('input.whsOnd, input[type="text"], input[type="email"], input[type="number"]');
      }, idx);
      if (!el || !el.asElement()) { await delay(300); continue; }
      try {
        await el.asElement().click();
        await delay(100);
        await page.keyboard.down("Control");
        await page.keyboard.press("a");
        await page.keyboard.up("Control");
        await delay(50);
        await page.keyboard.press("Backspace");
        await delay(100);
        await page.keyboard.type(String(value), { delay: 10 });
        await delay(200);
        const cur = await page.evaluate((i) => {
          const items = document.querySelectorAll('[role="listitem"]');
          return items[i]?.querySelector("input.whsOnd")?.value || "";
        }, idx);
        if (String(cur) === String(value)) { console.log("  OK " + heading + " = " + value); return true; }
      } catch (e) { console.log("  Error: " + e.message); }
      await el.asElement()?.dispose().catch(()=>{});
      await delay(300);
    }
    console.log("  FALLO " + heading);
    return false;
  }

  // Helper: select dropdown by heading
  async function selectDropdown(heading, value) {
    const idx = await page.evaluate((h) => {
      const items = document.querySelectorAll('[role="listitem"]');
      for (let i = 0; i < items.length; i++) {
        const hd = items[i].querySelector('[role="heading"]');
        if (hd && hd.textContent.trim().toLowerCase().includes(h.toLowerCase())) return i;
      }
      return -1;
    }, heading);
    if (idx < 0) { console.log("  No encontre: " + heading); return false; }

    for (let n = 0; n < 6; n++) {
      const listbox = await page.evaluateHandle((i) => {
        const items = document.querySelectorAll('[role="listitem"]');
        return items[i]?.querySelector('[role="listbox"]');
      }, idx);
      if (!listbox || !listbox.asElement()) { await delay(300); continue; }
      try {
        await listbox.asElement().scrollIntoView({ block: "center" });
        await delay(200);
        await listbox.asElement().click();
        await delay(1500);
        const ok = await page.evaluate((v) => {
          const opts = document.querySelectorAll('[role="option"]');
          for (const o of opts) {
            if (o.textContent.trim().toLowerCase() === v.toLowerCase()) {
              o.scrollIntoView({ block: "center" });
              o.click();
              return true;
            }
          }
          return false;
        }, value);
        if (ok) { console.log("  OK " + heading + " = " + value); return true; }
      } catch (e) {}
      await listbox.asElement()?.dispose().catch(()=>{});
      await delay(400);
    }
    console.log("  FALLO " + heading);
    return false;
  }

  // Helper: select radio by heading
  async function selectRadio(heading, value) {
    const idx = await page.evaluate((h) => {
      const items = document.querySelectorAll('[role="listitem"]');
      for (let i = 0; i < items.length; i++) {
        const hd = items[i].querySelector('[role="heading"]');
        if (hd && hd.textContent.trim().toLowerCase().includes(h.toLowerCase())) return i;
      }
      return -1;
    }, heading);
    if (idx < 0) { console.log("  No encontre: " + heading); return false; }

    for (let n = 0; n < 5; n++) {
      const radio = await page.evaluateHandle(([i, v]) => {
        const items = document.querySelectorAll('[role="listitem"]');
        const radios = items[i]?.querySelectorAll('[role="radio"]');
        if (!radios) return null;
        for (const r of radios) {
          if (r.getAttribute("data-value") === v || r.textContent.trim().toLowerCase() === v.toLowerCase()) return r;
        }
        return null;
      }, [idx, value]);
      if (!radio || !radio.asElement()) { await delay(300); continue; }
      try {
        await radio.asElement().scrollIntoView({ block: "center" });
        await delay(200);
        await radio.asElement().click();
        await delay(500);
        console.log("  OK " + heading + " = " + value);
        return true;
      } catch (e) {}
      await radio.asElement()?.dispose().catch(()=>{});
      await delay(300);
    }
    console.log("  FALLO " + heading);
    return false;
  }

  // ---- FILL ALL FIELDS ----
  console.log("\nLlenando pagina 1...");
  await fillInput("Correo", DATA.correo);
  await selectDropdown("Ciudad", DATA.ciudad);
  await fillInput("Cuenta", DATA.cuenta);
  await fillInput("Nodo", DATA.nodo);
  await fillInput("Orden", DATA.orden);
  await selectDropdown("Tipo de Trabajo", DATA.tipoTrabajo);
  await fillInput("Cedula Tecnico", DATA.cedulaTec);
  await fillInput("Nombre del Tecnico", DATA.nombreTec);
  await fillInput("Cedula Auxiliar", DATA.cedulaAux);
  await fillInput("Nombre del Auxiliar", DATA.nombreAux);
  await selectRadio("Aplica Material", DATA.aplicaMaterial);

  await delay(1000);
  await page.screenshot({ path: path.join(DIR, "p1_filled.png") });

  // Click Siguiente
  console.log("\nClick Siguiente...");
  await page.evaluate(() => {
    const btns = document.querySelectorAll('[role="button"], button');
    for (const b of btns) {
      if ((b.innerText || "").trim().toLowerCase() === "siguiente") { b.click(); return; }
    }
  });
  await delay(5000);

  // Take screenshot of page 2
  await page.screenshot({ path: path.join(DIR, "p2_initial.png") });

  // Get page 2 fields
  const p2text = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  fs.writeFileSync(path.join(DIR, "p2_text.txt"), p2text);
  console.log("\n--- PAGE 2 TEXT ---");
  console.log(p2text.substring(0, 1000));

  const p2fields = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="listitem"]')).map((item, i) => {
      const h = item.querySelector('[role="heading"]');
      const inp = item.querySelector('input.whsOnd, input[type="text"], input[type="email"], input[type="number"]');
      const sel = item.querySelector('[role="listbox"]');
      const radios = Array.from(item.querySelectorAll('[role="radio"]')).map(r => r.getAttribute("data-value") || r.textContent.trim());
      return {
        idx: i, title: h ? h.textContent.trim() : "",
        type: inp ? "input" : sel ? "select" : radios.length > 0 ? "radio" : "unknown",
        value: inp ? inp.value : "",
      };
    });
  });
  fs.writeFileSync(path.join(DIR, "p2_fields.json"), JSON.stringify(p2fields, null, 2));
  console.log("\nPage 2 campos:", p2fields.length);

  await browser.close();
  console.log("\nListo!");
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
