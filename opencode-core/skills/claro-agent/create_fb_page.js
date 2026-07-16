const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const EMAIL = 'daveymosqueramena@gmail.com';
const PASSWORD = '6715320Dvd.';
const PAGE_NAME = 'Mi Nueva Página de Prueba';
const PAGE_CATEGORY = 'Creador digital';
const PAGE_DESCRIPTION = 'Esta es una página de prueba creada automáticamente.';

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
  console.log('Iniciando Chrome con perfil temporal...');
  const userDataDir = path.join(__dirname, 'temp_chrome_profile');
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir);

  const browser = await puppeteer.launch({
    headless: true,
    userDataDir: userDataDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  console.log('Chrome iniciado. Navegando a Facebook...');
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://facebook.com', { waitUntil: 'networkidle2', timeout: 60000 });
  await delay(2000);

  const url = page.url();
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  function norm(t) { return t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  const bt = norm(bodyText);

  if (bt.includes('Iniciar sesion') || bt.includes('Log in') || bt.includes('Contrasena') || url.includes('login')) {
    console.log('Login detectado. Iniciando sesión...');
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
    console.log('Esperando redirección...');
    await delay(8000);
    const nUrl = page.url();
    const nBody = await page.evaluate(() => document.body.innerText.substring(0, 1000));
    const nBt = norm(nBody);
    console.log('URL final: ' + nUrl);
    if (nBt.includes('checkpoint') || nBt.includes('codigo') || nBt.includes('Aprobar')) {
      console.log('ATENCIÓN: 2FA detectada! Revisa tu pantalla y resuelve manualmente.');
      await delay(30000); // Esperar resolución manual
    } else if (!nBt.includes('Iniciar sesion') && !nBt.includes('Contrasena')) {
      console.log('LOGIN EXITOSO! Ya estás dentro de Facebook.');
    } else {
      console.log('Login podría haber fallado. Revisa tu pantalla.');
    }
  } else if (bt.includes('feed') || bt.includes('notificaciones') || url.includes('home')) {
    console.log('Ya tienes sesión activa en Facebook!');
  } else {
    console.log('Estado desconocido. Body: ' + bodyText.substring(0, 200));
    console.log('Navegando a login...');
    await page.goto('https://facebook.com/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);
    console.log('Ahora en: ' + page.url());
  }

  console.log('Navegando a la página de creación de páginas...');
  await page.goto('https://www.facebook.com/pages/creation/', { waitUntil: 'networkidle2', timeout: 60000 });
  await delay(5000);
  console.log('URL actual: ' + page.url());
  const creationBody = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('Contenido de la página de creación:');
  console.log(creationBody);

  // Tomar screenshot para inspección
  await page.screenshot({ path: path.join(__dirname, 'creation_page.png'), fullPage: true });
  console.log('Screenshot guardado como creation_page.png');

  // Aquí iría la lógica para rellenar el formulario
  // Primero necesitamos inspeccionar la página para ver los selectores exactos
  // Por ahora, esperamos a que el usuario revise el screenshot

  console.log('Script pausado. Revisa el screenshot creation_page.png para ver la interfaz.');
  console.log('Presiona Ctrl+C cuando quieras continuar después de inspeccionar.');

  // Mantener el navegador abierto
  await new Promise(() => {});
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });