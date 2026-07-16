import puppeteer from 'puppeteer';
import fs from 'fs';

const ROOT = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation';
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const page = await browser.newPage();
page.setViewport({ width: 1400, height: 900 });

// Navigate to Ads Manager Create flow
await page.goto('https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1545022093928422', {
  waitUntil: 'networkidle0', timeout: 30000
});
await new Promise(r => setTimeout(r, 5000));

console.log('Page loaded');
await page.screenshot({ path: ROOT + '\\screenshots\\ads-manager-create.png' });

// Look for the "Create" button
const buttons = await page.evaluate(() => {
  const allBtns = Array.from(document.querySelectorAll('button, a[role="button"], [role="button"], a'));
  return allBtns.map(b => ({
    text: (b.textContent || '').trim().substring(0, 50),
    tag: b.tagName,
    role: b.getAttribute('role') || '',
    aria: b.getAttribute('aria-label') || '',
    href: b.getAttribute('href') || '',
    class: (b.className || '').substring(0, 40)
  })).filter(b => 
    b.text.toLowerCase().includes('crear') || 
    b.text.toLowerCase().includes('create') || 
    b.aria.toLowerCase().includes('crear') ||
    b.aria.toLowerCase().includes('create') ||
    b.href.includes('create')
  );
});

console.log(`\nFound ${buttons.length} Create buttons:`);
buttons.forEach((b, i) => console.log(`  ${i}: "${b.text}" role=${b.role} aria="${b.aria}" href=${b.href?.substring(0, 60)}`));

// Try to click the first Create button
if (buttons.length > 0) {
  const btnSelector = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('button, a[role="button"], [role="button"]'));
    for (const el of all) {
      const text = (el.textContent || '').trim().toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      if (text === 'crear' || text === 'create' || aria === 'crear' || aria === 'create') {
        return el.tagName + (el.className ? '.' + el.className.split(' ')[0] : '');
      }
    }
    return null;
  });
  
  if (btnSelector) {
    console.log(`Trying to click: ${btnSelector}`);
    await page.click(`button:has-text("Crear"), button:has-text("Create"), [aria-label="Crear"], [aria-label="Create"]`).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: ROOT + '\\screenshots\\after-create-click.png' });
    console.log('Clicked Create, current URL:', page.url().substring(0, 100));
  }
}

// Also check what the current state is
const currentState = await page.evaluate(() => {
  const body = document.body.innerText || '';
  const hasCampaigns = body.includes('Campa') || body.includes('Campaña') || body.includes('Campaign');
  const lines = body.split('\n').filter(l => l.trim()).slice(0, 30);
  return { url: location.href, title: document.title, menuItems: lines.slice(5, 15) };
});
console.log('\nCurrent state:');
currentState.menuItems.forEach(l => console.log('  ' + l));

await browser.disconnect();
