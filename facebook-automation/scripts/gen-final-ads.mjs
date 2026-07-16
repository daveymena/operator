import puppeteer from 'puppeteer';
import fs from 'fs';

const OUT = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\assets\\images';
const BG = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\assets\\images';

fs.mkdirSync(OUT, { recursive: true });

const ADS = [
  {
    name: 'ia',
    title: 'Inteligencia Artificial',
    subtitle: 'Domina la IA desde cero',
    badge: 'NUEVO',
    bgImage: 'ia-bg.jpg',
    icon: '🤖',
    price: '$20,000',
    overlay: 'linear-gradient(135deg, rgba(99,102,241,0.85) 0%, rgba(139,92,246,0.8) 100%)'
  },
  {
    name: 'programacion',
    title: 'Programación',
    subtitle: 'Crea el futuro con código',
    badge: 'DESDE CERO',
    bgImage: 'programacion-bg.jpg',
    icon: '💻',
    price: '$20,000',
    overlay: 'linear-gradient(135deg, rgba(59,130,246,0.85) 0%, rgba(6,182,212,0.8) 100%)'
  },
  {
    name: 'diseno',
    title: 'Diseño Gráfico',
    subtitle: 'Transforma tu creatividad en carrera',
    badge: 'CREATIVO',
    bgImage: 'diseno-bg.jpg',
    icon: '🎨',
    price: '$20,000',
    overlay: 'linear-gradient(135deg, rgba(236,72,153,0.85) 0%, rgba(249,115,22,0.8) 100%)'
  },
  {
    name: 'ingles',
    title: 'Inglés',
    subtitle: 'Habla el idioma del éxito',
    badge: 'ONLINE',
    bgImage: 'ingles-bg.jpg',
    icon: '🌎',
    price: '$20,000',
    overlay: 'linear-gradient(135deg, rgba(16,185,129,0.85) 0%, rgba(20,184,166,0.8) 100%)'
  },
  {
    name: 'piano',
    title: 'Piano y Música',
    subtitle: 'La música es tu mejor inversión',
    badge: 'INCLUIDO',
    bgImage: 'piano-bg.jpg',
    icon: '🎹',
    price: '$60,000',
    overlay: 'linear-gradient(135deg, rgba(139,92,246,0.85) 0%, rgba(168,85,247,0.8) 100%)'
  },
  {
    name: 'megapack',
    title: 'MegaPack Completo',
    subtitle: '81 cursos en un solo acceso - Ahorra 70%',
    badge: 'OFERTA',
    bgImage: '../images/megapack-completo.png',
    icon: '🚀',
    price: '$60,000',
    overlay: 'linear-gradient(135deg, rgba(245,158,11,0.85) 0%, rgba(239,68,68,0.8) 100%)'
  }
];

function generateHTML(ad) {
  const bgPath = BG + '\\' + ad.bgImage;
  // Use file:// protocol
  const bgUrl = 'file:///' + bgPath.replace(/\\/g, '/');
  
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
  position: relative;
  background-image: url('${bgUrl}');
  background-size: cover;
  background-position: center;
}
.overlay {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: ${ad.overlay};
}
.shapes {
  position: absolute;
  width: 100%; height: 100%;
  top: 0; left: 0;
  overflow: hidden;
  opacity: 0.08;
}
.shapes div {
  position: absolute;
  border-radius: 50%;
  background: white;
}
.shapes .c1 { width: 500px; height: 500px; top: -150px; right: -150px; }
.shapes .c2 { width: 300px; height: 300px; bottom: -80px; left: -80px; }
.shapes .c3 { width: 200px; height: 200px; top: 40%; left: 20%; }

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
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  color: white;
  font-weight: 700;
  font-size: 13px;
  padding: 7px 18px;
  border-radius: 50px;
  margin-bottom: 18px;
  width: fit-content;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  border: 1px solid rgba(255,255,255,0.25);
}
.icon { font-size: 44px; margin-bottom: 14px; }
.title {
  font-size: 68px;
  font-weight: 900;
  color: white;
  line-height: 1.1;
  margin-bottom: 10px;
  text-shadow: 0 2px 30px rgba(0,0,0,0.3);
  letter-spacing: -1px;
  max-width: 80%;
}
.subtitle {
  font-size: 24px;
  font-weight: 500;
  color: rgba(255,255,255,0.92);
  margin-bottom: 28px;
  line-height: 1.4;
  text-shadow: 0 1px 15px rgba(0,0,0,0.2);
}
.price-row {
  display: flex;
  align-items: center;
  gap: 20px;
}
.price {
  font-size: 32px;
  font-weight: 800;
  color: white;
  text-shadow: 0 2px 15px rgba(0,0,0,0.2);
}
.price span {
  font-weight: 400;
  font-size: 16px;
  opacity: 0.85;
}
.cta {
  background: white;
  color: #1a1a2e;
  font-weight: 700;
  font-size: 15px;
  padding: 12px 28px;
  border-radius: 50px;
  border: none;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  letter-spacing: 0.3px;
}
.footer {
  position: absolute;
  bottom: 22px;
  right: 36px;
  color: rgba(255,255,255,0.5);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  z-index: 10;
}
.wa-badge {
  position: absolute;
  bottom: 22px;
  left: 36px;
  color: rgba(255,255,255,0.65);
  font-size: 13px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
}
.wa-badge::before {
  content: '';
  width: 18px; height: 18px;
  background: #25D366;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.gradient-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: linear-gradient(90deg, rgba(255,255,255,0.4), rgba(255,255,255,0.1));
  z-index: 10;
}
</style>
</head>
<body>
<div class="bg">
  <div class="overlay"></div>
  <div class="shapes">
    <div class="c1"></div>
    <div class="c2"></div>
    <div class="c3"></div>
  </div>
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
  <div class="gradient-bar"></div>
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
  await new Promise(r => setTimeout(r, 1500));
  
  const filePath = OUT + '\\' + ad.name + '-ad.png';
  await page.screenshot({ path: filePath, type: 'png' });
  
  const stats = fs.statSync(filePath);
  await browser.close();
  
  return { file: ad.name + '-ad.png', size: stats.size };
}

async function main() {
  console.log('=== Generando Ads Profesionales con imagenes reales ===\n');
  
  for (const ad of ADS) {
    console.log('[' + ad.name + '] ' + ad.title + '...');
    try {
      const result = await generateAd(ad);
      console.log('  ✅ ' + result.file + ' (' + (result.size/1024).toFixed(0) + 'KB)');
    } catch (e) {
      console.log('  ❌ ' + e.message.substring(0, 80));
    }
  }
  
  console.log('\n=== Resumen Final ===');
  const files = fs.readdirSync(OUT).filter(f => f.endsWith('-ad.png'));
  files.forEach(f => {
    const s = fs.statSync(OUT + '\\' + f);
    console.log('  📷 ' + f + ' - ' + (s.size/1024).toFixed(0) + 'KB');
  });
}

main().catch(console.error);
