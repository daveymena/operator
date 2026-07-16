const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const path = require("path");
const fs = require("fs");

const EMAIL = "daveymena16@gmail.com";
const PASSWORD = "6715320Dvd.";
const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfd9f3bIBYdrMps4YlASFWr2Zsg81eiIsXF8wtq2bZ_xaSsYA/viewform";
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const linkPath = path.join(__dirname, "real_user_data_link");

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitAndType(page, selector, text, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { timeout });
    await delay(500);
    await page.type(selector, text, { delay: 30 + Math.random() * 40 });
    return true;
  } catch (e) {
    console.log("  No se encontro: " + selector);
    return false;
  }
}

async function waitAndClick(page, selector, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { timeout, visible: true });
    await delay(500);
    await page.click(selector);
    await delay(1000);
    return true;
  } catch (e) {
    console.log("  No se pudo click: " + selector);
    return false;
  }
}

(async () => {
  console.log("🚀 Lanzando Chrome con Profile 2...");
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    userDataDir: linkPath,
    headless: false,
    args: [
      "--profile-directory=Profile 2",
      "--start-maximized",
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
    ],
    defaultViewport: null,
  });

  const pages = await browser.pages();
  const page = pages[0];

  // Check if already logged in
  console.log("🌐 Verificando sesion...");
  await page.goto("https://www.google.com", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(2000);

  let text = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => "");
  
  if (!text.includes("Acceder") && !text.includes("Iniciar sesi")) {
    console.log("✅ Ya hay sesion activa! Continuando...");
  } else {
    console.log("🔑 Iniciando sesion en Google...");
    
    // Go to login
    await page.goto("https://accounts.google.com/signin", { waitUntil: "networkidle2", timeout: 30000 });
    await delay(2000);
    
    // Type email
    console.log("  Escribiendo email...");
    const emailInput = await waitAndType(page, 'input[type="email"], input[name="identifier"]', EMAIL);
    if (emailInput) {
      await waitAndClick(page, '#identifierNext, button[jsname*="V67aGc"]');
      await delay(3000);
    }
    
    // Type password
    console.log("  Escribiendo contraseña...");
    const passInput = await waitAndType(page, 'input[type="password"], input[name="Passwd"]', PASSWORD);
    if (passInput) {
      await waitAndClick(page, '#passwordNext, button[jsname*="V67aGc"]');
      await delay(5000);
    }
    
    console.log("✅ Login completado");
  }

  // Take screenshot of logged-in state
  await page.goto("https://www.google.com", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(2000);
  text = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => "");
  console.log("📧 Sesion verificada:", text.includes("daveymena16") ? "OK" : "REVISAR");
  await page.screenshot({ path: path.join(__dirname, "login_verified.png") });

  // Now navigate to the form
  console.log("📋 Abriendo formulario de ordenes...");
  await page.goto(FORM_URL, { waitUntil: "networkidle2", timeout: 60000 });
  await delay(3000);
  await page.screenshot({ path: path.join(__dirname, "form_loaded.png") });

  console.log("✅ Chrome listo con sesion y formulario cargado!");
  console.log("Browser PID:", browser.process().pid);
  
  // Keep browser open
  // The fill_orders_final.js can now connect to this Chrome via the port
})().catch(e => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
