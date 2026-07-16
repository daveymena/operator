const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const EMAIL = 'daveymosqueramena@gmail.com';
const PASSWORD='6715320Dvd.';

function rand(min, max) { return Math.random() * (max - min) + min; }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function moveMouseLikeHuman(page, x, y) {
  try {
    const start = await page.evaluate(() => ({ x: window.mouseX || 0, y: window.mouseY || 0 }));
    const steps = Math.floor(rand(8, 20));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const cx = start.x + (x - start.x) * t + (Math.random() - 0.5) * 12;
      const cy = start.y + (y - start.y) * t + (Math.random() - 0.5) * 12;
      await page.mouse.move(cx, cy);
      await delay(rand(8, 30));
    }
    await page.mouse.move(x, y);
    await delay(rand(30, 80));
  } catch (e) {
    await page.mouse.move(x, y);
    await delay(rand(30, 80));
  }
}

async function typeLikeHuman(page, text, selector) {
  try { await page.focus(selector); } catch(e) { try { await page.click(selector); } catch(e2) { return false; } }
  await delay(rand(200, 500));
  try { await page.evaluate((sel) => { const el = document.querySelector(sel); if (el) el.value = ''; }, selector); } catch(e) {}
  await delay(rand(50, 150));
  for (const char of text) {
    await page.keyboard.type(char, { delay: rand(30, 90) });
  }
  await delay(rand(100, 300));
  return true;
}

async function humanClick(page, selector) {
  try {
    const el = await page.$(selector);
    if (!el) return false;
    const box = await el.boundingBox();
    if (box) { await moveMouseLikeHuman(page, box.x + box.width/2, box.y + box.height/2); await delay(rand(200, 600)); }
    await el.click();
    return true;
  } catch(e) { return false; }
}

async function main() {
  console.log('Conectando a Chrome en tu PC...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  console.log('Conectado a Chrome!');
  const pages = await browser.pages();
  let page = pages.find(p => p.url().includes('facebook.com'));
  if (!page) { page = await browser.newPage(); await page.goto('https://facebook.com', { waitUntil: 'networkidle2', timeout: 60000 }); }
  await page.bringToFront(); await delay(2000);
  const url = page.url(); console.log('URL: ' + url);
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  function norm(t) { return t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  const bt = norm(bodyText);

  if (bt.includes('Iniciar sesion') || bt.includes('Log in') || bt.includes('Contrasena') || url.includes('login')) {
    console.log('Login detectado. Iniciando sesion...');
    for (const sel of ['input[name="email"]', 'input[type="text"][name="email"]', 'input[autocomplete="username"]', 'input[id="email"]', 'input[type="email"]']) {
      if (await page.$(sel)) { await typeLikeHuman(page, EMAIL, sel); console.log('Email escrito.'); break; }
    }
    await delay(rand(600, 1500));
    for (const sel of ['input[name="pass"]', 'input[type="password"]', 'input[autocomplete="current-password"]', 'input[id="pass"]']) {
      if (await page.$(sel)) { await typeLikeHuman(page, PASSWORD, sel); console.log('Password escrito.'); break; }
    }
    await delay(rand(400, 1000));
    let clicked = false;
    for (const sel of ['button[name="login"]', 'button[type="submit"]', 'input[type="submit"]', 'button[id="loginbutton"]']) {
      clicked = await humanClick(page, sel);
      if (clicked) { console.log('Login clickeado!'); break; }
    }
    if (!clicked) { await page.keyboard.press('Enter'); console.log('Enter presionado.'); }
    console.log('Esperando redireccion...');
    await delay(8000);
    const nUrl = page.url();
    const nBody = await page.evaluate(() => document.body.innerText.substring(0, 1000));
    const nBt = norm(nBody);
    console.log('URL final: ' + nUrl);
    if (nBt.includes('checkpoint') || nBt.includes('codigo') || nBt.includes('Aprobar')) {
      console.log('ATENCION: 2FA detectada! Revisa tu pantalla y resuelve manualmente.');
    } else if (!nBt.includes('Iniciar sesion') && !nBt.includes('Contrasena')) {
      console.log('LOGIN EXITOSO! Ya estas dentro de Facebook.');
    } else {
      console.log('Login podria haber fallado. Revisa tu pantalla.');
    }
  } else if (bt.includes('feed') || bt.includes('notificaciones') || url.includes('home')) {
    console.log('Ya tienes sesion activa en Facebook!');
  } else {
    console.log('Estado desconocido. Body: ' + bodyText.substring(0, 200));
    console.log('Navegando a login...');
    await page.goto('https://facebook.com/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);
    console.log('Ahora en: ' + page.url());
  }
  console.log('Script finalizado. Revisa tu pantalla.');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });