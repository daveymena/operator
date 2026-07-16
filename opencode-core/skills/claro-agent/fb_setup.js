
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const EMAIL = "daveymosqueramena@gmail.com";
const PASSWORD = "6715320Dvd.";

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanType(page, selector, text) {
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.click(selector);
  await delay(rand(300, 800));
  for (const char of text) {
    await page.keyboard.type(char, { delay: rand(30, 120) });
  }
  console.log(`  Tipo: ${text.substring(0, 20)}...`);
}

async function humanClick(page, selector) {
  await page.waitForSelector(selector, { timeout: 10000 });
  const el = await page.$(selector);
  const box = await el.boundingBox();
  if (box) {
    // Move mouse like human (smooth curve)
    const steps = rand(8, 15);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const cx = box.x + box.width/2 + (Math.random() - 0.5) * 6;
      const cy = box.y + box.height/2 + (Math.random() - 0.5) * 6;
      await page.mouse.move(cx, cy);
      await delay(rand(15, 40));
    }
    await delay(rand(100, 250));
    await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
    await delay(rand(200, 500));
  }
  console.log(`  Click en selector`);
}

async function main() {
  console.log("Conectando a Chrome en ejecucion...");
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222" });
  const pages = await browser.pages();
  let page = pages[0];
  
  // Get current URL
  let url = page.url();
  console.log("URL actual:", url);
  
  // If not on Facebook, go there
  if (!url.includes("facebook.com")) {
    console.log("Navegando a Facebook...");
    await page.goto("https://www.facebook.com", { waitUntil: "networkidle2", timeout: 30000 });
    await delay(2000);
  }
  
  // Check if we're on login page
  const pageContent = await page.content();
  const isLoginPage = pageContent.includes("email") || pageContent.includes("identify") || url.includes("login");
  console.log("Es pagina de login:", isLoginPage);
  
  if (isLoginPage) {
    console.log("Iniciando sesion con comportamiento humano...");
    
    // Try different selectors for email
    let emailSelector;
    try {
      emailSelector = '#email';
      await page.waitForSelector(emailSelector, { timeout: 3000 });
    } catch(e) {
      try {
        emailSelector = 'input[name="email"]';
        await page.waitForSelector(emailSelector, { timeout: 3000 });
      } catch(e2) {
        emailSelector = 'input[type="text"]';
      }
    }
    
    await humanType(page, emailSelector, EMAIL);
    await delay(rand(500, 1500));
    
    // Type password
    let passSelector;
    try {
      passSelector = '#pass';
      await page.waitForSelector(passSelector, { timeout: 3000 });
    } catch(e) {
      passSelector = 'input[name="pass"]';
    }
    
    await humanType(page, passSelector, PASSWORD);
    await delay(rand(800, 2000));
    
    // Click login button
    let loginBtn;
    try {
      loginBtn = 'button[name="login"]';
      await page.waitForSelector(loginBtn, { timeout: 3000 });
    } catch(e) {
      loginBtn = 'button[type="submit"]';
    }
    
    console.log("Haciendo click en login...");
    await humanClick(page, loginBtn);
    
    // Wait for login to complete
    console.log("Esperando login...");
    await delay(5000);
    
    // Check if 2FA or checkpoint
    const newUrl = page.url();
    console.log("URL despues de login:", newUrl);
  }
  
  // Now check current state
  const finalUrl = page.url();
  const title = await page.title();
  console.log("Titulo:", title);
  console.log("URL final:", finalUrl);
  
  // Take a screenshot for vision analysis
  await page.screenshot({ path: 'C:\\Users\\ADMIN\\Downloads\\Hello-World\\claro_agente_final\\fb_screen.png', fullPage: false });
  console.log("Screenshot guardado!");
  
  await browser.disconnect();
  console.log("\\n✅ Listo! Chrome queda abierto en tu pantalla.");
}

main().catch(e => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
