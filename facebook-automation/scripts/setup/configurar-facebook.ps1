Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   CONFIGURANDO FACEBOOK + SALES BOT - MODO AUTOMATICO    ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝"

# 1. Extraer tokens de Facebook usando Chrome abierto
Write-Host "`n[1/4] Extrayendo tokens de Facebook..." -ForegroundColor Yellow
Set-Location "C:\Users\ADMIN\Videos\Agent-Sales-Bot"
try {
    $result = node -e "
    const puppeteer = require('puppeteer');
    (async () => {
        const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
        const pages = await browser.pages();
        const fbPage = pages.find(p => p.url().includes('facebook.com'));
        if (!fbPage) { console.log(JSON.stringify({error:'No FB page open'})); return; }
        
        await fbPage.goto('https://business.facebook.com/overview/', {waitUntil:'networkidle2',timeout:30000});
        await new Promise(r => setTimeout(r, 3000));
        
        // Extract cookies/tokens from localStorage
        const tokens = await fbPage.evaluate(() => {
            const result = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes('token') || key.includes('access') || key.includes('FBAccessToken'))) {
                    result[key] = localStorage.getItem(key);
                }
            }
            return result;
        });
        
        // Extract from page scripts
        const fbData = await fbPage.evaluate(() => {
            const scripts = document.querySelectorAll('script');
            let token='', bmId='', adAccountId='', pageId='', pixelId='';
            for (const s of scripts) {
                const t = s.textContent || '';
                if (t.includes('EAA') || t.includes('EAAC')) {
                    const m = t.match(/EAA[A-Za-z0-9%._-]+/);
                    if (m) token = m[0];
                }
                if (t.includes('act_')) {
                    const m = t.match(/act_(\d+)/);
                    if (m) adAccountId = m[1];
                }
                if (t.includes('\"pageID\":\"') || t.includes('\"page_id\":\"')) {
                    const m = t.match(/\"page(?:ID|_id)\":\"(\d+)\"/);
                    if (m) pageId = m[1];
                }
                if (t.includes('\"pixelId\":\"') || t.includes('\"pixel_id\":\"')) {
                    const m = t.match(/\"pixel(?:Id|_id)\":\"(\d+)\"/);
                    if (m) pixelId = m[1];
                }
                if (t.includes('business_id') || t.includes('businessManager')) {
                    const m = t.match(/\"(?:business_id|businessManager)\":\"(\d+)\"/);
                    if (m) bmId = m[1];
                }
            }
            return { token, bmId, adAccountId, pageId, pixelId };
        });
        
        console.log(JSON.stringify(fbData));
        await browser.disconnect();
    })().catch(e => console.log(JSON.stringify({error: e.message})));
    " 2>&1
    Write-Host "Resultado: $result"
    
    $fb = $result | ConvertFrom-Json
    if ($fb.token) {
        Write-Host "Token encontrado!" -ForegroundColor Green
        Write-Host "PageId: $($fb.pageId)" -ForegroundColor Green
        Write-Host "AdAccountId: $($fb.adAccountId)" -ForegroundColor Green
    } else {
        Write-Host "Token no encontrado en scripts. Abriendo pagina de tokens..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host "`n[2/4] Extrayendo con extract_fb_tokens.js..." -ForegroundColor Yellow
try {
    & node extract_fb_tokens.js 2>&1
} catch {
    Write-Host "Error: $_"
}

Write-Host "`n[3/4] Guardando tokens en fb_credentials.json..." -ForegroundColor Yellow

Write-Host "`n[4/4] Configurando .env con tokens..." -ForegroundColor Yellow
Write-Host "  (editar manualmente el archivo .env con los tokens extraidos)"
