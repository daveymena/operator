import puppeteer from 'puppeteer';
import fs from 'fs';

const OUT = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\assets\\images';
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });

const searches = [
  { q: 'persona tocando piano adulto', file: 'piano', kw: 'piano' },
  { q: 'programador frente a computador codigo', file: 'programacion', kw: 'programacion' },
  { q: 'disenador grafico tableta digital', file: 'diseno', kw: 'diseno' },
  { q: 'persona estudiando ingles libro', file: 'ingles', kw: 'ingles' },
  { q: 'inteligencia artificial robot tecnologia', file: 'ia', kw: 'ia' },
];

const downloaded = [];

for (const s of searches) {
  console.log(`\n=== Buscando: ${s.q} ===`);
  
  // Use Pixabay which is easier to scrape
  const url = `https://pixabay.com/es/images/search/${encodeURIComponent(s.q)}/?orientation=horizontal`;
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  // Get image URLs from Pixabay
  const results = await page.evaluate(() => {
    const urls = [];
    const imgs = document.querySelectorAll('img[srcset], img[src*="pixabay"]');
    imgs.forEach(img => {
      const src = img.getAttribute('src') || '';
      if (src.includes('pixabay.com') && !src.includes('_icon') && src.match(/\.(jpg|jpeg|png|webp)/i)) {
        const hq = src.replace(/_\d+\.(jpg|jpeg|png|webp)/, '_1280.$1')
                      .replace(/\/\d+[wm]?\/?/, '/');
        urls.push(hq);
      }
    });
    return urls.slice(0, 5);
  });

  if (results.length > 0) {
    // Try downloading up to 3 images
    for (let i = 0; i < Math.min(3, results.length); i++) {
      const imgUrl = results[i];
      console.log(`  URL: ${imgUrl.substring(0, 100)}`);
      try {
        const resp = await fetch(imgUrl);
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer());
          if (buf.length > 10000) { // At least 10KB
            const fp = `${OUT}\\${s.file}-${i+1}.jpg`;
            fs.writeFileSync(fp, buf);
            const kb = (buf.length / 1024).toFixed(0);
            console.log(`  ✅ Descargado: ${s.file}-${i+1}.jpg (${kb}KB)`);
            downloaded.push({ file: `${s.file}-${i+1}.jpg`, kw: s.kw, src: imgUrl });
            break; // Got one good image, move to next search
          }
        }
      } catch(e) {
        console.log(`  ❌ Error: ${e.message.substring(0, 60)}`);
      }
    }
  } else {
    console.log('  ⚠️ No se encontraron imagenes');
  }
}

console.log(`\n Descargadas ${downloaded.length} imagenes:`);
downloaded.forEach(d => console.log(`  - ${d.file} (${d.kw})`));

await browser.disconnect();
console.log('\nCompletado');
