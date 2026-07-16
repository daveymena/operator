import puppeteer from 'puppeteer';
import fs from 'fs';

const OUT = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\assets\\images';

function generateHTML(ad) {
  const bgUrl = 'file:///' + (OUT + '\\' + ad.bg).replace(/\\/g, '/');
  
  return `<!DOCTYPE html>
<html>
<head>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }

body { 
  width: 1200px; height: 630px; 
  font-family: 'Inter', sans-serif;
  overflow: hidden;
  background: ${ad.bgColor};
  position: relative;
}

/* Grid pattern background */
.grid-bg {
  position: absolute;
  width: 100%; height: 100%;
  background-image: 
    radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0);
  background-size: 30px 30px;
}

/* Decorative circles */
.circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255,255,255,0.04);
}
.c1 { width: 600px; height: 600px; top: -200px; right: -150px; }
.c2 { width: 350px; height: 350px; bottom: -100px; left: -100px; }

/* Product showcase area - LEFT */
.product-area {
  position: absolute;
  left: 50px;
  top: 50%;
  transform: translateY(-50%);
  width: 480px;
  z-index: 10;
}

/* Laptop mockup */
.laptop {
  position: relative;
  width: 480px;
  height: 310px;
}

.laptop-screen {
  width: 100%;
  height: 280px;
  background: linear-gradient(135deg, ${ad.screenColor1}, ${ad.screenColor2});
  border-radius: 16px 16px 0 0;
  border: 4px solid #2a2a3e;
  border-bottom: none;
  position: relative;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Content on screen */
.screen-content {
  text-align: center;
  padding: 30px;
}

.screen-icon {
  font-size: 56px;
  margin-bottom: 12px;
}

.screen-title {
  color: white;
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 6px;
}

.screen-sub {
  color: rgba(255,255,255,0.75);
  font-size: 13px;
  font-weight: 500;
}

/* Decorative elements on screen */
.screen-dots {
  position: absolute;
  top: 12px;
  left: 16px;
  display: flex;
  gap: 6px;
}
.screen-dots span {
  width: 8px; height: 8px;
  border-radius: 50%;
  display: block;
}
.screen-dots .r { background: #ff5f57; }
.screen-dots .y { background: #ffbd2e; }
.screen-dots .g { background: #28c840; }

.screen-shapes {
  position: absolute;
  bottom: 0; left: 0;
  width: 100%; height: 60%;
  background: linear-gradient(180deg, transparent, rgba(255,255,255,0.06));
}

/* Laptop base */
.laptop-base {
  width: 110%;
  height: 20px;
  background: linear-gradient(180deg, #2a2a3e, #1a1a2e);
  border-radius: 0 0 8px 8px;
  margin-left: -5%;
  position: relative;
}
.laptop-base::after {
  content: '';
  width: 60px; height: 4px;
  background: #3a3a4e;
  border-radius: 4px;
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
}

/* Phone mockup */
.phone {
  position: absolute;
  right: -30px;
  bottom: -30px;
  width: 120px;
  height: 200px;
  background: linear-gradient(135deg, ${ad.screenColor1}, ${ad.screenColor2});
  border: 3px solid #2a2a3e;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}
.phone-content {
  text-align: center;
  padding: 10px;
}
.phone-icon { font-size: 28px; }
.phone-text { color: white; font-size: 10px; font-weight: 600; margin-top: 4px; }

/* INFO AREA - RIGHT */
.info-area {
  position: absolute;
  right: 60px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  max-width: 520px;
  text-align: right;
}

.badge {
  display: inline-block;
  background: rgba(255,255,255,0.15);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  color: white;
  font-weight: 700;
  font-size: 12px;
  padding: 6px 16px;
  border-radius: 50px;
  margin-bottom: 14px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  border: 1px solid rgba(255,255,255,0.15);
}

.title {
  font-size: 58px;
  font-weight: 900;
  color: white;
  line-height: 1.05;
  margin-bottom: 10px;
  text-shadow: 0 2px 30px rgba(0,0,0,0.2);
  letter-spacing: -0.5px;
}

.subtitle {
  font-size: 20px;
  font-weight: 500;
  color: rgba(255,255,255,0.85);
  margin-bottom: 8px;
  text-shadow: 0 1px 10px rgba(0,0,0,0.15);
}

.features {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 20px;
}
.feature {
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.9);
  padding: 5px 14px;
  border-radius: 50px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid rgba(255,255,255,0.06);
}

.price-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
}
.price {
  font-size: 28px;
  font-weight: 800;
  color: white;
  text-shadow: 0 2px 15px rgba(0,0,0,0.15);
}
.price span {
  font-weight: 400;
  font-size: 14px;
  opacity: 0.8;
}
.cta {
  background: white;
  color: #1a1a2e;
  font-weight: 700;
  font-size: 14px;
  padding: 11px 24px;
  border-radius: 50px;
  border: none;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  cursor: pointer;
  letter-spacing: 0.3px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.footer {
  position: absolute;
  bottom: 18px;
  right: 36px;
  color: rgba(255,255,255,0.35);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  z-index: 10;
}

.wa-ribbon {
  position: absolute;
  bottom: 18px;
  left: 36px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(37,211,102,0.15);
  padding: 4px 14px;
  border-radius: 50px;
  border: 1px solid rgba(37,211,102,0.2);
}
.wa-ribbon svg { width: 16px; height: 16px; }
.wa-ribbon span { color: rgba(255,255,255,0.6); font-size: 11px; font-weight: 500; }

</style>
</head>
<body>
<div class="grid-bg"></div>
<div class="circle c1"></div>
<div class="circle c2"></div>

<!-- LEFT: Product Mockup -->
<div class="product-area">
  <div class="laptop">
    <div class="laptop-screen">
      <div class="screen-dots">
        <span class="r"></span>
        <span class="y"></span>
        <span class="g"></span>
      </div>
      <div class="screen-content">
        <div class="screen-icon">${ad.icon}</div>
        <div class="screen-title">${ad.screenTitle}</div>
        <div class="screen-sub">${ad.screenSub}</div>
      </div>
      <div class="screen-shapes"></div>
    </div>
    <div class="laptop-base"></div>
  </div>
  <!-- Phone -->
  <div class="phone">
    <div class="phone-content">
      <div class="phone-icon">${ad.icon}</div>
      <div class="phone-text">Curso Online</div>
    </div>
  </div>
</div>

<!-- RIGHT: Info -->
<div class="info-area">
  <div class="badge">${ad.badge}</div>
  <div class="title">${ad.title}</div>
  <div class="subtitle">${ad.subtitle}</div>
  <div class="features">
    ${ad.features.map(f => '<div class="feature">' + f + '</div>').join('')}
  </div>
  <div class="price-row">
    <div style="display:flex;flex-direction:column;align-items:flex-end;">
      <div class="price">${ad.price} <span>COP</span></div>
    </div>
    <div class="cta">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M23.5 11.5C23.5 6.26 19.24 2 14 2S4.5 6.26 4.5 11.5c0 2.5.8 4.8 2.2 6.6L3.5 22l4.1-2.4c1.8.9 3.9 1.4 6.4 1.4 5.24 0 9.5-4.26 9.5-9.5z" fill="#25D366"/><path d="M14 4C9.86 4 6.5 7.36 6.5 11.5c0 1.6.5 3 1.4 4.2l-.8 2.5 2.7-1.6c1.2.6 2.5.9 3.8.9 4.14 0 7.5-3.36 7.5-7.5S18.14 4 14 4zm-1.5 11.5c-.5 0-1-.2-1.4-.5l-2.5-2.5c-.4-.4-.6-.9-.6-1.4s.2-1 .6-1.4l.6-.6c.2-.2.4-.2.6-.2s.4 0 .6.2l1.5 1.5c.2.2.2.4 0 .6l-.6.6c-.2.2-.2.4 0 .6l2.5 2.5c.2.2.4.2.6 0l.6-.6c.2-.2.4-.2.6 0l1.5 1.5c.2.2.2.4 0 .6l-.6.6c-.4.4-.9.6-1.4.6z" fill="white"/></svg>
      Enviar WhatsApp
    </div>
  </div>
</div>

<div class="wa-ribbon">
  <svg viewBox="0 0 24 24" fill="#25D366"><path d="M23.5 11.5C23.5 6.26 19.24 2 14 2S4.5 6.26 4.5 11.5c0 2.5.8 4.8 2.2 6.6L3.5 22l4.1-2.4c1.8.9 3.9 1.4 6.4 1.4 5.24 0 9.5-4.26 9.5-9.5z"/></svg>
  <span>Compra por WhatsApp</span>
</div>
<div class="footer">VentasPro</div>
</body>
</html>`;
}

const ADS = [
  {
    name: 'ia',
    title: 'Inteligencia Artificial',
    subtitle: 'Domina la IA desde cero',
    screenTitle: 'Curso de IA',
    screenSub: 'Aprende Machine Learning',
    badge: 'NUEVO',
    icon: '🤖',
    price: '$20,000',
    bgColor: '#1a1a3e',
    screenColor1: '#6366f1',
    screenColor2: '#8b5cf6',
    features: ['Clases en video', 'Proyectos practicos', 'Certificado', 'Acceso vitalicio']
  },
  {
    name: 'programacion',
    title: 'Programación',
    subtitle: 'Crea el futuro con codigo',
    screenTitle: 'Curso de Programacion',
    screenSub: 'HTML, CSS, JavaScript y mas',
    badge: 'DESDE CERO',
    icon: '💻',
    price: '$20,000',
    bgColor: '#0a1a3e',
    screenColor1: '#3b82f6',
    screenColor2: '#06b6d4',
    features: ['Full Stack', 'Proyectos reales', 'Certificado', 'Acceso vitalicio']
  },
  {
    name: 'diseno',
    title: 'Diseno Grafico',
    subtitle: 'Transforma tu creatividad en carrera',
    screenTitle: 'Curso de Diseno',
    screenSub: 'Photoshop, Illustrator y mas',
    badge: 'CREATIVO',
    icon: '🎨',
    price: '$20,000',
    bgColor: '#2a0a2e',
    screenColor1: '#ec4899',
    screenColor2: '#f97316',
    features: ['Adobe Suite', 'Proyectos', 'Portafolio', 'Acceso vitalicio']
  },
  {
    name: 'ingles',
    title: 'Ingles',
    subtitle: 'Habla el idioma del exito',
    screenTitle: 'Curso de Ingles',
    screenSub: 'Basico a Avanzado',
    badge: 'ONLINE',
    icon: '🌎',
    price: '$20,000',
    bgColor: '#0a1a1e',
    screenColor1: '#10b981',
    screenColor2: '#14b8a6',
    features: ['Todos los niveles', 'Conversacion', 'Certificado', 'Acceso vitalicio']
  },
  {
    name: 'piano',
    title: 'Piano y Musica',
    subtitle: 'La musica es tu mejor inversion',
    screenTitle: 'Curso de Piano',
    screenSub: 'Nivel Principiante a Experto',
    badge: 'INCLUIDO',
    icon: '🎹',
    price: '$60,000',
    bgColor: '#1a0a2e',
    screenColor1: '#8b5cf6',
    screenColor2: '#a855f7',
    features: ['Partituras', 'Tecnica', 'Canciones', 'Acceso vitalicio']
  },
  {
    name: 'megapack',
    title: 'MegaPack Completo',
    subtitle: '81 cursos en un solo acceso',
    screenTitle: '81 Cursos',
    screenSub: 'Todas las categorias',
    badge: 'AHORRA 70%',
    icon: '🚀',
    price: '$60,000',
    bgColor: '#1a0a00',
    screenColor1: '#f59e0b',
    screenColor2: '#ef4444',
    features: ['81 cursos', 'Todas las areas', 'Certificados', 'Acceso vitalicio']
  }
];

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
  
  const filePath = OUT + '\\' + ad.name + '-product.png';
  await page.screenshot({ path: filePath, type: 'png' });
  const stats = fs.statSync(filePath);
  await browser.close();
  return { file: ad.name + '-product.png', size: stats.size };
}

async function main() {
  console.log('=== Generando Ads con MOCKUPS DE PRODUCTO ===\n');
  
  for (const ad of ADS) {
    console.log('[' + ad.name + '] ' + ad.title + '...');
    try {
      const r = await generateAd(ad);
      console.log('  ✅ ' + r.file + ' (' + (r.size/1024).toFixed(0) + 'KB)');
    } catch(e) { console.log('  ❌ ' + e.message.substring(0, 80)); }
  }
  
  console.log('\n=== Resultados ===');
  fs.readdirSync(OUT).filter(f => f.endsWith('-product.png')).forEach(f => {
    console.log('  📷 ' + f + ' - ' + (fs.statSync(OUT + '\\' + f).size/1024).toFixed(0) + 'KB');
  });
}

main().catch(console.error);
