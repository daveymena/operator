const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const EMAIL = "daveymosqueramena@gmail.com";
const PASSWORD=***;

function rand(m, M) { return Math.random() * (M - m) + m; }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("Conectando a Chrome...");
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
  const pages = await browser.pages();
  let p = pages.find(x => x.url().includes("facebook.com"));
  if (!p) { p = await browser.newPage(); await p.goto("https://facebook.com"); }
  await p.bringToFront();
  await delay(1500);
  console.log("URL:", p.url());

  const ef = await p.$("input[name='email']");
  if (ef) {
    console.log("Escribiendo email...");
    await ef.click({delay: rand(50, 150)});
    await delay(rand(200, 500));
    await ef.type(EMAIL, {delay: rand(30, 80)});
    await delay(rand(500, 1200));
  } else { console.log("No email field"); }

  const pf = await p.$("input[name='pass']");
  if (pf) {
    console.log("Escribiendo password...");
    await pf.click({delay: rand(50, 150)});
    await delay(rand(200, 500));
    await pf.type(PASSWORD, {delay: rand(30, 80)});
    await delay(rand(300, 800));
  } else { console.log("No pass field"); }

  console.log("Presionando Enter...");
  await p.keyboard.press("Enter");

  console.log("Esperando...");
  await delay(8000);

  const nUrl = p.url();
  console.log("URL:", nUrl);
  const body = await p.evaluate(() => document.body.innerText.substring(0, 500));
  const norm = body.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  if (norm.includes("checkpoint") || norm.includes("codigo") || norm.includes("aprob")) {
    console.log("2FA DETECTADA - Revisa tu pantalla!");
  } else if (!norm.includes("iniciar") && !norm.includes("correo")) {
    console.log("LOGIN EXITOSO!");
  } else {
    console.log("Fallo login. Body:", body.substring(0, 200));
  }
  console.log("Listo! Revisa tu pantalla.");
  await browser.disconnect();
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
