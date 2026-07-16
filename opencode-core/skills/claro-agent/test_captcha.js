const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const path = require("path");
const { solveCaptchaMultiRound } = require("./captcha_solver_final.js");

const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfd9f3bIBYdrMps4YlASFWr2Zsg81eiIsXF8wtq2bZ_xaSsYA/viewform";
const FIXED = {
  correo: "daveymena16@gmail.com", cedulaTecnico: "1077449318",
  nombreTecnico: "Duvier Davey Mena Mosquera", telefono: "3136174267",
};

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    userDataDir: path.join(__dirname, "real_user_data_link"),
    headless: false,
    args: ["--profile-directory=Profile 2", "--start-maximized", "--disable-blink-features=AutomationControlled"],
    defaultViewport: null,
  });
  const [page] = await browser.pages();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.goto(FORM_URL + "?_t=" + Date.now(), { waitUntil: "networkidle2", timeout: 60000 });
  await delay(3000);

  for (let p = 0; p < 30; p++) {
    const body = await page.evaluate(() => document.body.innerText.substring(0, 300)).catch(() => "");
    if (body.includes("gracias") || body.includes("enviada") || body.includes("otra respuesta")) {
      console.log("Formulario ya enviado!");
      break;
    }

    const captchaVisible = await page.evaluate(() => {
      const iframe = document.querySelector('iframe[title*="recaptcha challenge"]');
      return !!(iframe && iframe.offsetWidth > 0 && iframe.offsetHeight > 0 && window.getComputedStyle(iframe).visibility !== "hidden");
    }).catch(() => false);

    if (captchaVisible) {
      console.log("\n*** CAPTCHA DETECTADO ***");
      const ok = await solveCaptchaMultiRound(page);
      console.log("Resultado: " + (ok ? "SUPERADO" : "FALLIDO"));
      await delay(2000);
      continue;
    }

    const fields = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[role="listitem"]')).map((item, i) => {
        const h = item.querySelector('[role="heading"]');
        const title = h ? h.textContent.trim().toLowerCase() : "";
        return {
          i, title,
          inp: !!item.querySelector('input.whsOnd, input[type="text"], input[type="email"], input[type="number"]'),
          sel: !!item.querySelector('[role="listbox"]'),
          radios: Array.from(item.querySelectorAll('[role="radio"]')).map(r => r.getAttribute("data-value") || r.textContent.trim())
        };
      });
    });

    for (const f of fields) {
      if (f.inp) {
        let v = "test";
        if (f.title.includes("correo") || f.title.includes("email")) v = FIXED.correo;
        else if (f.title.includes("cedula") && f.title.includes("tec")) v = FIXED.cedulaTecnico;
        else if (f.title.includes("nombre") && f.title.includes("tec")) v = FIXED.nombreTecnico;
        else if (f.title.includes("telefono") || f.title.includes("celular")) v = FIXED.telefono;
        else if (f.title.includes("orden")) v = "12345";
        else if (f.title.includes("cuenta")) v = "12345";
        else if (f.title.includes("nodo")) v = "NODO1";
        await page.evaluate(([i, val]) => {
          const item = document.querySelectorAll('[role="listitem"]')[i];
          const inp = item.querySelector('input.whsOnd, input[type="text"], input[type="email"], input[type="number"]');
          if (inp) { inp.value = val; inp.dispatchEvent(new Event("input", { bubbles: true })); }
        }, [f.i, v]);
        console.log("  Campo \"" + f.title.substring(0, 25) + "\" = \"" + v + "\"");
      } else if (f.sel) {
        try {
          await page.evaluate((i) => {
            const item = document.querySelectorAll('[role="listitem"]')[i];
            const lb = item.querySelector('[role="listbox"]');
            if (lb) lb.click();
          }, f.i);
          await delay(1000);
          const opts = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('[role="option"]'))
              .map(o => o.textContent.trim()).filter(t => t.length > 0 && !t.toLowerCase().includes("elige"));
          });
          if (opts.length > 0) {
            let selected = opts.find(o => o.toLowerCase().includes("cali"));
            if (!selected) selected = opts[0];
            await page.evaluate((val) => {
              const opts2 = document.querySelectorAll('[role="option"]');
              for (const o of opts2) {
                if (o.textContent.trim() === val) { o.click(); return; }
              }
            }, selected);
            console.log("  Select \"" + f.title.substring(0, 25) + "\" = \"" + selected + "\"");
          }
          await delay(500);
        } catch (e) { console.log("  Select error: " + e.message); }
      } else if (f.radios.length > 0) {
        const val = f.title.includes("material") ? "Si" : f.radios[0];
        await page.evaluate(([i, v]) => {
          const item = document.querySelectorAll('[role="listitem"]')[i];
          const radios = item.querySelectorAll('[role="radio"]');
          for (const r of radios) {
            if (r.getAttribute("data-value") === v || r.textContent.trim() === v) { r.click(); return; }
          }
          radios[0].click();
        }, [f.i, val]);
        console.log("  Radio \"" + f.title.substring(0, 25) + "\" = \"" + val + "\"");
        await delay(300);
      }
    }

    await delay(500);

    const btn = await page.evaluate(() => {
      const btns = document.querySelectorAll('[role="button"], button');
      for (const b of btns) {
        const t = (b.textContent || "").trim().toLowerCase();
        if (t === "siguiente" || t === "next" || t === "enviar" || t === "submit" || t.includes("siguiente") || t.includes("enviar")) {
          b.click(); return t;
        }
      }
      return "none";
    });
    console.log("Boton clickeado: " + btn);
    await delay(3000);
  }

  await browser.close();
  console.log("\nTest completado");
})().catch(e => { console.error("ERROR:", e.message, e.stack?.substring(0, 500)); process.exit(1); });
