
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

async function main() {
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222" });
  const pages = await browser.pages();
  const page = pages[0];
  
  console.log("URL:", page.url());
  const title = await page.title();
  console.log("Title:", title);
  
  // Take screenshot
  await page.screenshot({ 
    path: "C:\\Users\\ADMIN\\Downloads\\Hello-World\\claro_agente_final\\fb_screen.png",
    fullPage: false 
  });
  console.log("Screenshot saved!");
  
  // Get all interactive elements
  const info = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], a[role="button"]'));
    const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
    return {
      buttons: buttons.map(b => ({
        text: b.innerText?.substring(0, 40) || b.getAttribute('aria-label')?.substring(0, 40) || '',
        type: b.tagName,
        id: b.id,
        class: (b.className || '').substring(0, 40)
      })).filter(b => b.text || b.id),
      inputs: inputs.map(i => ({
        type: i.type,
        id: i.id,
        name: i.name,
        placeholder: (i.placeholder || '').substring(0, 40),
        autocomplete: i.autocomplete
      })),
      url: window.location.href,
      bodyPreview: document.body.innerText.substring(0, 1000)
    };
  });
  
  console.log("PAGE_INFO_START");
  console.log(JSON.stringify(info));
  console.log("PAGE_INFO_END");
  
  await browser.disconnect();
}

main().catch(e => {
  console.error("ERROR:", e.message.substring(0, 200));
});
