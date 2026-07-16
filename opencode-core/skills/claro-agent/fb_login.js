const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const EMAIL = "daveymosqueramena@gmail.com";
const PASSWORD = "6715320Dvd.";

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function humanClick(page, el) {
  const box = await el.boundingBox();
  if (!box) { await el.evaluate(e => e.click()); return; }
  const steps = rand(8, 15);
  const cx = box.x + box.width/2;
  const cy = box.y + box.height/2;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(cx + (Math.random()-0.5)*6, cy + (Math.random()-0.5)*6);
    await delay(rand(15, 40));
  }
  await delay(rand(80, 200));
  await page.mouse.click(cx, cy);
  await delay(rand(200, 500));
}

async function main() {
  console.log("Conectando a Chrome...");
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222" });
  const pages = await browser.pages();
  const page = pages[0];
  
  console.log("Esperando carga de Facebook...");
  await delay(5000);
  
  const url = page.url();
  console.log("URL:", url);
  
  // Check if already logged in
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log("Texto:", bodyText.substring(0, 200));
  
  // Check all buttons and inputs
  const pageInfo = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], a[role="button"]'));
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"])'));
    return {
      buttons: buttons.map(b => ({ text: (b.innerText||'').trim().substring(0,30), tag: b.tagName, type: b.type })),
      inputs: inputs.map(i => ({ id: i.id, name: i.name, type: i.type, placeholder: (i.placeholder||'').substring(0,30) }))
    };
  });
  
  console.log("Inputs:", JSON.stringify(pageInfo.inputs));
  console.log("Buttons:", JSON.stringify(pageInfo.buttons));
  
  // If already logged in, go to pages
  const isLoggedIn = !url.includes("login") && !url.includes("checkpoint") && 
    (bodyText.toLowerCase().includes("whats on your mind") || bodyText.toLowerCase().includes("que estas pensando") || bodyText.includes("feed"));
  
  if (isLoggedIn) {
    console.log("✅ YA ESTAS LOGUEADO!");
    // Go to pages
    await page.goto("https://www.facebook.com/pages/?category=your_pages&ref=bookmarks", { waitUntil: "networkidle2", timeout: 30000 });
    await delay(3000);
    console.log("URL despues de ir a pages:", await page.url());
  } else {
    console.log("Intentando login...");
    
    // Find email field
    let emailInput;
    for (const sel of ['#email', 'input[name="email"]', 'input[autocomplete="username"]', 'input[type="text"]']) {
      emailInput = await page.$(sel);
      if (emailInput) { console.log("Email field:", sel); break; }
    }
    
    if (emailInput) {
      await humanClick(page, emailInput);
      await delay(rand(200, 600));
      for (const char of EMAIL) {
        await page.keyboard.type(char, { delay: rand(40, 150) });
      }
      console.log("Email typed");
      await delay(rand(500, 1200));
      
      // Find password field
      let passInput;
      for (const sel of ['#pass', 'input[name="pass"]', 'input[type="password"]']) {
        passInput = await page.$(sel);
        if (passInput) { console.log("Pass field:", sel); break; }
      }
      
      if (passInput) {
        await humanClick(page, passInput);
        await delay(rand(200, 600));
        for (const char of PASSWORD) {
          await page.keyboard.type(char, { delay: rand(30, 120) });
        }
        console.log("Password typed");
        await delay(rand(800, 2000));
        
        // Try pressing Enter (most reliable)
        console.log("Presionando Enter...");
        await page.keyboard.press('Enter');
        await delay(5000);
        
        const newUrl = await page.url();
        console.log("URL post-login:", newUrl);
        
        // Check if login succeeded
        const newText = await page.evaluate(() => document.body.innerText.substring(0, 300));
        console.log("Post-login text:", newText.substring(0, 200));
        
        if (newUrl.includes('checkpoint') || newUrl.includes('two_factor')) {
          console.log("⚠️ Facebook pide 2FA - revisa tu telefono o email!");
        }
        
        // Try navigating to pages
        if (!newUrl.includes('login')) {
          await page.goto("https://www.facebook.com/pages/?category=your_pages&ref=bookmarks", { waitUntil: "networkidle2", timeout: 30000 });
          await delay(3000);
          console.log("Pages URL:", await page.url());
        }
      }
    }
  }
  
  // Take screenshot
  await page.screenshot({ path: "C:\\Users\\ADMIN\\Downloads\\Hello-World\\claro_agente_final\\fb_state.png", fullPage: false });
  console.log("Screenshot saved!");
  
  // Final state
  const final = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    hasLoginForm: !!document.querySelector('#email, #pass, input[name="email"]'),
    textPreview: document.body.innerText.substring(0, 400)
  }));
  console.log("FINAL:", JSON.stringify(final, null, 2));
  
  await browser.disconnect();
  console.log("\\n✅ Chrome listo. Puedes verlo en tu pantalla!");
}

main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
