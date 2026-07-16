import puppeteer from 'puppeteer';
import fs from 'fs';

const OUT = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\assets\\images';
const IMG_BASE = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\assets\\images';

fs.mkdirSync(OUT, { recursive: true });

const ADS = [
  {
    name: 'ia',
    title: 'Inteligencia Artificial',
    subtitle: 'Domina la IA desde cero',
    badge: 'NUEVO',
    bg: '/ia-ad-bg.jpg',
    bgColor: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    icon: '🤖',
    price: '$20,000'
  },
  {
    name: 'programacion',
    title: 'Programación',
    subtitle: 'Crea el futuro con código',
    badge: 'DESDE CERO',
    bg: '/programacion-ad-bg.jpg',
    bgColor: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
    icon: '💻',
    price: '$20,000'
  },
  {
    name: 'diseno',
    title: 'Diseño Gráfico',
    subtitle: 'Transforma tu creatividad en carrera',
    badge: 'CREATIVO',
    bg: '/diseno-ad-bg.jpg',
    bgColor: 'linear-gradient(135deg, #ec4899 0%, #f97316 100%)',
    icon: '🎨',
    price: '$20,000'
  },
  {
    name: 'ingles',
    title: 'Inglés',
    subtitle: 'Habla el idioma del éxito',
    badge: 'ONLINE',
    bg: '/ingles-ad-bg.jpg',
    bgColor: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
    icon: '🌎',
    price: '$20,000'
  },
  {
    name: 'piano',
    title: 'Piano y Música',
    subtitle: 'La música es tu mejor inversión',
    badge: 'INCLUIDO',
    bg: '/piano-ad-bg.jpg',
    bgColor: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
    icon: '🎹',
    price: '$60,000'
  },
  {
    name: 'megapack',
    title: 'MegaPack Completo',
    subtitle: '81 cursos en un solo acceso',
    badge: 'AHORRA 70%',
    bg: '/megapack-ad-bg.jpg',
    bgColor: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
    icon: '🚀',
    price: '$60,000'
  }
];

function generateHTML(ad) {
  return `<!DOCTYPE html>
<html>
<head>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body { 
  width: 1200px; height: 630px; 
  font-family: 'Inter', sans-serif;
  overflow: hidden;
  position: relative;
}
.bg { 
  width: 100%; height: 100%; 
  background: ${ad.bgColor};
  position: relative;
}
/* Abstract shapes overlay */
.shapes {
  position: absolute;
  width: 100%; height: 100%;
  top: 0; left: 0;
  overflow: hidden;
  opacity: 0.1;
}
.shapes div {
  position: absolute;
  border-radius: 50%;
  background: white;
}
.shapes .c1 { width: 400px; height: 400px; top: -100px; right: -100px; }
.shapes .c2 { width: 200px; height: 200px; bottom: -50px; left: -50px; }
.shapes .c3 { width: 150px; height: 150px; top: 50%; left: 10%; }
/* Grid pattern */
.grid {
  position: absolute;
  width: 100%; height: 100%;
  top: 0; left: 0;
  background-image: 
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 40px 40px;
}
/* Content */
.content {
  position: relative;
  z-index: 10;
  width: 100%; height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 60px 80px;
}
.badge {
  display: inline-block;
  background: rgba(255,255,255,0.2);
  backdrop-filter: blur(10px);
  color: white;
  font-weight: 700;
  font-size: 14px;
  padding: 8px 20px;
  border-radius: 50px;
  margin-bottom: 20px;
  width: fit-content;
  letter-spacing: 1px;
  text-transform: uppercase;
  border: 1px solid rgba(255,255,255,0.3);
}
.icon { font-size: 48px; margin-bottom: 16px; }
.title {
  font-size: 72px;
  font-weight: 900;
  color: white;
  line-height: 1.1;
  margin-bottom: 12px;
  text-shadow: 0 2px 20px rgba(0,0,0,0.2);
  letter-spacing: -1px;
}
.subtitle {
  font-size: 28px;
  font-weight: 400;
  color: rgba(255,255,255,0.9);
  margin-bottom: 32px;
  line-height: 1.4;
}
.price-row {
  display: flex;
  align-items: center;
  gap: 24px;
}
.price {
  font-size: 36px;
  font-weight: 800;
  color: white;
  text-shadow: 0 2px 10px rgba(0,0,0,0.15);
}
.price span {
  font-weight: 400;
  font-size: 18px;
  opacity: 0.8;
}
.cta {
  background: white;
  color: #1a1a2e;
  font-weight: 700;
  font-size: 16px;
  padding: 14px 32px;
  border-radius: 50px;
  border: none;
  box-shadow: 0 4px 15px rgba(0,0,0,0.15);
  letter-spacing: 0.5px;
}
.footer {
  position: absolute;
  bottom: 24px;
  right: 40px;
  color: rgba(255,255,255,0.5);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  z-index: 10;
}
.wa-badge {
  position: absolute;
  bottom: 24px;
  left: 40px;
  color: rgba(255,255,255,0.6);
  font-size: 14px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
}
.wa-badge::before {
  content: '';
  width: 20px; height: 20px;
  background: #25D366;
  border-radius: 50%;
  display: inline-block;
}
</style>
</head>
<body>
<div class="bg">
  <div class="shapes">
    <div class="c1"></div>
    <div class="c2"></div>
    <div class="c3"></div>
  </div>
  <div class="grid"></div>
  <div class="content">
    <div class="badge">${ad.badge}</div>
    <div class="icon">${ad.icon}</div>
    <div class="title">${ad.title}</div>
    <div class="subtitle">${ad.subtitle}</div>
    <div class="price-row">
      <div class="price">${ad.price} <span>COP</span></div>
      <div class="cta">Enviar WhatsApp</div>
    </div>
  </div>
  <div class="wa-badge">Compra por WhatsApp - Entrega Inmediata</div>
  <div class="footer">VentasPro</div>
</div>
</body>
</html>`;
}

async function generateAd(ad) {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630 });
  
  const html = generateHTML(ad);
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  
  const filePath = OUT + '\\' + ad.name + '-ad.png';
  await page.screenshot({ path: filePath, type: 'png' });
  
  const stats = fs.statSync(filePath);
  await browser.close();
  
  return { file: ad.name + '-ad.png', size: stats.size };
}

async function main() {
  console.log('Generando ads profesionales con Puppeteer...\n');
  
  for (const ad of ADS) {
    console.log('[' + ad.name + '] ' + ad.title + '...');
    try {
      const result = await generateAd(ad);
      const sizeKB = (result.size / 1024).toFixed(0);
      console.log('  ✅ ' + result.file + ' (' + sizeKB + 'KB)');
    } catch (e) {
      console.log('  ❌ ' + e.message);
    }
  }
  
  console.log('\n✅ Todas las imagenes generadas en: ' + OUT);
  fs.readdirSync(OUT).filter(f => f.endsWith('-ad.png')).forEach(f => {
    const s = fs.statSync(OUT + '\\' + f);
    console.log('   ' + f + ' - ' + (s.size/1024).toFixed(0) + 'KB');
  });
}

main().catch(console.error);
