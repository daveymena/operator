import puppeteer from 'puppeteer';
import fs from 'fs';

const OUT = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\assets\\images';
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });

const searches = [
  { q: 'persona tocando piano', file: 'piano' },
  { q: 'programador trabajando', file: 'programacion' },
  { q: 'diseñador gráfico creativo', file: 'diseno' },
  { q: 'persona estudiando inglés', file: 'ingles' },
  { q: 'inteligencia artificial tecnología', file: 'ia' },
];

async function downloadFromPexels(searchQuery, fileName) {
  const searchUrl = `https://www.pexels.com/es-es/buscar/${encodeURIComponent(searchQuery)}/?orientation=landscape`;
  console.log(`\n=== ${searchQuery} ===`);
  
  await page.goto(searchUrl, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  await page.evaluate(() => window.scrollBy(0, 500));
  await new Promise(r => setTimeout(r, 2000));

  // Get all visible photo links
  const photoLinks = await page.evaluate(() => {
    const links = [];
    // Pexels renders each result as a link containing an img
    document.querySelectorAll('a[href*="/foto/"], a[href*="/photo/"]').forEach(a => {
      const img = a.querySelector('img');
      if (img) {
        const src = img.getAttribute('src');
        if (src && src.includes('images.pexels.com') && a.href) {
          links.push({ href: a.href, thumb: src });
        }
      }
    });
    return links.slice(0, 3);
  });

  console.log(`Found ${photoLinks.length} photo links`);

  for (const link of photoLinks) {
    try {
      // Go to the photo detail page
      await page.goto(link.href, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000));

      // Get the largest available image URL
      const imgUrl = await page.evaluate(() => {
        // Try to find the download button/link
        const dlBtn = document.querySelector('a[download]');
        if (dlBtn) return dlBtn.href;
        // Or the main image in different sizes
        const img = document.querySelector('img[src*="images.pexels.com"]');
        if (img) {
          let src = img.getAttribute('src') || img.getAttribute('data-src') || '';
          // Try to get the largest size
          return src.replace(/auto=compress[^&]*/, 'auto=compress&cs=tinysrgb&w=1260&h=750&fit=crop');
        }
        return null;
      });

      if (imgUrl) {
        console.log(`  URL: ${imgUrl.substring(0, 90)}`);
        const resp = await fetch(imgUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer());
          if (buf.length > 15000) {
            const fp = `${OUT}\\${fileName}.jpg`;
            fs.writeFileSync(fp, buf);
            console.log(`  ✅ ${fileName}.jpg (${(buf.length/1024).toFixed(0)}KB)`);
            return true;
          }
        }
      }
    } catch(e) {
      console.log(`  ❌ ${e.message.substring(0, 60)}`);
    }
  }
  return false;
}

for (const s of searches) {
  await downloadFromPexels(s.q, s.file);
}

await browser.disconnect();
console.log('\n Completado');
