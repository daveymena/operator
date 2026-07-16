import puppeteer from "puppeteer";

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("[FB-TOKEN] Conectando a Chrome...");
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const fbPage = pages.find(p => p.url().includes('facebook.com'));
  
  if (!fbPage) {
    console.log(JSON.stringify({ error: "No hay pagina de Facebook abierta" }));
    await browser.disconnect();
    return;
  }
  
  console.log("[FB-TOKEN] Facebook encontrado. Navegando a Business Manager...");
  
  try {
    await fbPage.goto('https://business.facebook.com/overview/', { waitUntil: 'networkidle2', timeout: 30000 });
  } catch { console.log("[FB-TOKEN] Timeout en overview, continuando..."); }
  await sleep(3000);
  
  const result = await fbPage.evaluate(() => {
    const data = { token: '', bmId: '', adAccountId: '', pageId: '', pixelId: '', pageName: '', userEmail: '' };
    const scripts = document.querySelectorAll('script');
    
    for (const s of scripts) {
      const t = s.textContent || '';
      let m;
      
      if ((m = t.match(/EAA[A-Za-z0-9%._\-\/=,]+/))) {
        if (m[0].length > 30) data.token = m[0];
      }
      
      if ((m = t.match(/act_(\d+)/))) {
        data.adAccountId = data.adAccountId || m[1];
      }
      
      if ((m = t.match(/"page(?:ID|_id)":"(\d+)"/))) {
        data.pageId = data.pageId || m[1];
      }
      
      if ((m = t.match(/"pixel(?:Id|_id)":"(\d+)"/))) {
        data.pixelId = data.pixelId || m[1];
      }
      
      if ((m = t.match(/"business_id":"(\d+)"/))) {
        data.bmId = data.bmId || m[1];
      }
    }
    
    // Try to get from cookies
    document.cookie.split(';').forEach(c => {
      const parts = c.trim().split('=');
      if (parts[0] === 'c_user') data.bmId = data.bmId || parts[1];
    });
    
    return data;
  });
  
  console.log(JSON.stringify(result, null, 2));
  
  // Try to get page access token from Graph API
  if (result.pageId && result.token) {
    console.log("\n[FB-TOKEN] Probando token en Graph API...");
    try {
      const graphRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${result.token}`);
      const graphData = await graphRes.json();
      console.log("[FB-TOKEN] Graph API:", JSON.stringify(graphData, null, 2));
    } catch(e) { console.log("[FB-TOKEN] Graph error:", e.message); }
  }
  
  await browser.disconnect();
  console.log("\n[FB-TOKEN] Listo!");
}

main().catch(e => console.error("ERROR:", e.message));
