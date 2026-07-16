const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const path = require("path");
const fs = require("fs");

const linkPath = path.join(__dirname, "real_user_data_link");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfd9f3bIBYdrMps4YlASFWr2Zsg81eiIsXF8wtq2bZ_xaSsYA/viewform";
const FIXED = {
  correo: "daveymena16@gmail.com", cedulaTecnico: "1077449318",
  nombreTecnico: "Duvier Davey Mena Mosquera", telefono: "3136174267",
};

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  console.log("Iniciando Chrome para diagnostico de captcha...");
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    userDataDir: linkPath,
    headless: false,
    args: ["--profile-directory=Profile 2", "--start-maximized", "--disable-blink-features=AutomationControlled"],
    defaultViewport: null,
  });
  const [page] = await browser.pages();
  await page.setViewport({ width: 1920, height: 1080 });

  // Navigate to form
  await page.goto(FORM_URL + "?_t=" + Date.now(), { waitUntil: "networkidle2", timeout: 60000 });
  await delay(3000);

  // Helper: fill field by heading text
  async function fillField(headingText, value) {
    const items = await page.evaluate((h, v) => {
      const all = document.querySelectorAll('[role="listitem"]');
      for (const item of all) {
        const heading = item.querySelector('[role="heading"]');
        if (heading && heading.textContent.trim().toLowerCase().includes(h.toLowerCase())) {
          const inp = item.querySelector('input.whsOnd, input[type="text"], input[type="email"], input[type="number"]');
          if (inp) { inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); return "text"; }
          const listbox = item.querySelector('[role="listbox"]');
          if (listbox) { return "listbox"; }
          const radios = item.querySelectorAll('[role="radio"]');
          if (radios.length > 0) { return "radio"; }
        }
      }
      return "notfound";
    }, headingText, value);
    return items;
  }

  // Fill fields and click Siguiente through the form
  for (let p = 0; p < 30; p++) {
    // Check for captcha
    const frames = page.frames();
    const bf = frames.find(f => f.url().includes("bframe"));
    
    if (bf) {
      console.log("\n==========================================");
      console.log("CAPTCHA DETECTADO en pagina " + p);
      console.log("==========================================\n");
      
      // Get challenge text
      const challenge = await bf.evaluate(() => {
        const el = document.querySelector(".rc-imageselect-instructions strong");
        return el ? el.textContent.trim() : "(sin texto)";
      }).catch(() => "ERROR");
      console.log("Challenge:", challenge);

      // Get ALL iframe elements to find the reCAPTCHA iframe
      const bframeMeta = await page.evaluate(() => {
        const iframes = document.querySelectorAll('iframe');
        const results = [];
        iframes.forEach((f, i) => {
          const r = f.getBoundingClientRect();
          results.push({idx: i, src: (f.src || "").substring(0, 100), x: r.left, y: r.top, w: r.width, h: r.height});
        });
        return results;
      });
      console.log("\nIframes en pagina:");
      bframeMeta.forEach(f => console.log(`  #${f.idx} (${f.x},${f.y}) ${f.w}x${f.h} ${f.src}`));

      // The bframe iframe - find it on the page
      const bframeIframe = bframeMeta.find(f => f.src.includes("bframe"));
      const bframeOffset = bframeIframe ? { x: bframeIframe.x, y: bframeIframe.y } : { x: 0, y: 0 };
      console.log("\nBframe offset on page:", JSON.stringify(bframeOffset));

      // Now get tile info WITH offset
      const tileInfo = await bf.evaluate(() => {
        const results = { tiles: [], gridSize: 3 };
        
        // Try method 1: table-rc-imageselect-table
        const tables = document.querySelectorAll("table.rc-imageselect-table");
        if (tables.length > 0) {
          const rows = tables[0].querySelectorAll("tr");
          rows.forEach(row => {
            const tds = row.querySelectorAll("td");
            tds.forEach(td => {
              const r = td.getBoundingClientRect();
              if (r.width > 20 && r.height > 20) {
                const img = td.querySelector("img");
                const style = td.getAttribute("style") || "";
                const bgMatch = style.match(/url\(["']?([^"')]+)["']?\)/);
                results.tiles.push({
                  x: r.left, y: r.top, w: r.width, h: r.height,
                  cx: r.left + r.width/2, cy: r.top + r.height/2,
                  imgSrc: img ? img.getAttribute("src") : (bgMatch ? bgMatch[1] : ""),
                  classes: td.className
                });
              }
            });
          });
          if (results.tiles.length > 0) {
            results.gridSize = Math.round(Math.sqrt(results.tiles.length));
          }
        }

        // Method 2: just all images
        if (results.tiles.length === 0) {
          document.querySelectorAll("img").forEach(img => {
            const r = img.getBoundingClientRect();
            if (r.width > 30 && r.height > 30) {
              results.tiles.push({
                x: r.left, y: r.top, w: r.width, h: r.height,
                cx: r.left + r.width/2, cy: r.top + r.height/2,
                imgSrc: img.getAttribute("src") || "",
                classes: img.className || ""
              });
            }
          });
        }

        // Method 3: td[aria-label]
        if (results.tiles.length === 0) {
          document.querySelectorAll("td[aria-label], .rc-imageselect-tile").forEach(td => {
            const r = td.getBoundingClientRect();
            if (r.width > 20 && r.height > 20) {
              results.tiles.push({
                x: r.left, y: r.top, w: r.width, h: r.height,
                cx: r.left + r.width/2, cy: r.top + r.height/2,
                imgSrc: "", classes: td.className
              });
            }
          });
        }

        return results;
      });

      console.log("\nTile Info (" + tileInfo.tiles.length + " tiles, grid " + tileInfo.gridSize + "x" + tileInfo.gridSize + "):");
      console.log("  (coords are iframe-relative)");
      tileInfo.tiles.forEach((t, i) => {
        console.log(`  Tile #${i+1}: pos=(${Math.round(t.x)},${Math.round(t.y)}) size=${Math.round(t.w)}x${Math.round(t.h)} center=(${Math.round(t.cx)},${Math.round(t.cy)})`);
        if (t.imgSrc) console.log(`    imgSrc=${t.imgSrc.substring(0, 100)}`);
      });

      // Compute page-level coordinates
      console.log("\nPage-level tile coordinates (adding iframe offset):");
      tileInfo.tiles.forEach((t, i) => {
        const pageX = t.x + bframeOffset.x;
        const pageY = t.y + bframeOffset.y;
        const pageCX = t.cx + bframeOffset.x;
        const pageCY = t.cy + bframeOffset.y;
        console.log(`  Tile #${i+1}: pagePos=(${Math.round(pageX)},${Math.round(pageY)}) pageCenter=(${Math.round(pageCX)},${Math.round(pageCY)}) size=${Math.round(t.w)}x${Math.round(t.h)}`);
      });

      // Now take a full page screenshot and save individual tile crops
      const fullScreenshot = await page.screenshot({ encoding: 'buffer' });
      
      // Save tiles as individual images (using buffer-based approach)
      const sharp2 = require('sharp');
      for (let i = 0; i < Math.min(tileInfo.tiles.length, 16); i++) {
        const t = tileInfo.tiles[i];
        const pageCX = Math.round(t.cx + bframeOffset.x);
        const pageCY = Math.round(t.cy + bframeOffset.y);
        const pw = Math.round(t.w);
        const ph = Math.round(t.h);
        
        try {
          const tileBuffer = await sharp2(fullScreenshot)
            .extract({
              left: Math.max(0, pageCX - pw/2),
              top: Math.max(0, pageCY - ph/2),
              width: pw,
              height: ph
            })
            .png()
            .toBuffer();
          
          fs.writeFileSync(path.join(__dirname, `debug_tile_${i+1}.png`), tileBuffer);
          console.log(`  Saved tile_${i+1}.png`);
        } catch (e) {
          console.log(`  Error tile_${i+1}: ${e.message}`);
        }

        // ALSO try: extract using iframe-relative coords (to compare)
        try {
          const tileBuffer2 = await sharp2(fullScreenshot)
            .extract({
              left: Math.max(0, Math.round(t.x)),
              top: Math.max(0, Math.round(t.y)),
              width: pw,
              height: ph
            })
            .png()
            .toBuffer();
          fs.writeFileSync(path.join(__dirname, `debug_tile_bad_${i+1}.png`), tileBuffer2);
          console.log(`  Saved tile_bad_${i+1}.png (iframe coords)`);
        } catch (e) {
          console.log(`  Error tile_bad_${i+1}: ${e.message}`);
        }
      }

      // Save the full captcha area (the iframe)
      const captchaArea = await sharp2(fullScreenshot)
        .extract({
          left: Math.round(bframeOffset.x),
          top: Math.round(bframeOffset.y),
          width: Math.round(bframeIframe.w),
          height: Math.round(bframeIframe.h)
        })
        .png()
        .toBuffer();
      fs.writeFileSync(path.join(__dirname, "debug_bframe_area.png"), captchaArea);
      console.log("\nSaved bframe_area.png (full iframe)");

      // Save full screenshot
      fs.writeFileSync(path.join(__dirname, "debug_full_page.png"), fullScreenshot);
      console.log("Saved full_page.png");
      
      break;
    }

    // Fill fields on this page
    console.log("\nPagina " + (p+1) + " - llenando campos...");
    
    // Get all fields
    const fields = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[role="listitem"]')).map((item, i) => {
        const h = item.querySelector('[role="heading"]');
        const title = h ? h.textContent.trim().toLowerCase() : "";
        const hasInput = !!item.querySelector('input.whsOnd, input[type="text"], input[type="email"], input[type="number"]');
        const hasSelect = !!item.querySelector('[role="listbox"]');
        const radios = Array.from(item.querySelectorAll('[role="radio"]')).map(r => r.getAttribute("data-value") || r.textContent.trim());
        return { i, title, hasInput, hasSelect, radios };
      });
    });

    for (const f of fields) {
      const ft = f.title;
      if (f.hasInput) {
        let val = FIXED.correo;
        if (ft.includes("cedula") && ft.includes("tec")) val = FIXED.cedulaTecnico;
        if (ft.includes("nombre") && ft.includes("tec")) val = FIXED.nombreTecnico;
        if (ft.includes("telefono") || ft.includes("celular")) val = FIXED.telefono;
        if (ft.includes("orden") || ft.includes("ot")) val = "12345";
        if (ft.includes("cuenta")) val = "12345";
        if (ft.includes("nodo")) val = "NODO1";
        if (ft.includes("serial") || ft.includes("mac")) val = "ABC123";
        await page.evaluate((idx, v) => {
          const items = document.querySelectorAll('[role="listitem"]');
          const inp = items[idx].querySelector('input.whsOnd, input[type="text"], input[type="email"], input[type="number"]');
          if (inp) { inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); }
        }, f.i, val);
        console.log(`  Campo "${ft.substring(0, 30)}": "${val}"`);
      } else if (f.hasSelect) {
        await page.evaluate((idx) => {
          const items = document.querySelectorAll('[role="listitem"]');
          const lb = items[idx].querySelector('[role="listbox"]');
          if (lb) { lb.click(); }
        }, f.i);
        await delay(800);
        // Pick first option
        await page.evaluate((title) => {
          const opts = document.querySelectorAll('[role="option"]');
          for (const o of opts) {
            if (o.textContent.trim().toLowerCase() !== "elige" && o.textContent.trim() !== "") {
              o.click(); return;
            }
          }
          if (opts.length > 0) opts[0].click();
        }, ft);
        console.log(`  Select "${ft.substring(0, 30)}": selected first option`);
        await delay(300);
      } else if (f.radios.length > 0) {
        const val = ft.includes("material") ? "Si" : f.radios[0];
        await page.evaluate((idx, v) => {
          const items = document.querySelectorAll('[role="listitem"]');
          const radios = items[idx].querySelectorAll('[role="radio"]');
          for (const r of radios) {
            if (r.getAttribute("data-value") === v || r.textContent.trim() === v) {
              r.click(); return;
            }
          }
          if (radios.length > 0) radios[0].click();
        }, f.i, val);
        console.log(`  Radio "${ft.substring(0, 30)}": selected "${val}"`);
        await delay(200);
      }
    }

    await delay(500);

    // Click Siguiente
    const clicked = await page.evaluate(() => {
      const btns = document.querySelectorAll('[role="button"], button');
      for (const b of btns) {
        const txt = (b.textContent || "").trim().toLowerCase();
        if (txt === "siguiente" || txt === "next" || txt.includes("siguiente")) {
          b.click(); return true;
        }
      }
      return false;
    });

    if (!clicked) {
      console.log("No hay boton Siguiente en pagina " + (p+1));
      // Try Enviar
      const env = await page.evaluate(() => {
        const btns = document.querySelectorAll('[role="button"], button');
        for (const b of btns) {
          const txt = (b.textContent || "").trim().toLowerCase();
          if (txt === "enviar" || txt.includes("enviar")) { b.click(); return true; }
        }
        return false;
      });
      if (env) {
        console.log("Click Enviar en pagina " + (p+1));
        await delay(4000);
      }
    }
    await delay(3000);
  }

  await browser.close();
  console.log("\nDiagnostico completado");
})().catch(e => console.error("FATAL:", e.message, e.stack?.substring(0, 1000)));
