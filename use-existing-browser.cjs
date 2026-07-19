const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { setTimeout: wait } = require("timers/promises");

const APP_ID = "4238613976451604";
const REDIRECT_URI = "https://developers.facebook.com/tools/explorer/callback";
const SCOPES = "pages_show_list,pages_messaging";
const TOKEN_FILE = path.join(__dirname, "page_token.txt");

function guardar(token) {
  console.log("\n============================================================");
  console.log("PAGE ACCESS TOKEN");
  console.log("============================================================");
  console.log(token);
  console.log("============================================================");
  fs.writeFileSync(TOKEN_FILE, token, "utf-8");
  console.log("[OK] Guardado en page_token.txt\n");
}

(async () => {
  console.log("Conectando al browser...");
  const browser = await puppeteer.connect({ browserURL: "http://localhost:9222" });

  // Capturar popups al instante
  browser.on("targetcreated", async (target) => {
    if (target.type() !== "page") return;
    await wait(500);
    try {
      const p = await target.page();
      const u = p.url();
      const m = u.match(/access_token=([^&]+)/);
      if (m) { guardar(m[1]); process.exit(0); }
      const ht = await p.evaluate(() => {
        const h = window.location.hash;
        return h.match(/access_token=([^&]+)/) ? RegExp.$1 : null;
      }).catch(() => null);
      if (ht) { guardar(ht); process.exit(0); }
    } catch {}
  });

  const [page] = await browser.pages();
  console.log("Pagina actual:", page.url().substring(0, 100));

  // Inyectar captura de hash
  await page.evaluateOnNewDocument(() => {
    window.__fbt = null;
    try {
      const m = window.location.hash.match(/access_token=([^&]+)/);
      if (m) window.__fbt = m[1];
    } catch {}
    window.addEventListener("hashchange", () => {
      if (!window.__fbt) {
        try {
          const m = window.location.hash.match(/access_token=([^&]+)/);
          if (m) window.__fbt = m[1];
        } catch {}
      }
    });
  });

  const url = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${SCOPES}&response_type=token,granted_scopes&auth_type=rerequest`;
  console.log(`Scopes: ${SCOPES}`);
  console.log("Navegando al dialogo OAuth...");
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});

  for (let i = 0; i < 300; i++) {
    await wait(2000);

    // Checkear todas las paginas
    const allPages = await browser.pages();
    for (const p of allPages) {
      try {
        const fbt = await p.evaluate(() => window.__fbt).catch(() => null);
        if (fbt) { guardar(fbt); browser.disconnect(); process.exit(0); }
        const ht = await p.evaluate(() => {
          const h = window.location.hash;
          const m = h.match(/access_token=([^&]+)/);
          return m ? m[1] : null;
        }).catch(() => null);
        if (ht) { guardar(ht); browser.disconnect(); process.exit(0); }
        const u = p.url();
        const m = u.match(/access_token=([^&]+)/);
        if (m) { guardar(m[1]); browser.disconnect(); process.exit(0); }
      } catch {}
    }

    const pu = page.url();
    if (pu.includes("login") && pu.includes("skip_api_login")) {
      if (i % 10 === 0) console.log(`[${(i+1)*2}s] LOGIN - Inicia sesion`);
    } else if (pu.includes("two_step") || pu.includes("checkpoint")) {
      if (i % 10 === 0) console.log(`[${(i+1)*2}s] 2FA - Ingresa codigo`);
    } else if (pu.includes("dialog/oauth") && !pu.includes("error")) {
      console.log(`[${(i+1)*2}s] PERMISOS - Haz click en "Continuar como..."`);
      try {
        const btns = await page.$$("button");
        for (const btn of btns) {
          const txt = await page.evaluate(el => (el.textContent || "").toLowerCase().trim(), btn).catch(() => "");
          if (txt.includes("contin") || txt.includes("aceptar")) {
            await btn.click().catch(() => {});
            console.log("  -> Click automatico");
            break;
          }
        }
      } catch {}
    } else if (pu.includes("error") || pu.includes("Invalid")) {
      console.log(`[${(i+1)*2}s] ERROR:`, pu.substring(0, 120));
      const errText = await page.evaluate(() => document.body.innerText).catch(() => "");
      console.log(errText.substring(0, 500));
    } else if (pu.includes("callback")) {
      console.log(`[${(i+1)*2}s] CALLBACK - leyendo token...`);
    } else if (pu.includes("explorer")) {
      console.log(`[${(i+1)*2}s] EXPLORER`);
    } else {
      console.log(`[${(i+1)*2}s] ${pu.substring(0, 100)}`);
    }
  }

  console.log("Timeout. Browser abierto.");
  await wait(99999999);
})().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
