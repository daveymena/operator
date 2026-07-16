// Download DALL-E images properly - uses network interception + fetch
import puppeteer from 'puppeteer';
import fs from 'fs';

const REMAINING = [
  { file: 'diseno-grafico', text: 'Latin American graphic designer working on laptop in bright home office, flat lay with tablet and color palette, warm natural lighting, cozy professional atmosphere, commercial photography 4k --ar 4:5' },
  { file: 'excel-oficina', text: 'Colombian professional woman working with Excel on dual monitors, charts visible, organized desk, natural lighting, corporate office, commercial photography 4k --ar 4:5' },
  { file: 'hacking', text: 'Latin American cybersecurity professional dimly lit room, multiple monitors code and network diagrams, blue ambient lighting, hoodie headphones, hacker aesthetic, commercial photography 4k --ar 4:5' },
  { file: 'piano', text: 'Hands playing grand piano warm elegant room, natural light window, sheet music, cozy Latin American home, professional musician, emotional mood, commercial photography 4k --ar 4:5' },
];

const ALL = [
  { file: 'megapack-completo', text: 'Professional collage showing multiple digital course thumbnails arranged in a grid, diverse Latin American students learning coding design language engineering, warm golden gradient overlay, online education platform, clean commercial photography 4k --ar 4:5' },
  { file: 'diseno-grafico', text: 'Latin American graphic designer working on laptop in bright home office, flat lay with tablet and color palette, warm natural lighting, cozy professional atmosphere, commercial photography 4k --ar 4:5' },
  { file: 'programacion', text: 'Young Colombian programmer coding on dual monitor setup modern home office, colorful code screens, coffee mug, plants, warm evening lighting, cozy apartment, commercial photography 4k --ar 4:5' },
  { file: 'marketing', text: 'Latin American entrepreneur analyzing marketing data on tablet modern office, smartphone social media dashboard, laptop, natural daylight, professional warm tones, commercial photography 4k --ar 4:5' },
  { file: 'idiomas', text: 'Young Colombian student learning English with headphones smartphone, bilingual notebook, cozy bedroom study corner plants warm lighting, authentic Latin American home, commercial photography 4k --ar 4:5' },
  { file: 'excel-oficina', text: 'Colombian professional woman working with Excel on dual monitors, charts visible, organized desk, natural lighting, corporate office, commercial photography 4k --ar 4:5' },
  { file: 'ingenieria', text: 'Latin American architect reviewing blueprints on large wooden table, yellow hard hat, tablet showing 3D building model, natural light window, construction site, commercial photography 4k --ar 4:5' },
  { file: 'hacking', text: 'Latin American cybersecurity professional dimly lit room, multiple monitors code and network diagrams, blue ambient lighting, hoodie headphones, hacker aesthetic, commercial photography 4k --ar 4:5' },
  { file: 'piano', text: 'Hands playing grand piano warm elegant room, natural light window, sheet music, cozy Latin American home, professional musician, emotional mood, commercial photography 4k --ar 4:5' },
];

const OUT = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\assets\\images';
fs.mkdirSync(OUT, { recursive: true });
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('🎨 GENERANDO/DESCARGANDO IMÁGENES DALL-E\n');

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const page = (await browser.pages()).find(p => p.url().includes('chatgpt.com'));
  if (!page) { console.log('❌ No ChatGPT tab'); await browser.disconnect(); return; }
  await page.bringToFront();

  // Check which we need to regenerate (small files)
  const toGenerate = ALL.filter(item => {
    try {
      const stat = fs.statSync(`${OUT}/${item.file}.png`);
      return stat.size < 50000; // less than 50KB = bad
    } catch { return true; }
  });

  console.log(`Necesitan regenerarse: ${toGenerate.map(i => i.file).join(', ') || 'ninguno'}`);
  if (toGenerate.length === 0) {
    console.log('✅ Todas las imágenes están bien. Pasamos a los borradores.');
    await browser.disconnect();
    return;
  }

  for (let i = 0; i < toGenerate.length; i++) {
    const { file, text } = toGenerate[i];
    console.log(`\n[${i+1}/${toGenerate.length}] ${file}...`);

    // Fresh chat
    await page.goto('https://chatgpt.com', { timeout: 20000, waitUntil: 'domcontentloaded' });
    await sleep(3000);

    // Type prompt
    await page.evaluate((txt) => {
      const div = document.querySelector('#prompt-textarea');
      if (!div) return;
      div.focus();
      div.innerHTML = '';
      document.execCommand('insertText', false, txt);
    }, text);
    await sleep(800);

    // Click send
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="send-button"]');
      if (btn) btn.click();
    });
    console.log('   ⏳ Generando...');

    // Wait for image and capture via network
    let imageBuffer = null;
    let imageUrl = null;

    // Set up network response capture
    const responseHandler = async (response) => {
      const url = response.url();
      if (url.includes('oaidalleapiprodscus') || url.includes('dalle')) {
        try {
          const buffer = await response.buffer();
          if (buffer.length > 50000) {
            imageBuffer = buffer;
            imageUrl = url;
          }
        } catch(e) {}
      }
    };

    page.on('response', responseHandler);

    // Wait for it
    for (let w = 0; w < 120; w++) {
      await sleep(2000);
      if (imageBuffer && imageBuffer.length > 50000) break;

      // Also check page for existing image
      if (!imageUrl) {
        imageUrl = await page.evaluate(() => {
          const imgs = document.querySelectorAll('img');
          for (const img of imgs) {
            const src = img.src || '';
            if (src.includes('oaidalleapiprodscus') || src.includes('dalle')) return src;
          }
          return null;
        });
      }

      if (imageUrl && !imageBuffer) {
        // Try to fetch from the page context
        try {
          imageBuffer = Buffer.from(await page.evaluate(async (url) => {
            const res = await fetch(url);
            const blob = await res.blob();
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
          }, imageUrl), 'base64');
        } catch(e) {}
      }

      if (imageBuffer && imageBuffer.length > 50000) break;
      process.stdout.write('.');
    }

    page.removeListener('response', responseHandler);
    console.log();

    if (imageBuffer && imageBuffer.length > 50000) {
      const path = `${OUT}/${file}.png`;
      fs.writeFileSync(path, imageBuffer);
      console.log(`   ✅ ${path} (${(imageBuffer.length/1024).toFixed(0)}KB)`);
    } else {
      console.log(`   ❌ No se pudo obtener la imagen`);
    }
  }

  console.log(`\n✅ Completado`);
  await browser.disconnect();
}

main().catch(e => console.log('FATAL:', e.message));
