const puppeteer = require("puppeteer");
const path = require("path");

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    userDataDir: path.join(__dirname, "real_user_data_link"),
    headless: false,
    args: ["--profile-directory=Profile 10", "--start-maximized", "--disable-blink-features=AutomationControlled"],
    defaultViewport: null,
  });
  const [pg] = await browser.pages();
  await pg.goto("https://mail.google.com/mail/u/0/", { waitUntil: "networkidle2", timeout: 30000 });
  await delay(5000);

  const txt = await pg.evaluate(() => document.body.innerText.substring(0, 300)).catch(() => "");
  console.log("Inbox:", txt.substring(0, 100));

  // Use search box
  const sb = await pg.$('input[aria-label*="Buscar"], input[aria-label*="Search mail"]');
  if (sb) {
    console.log("Usando search box");
    await sb.click();
    await delay(500);
    await sb.type("Orden de Trabajo Virtual", { delay: 15 });
    await delay(1000);
    await pg.keyboard.press("Enter");
    await delay(5000);
  }
  const rows = await pg.evaluate(() => document.querySelectorAll("tr.zA").length);
  console.log("Resultados:", rows);

  // Also check "todas las conversaciones"
  const todosText = await pg.evaluate(() => document.querySelector("html")?.innerText?.substring(0, 1000)).catch(() => "");
  console.log("DEBUG:", todosText?.substring(0, 500));
  
  await browser.close();
})().catch(e => console.error("ERR:", e.message));
