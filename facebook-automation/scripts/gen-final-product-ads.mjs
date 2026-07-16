import puppeteer from 'puppeteer';
import fs from 'fs';

const OUT = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\assets\\images';

function html(ad) {
  const bg = 'file:///' + (OUT + '\\' + ad.bg).replace(/\\/g, '/');

  return `<!DOCTYPE html>
<html><head><style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;font-family:'Inter',sans-serif;overflow:hidden;position:relative}
.bg{width:100%;height:100%;background-image:url('${bg}');background-size:cover;background-position:center;position:relative}
.overlay{position:absolute;top:0;left:0;width:100%;height:100%;background:${ad.overlay}}
.grad{position:absolute;bottom:0;left:0;width:100%;height:50%;background:linear-gradient(0deg,rgba(0,0,0,0.6),transparent)}
.content{position:absolute;bottom:40px;left:50px;right:50px;z-index:10}
.row{display:flex;align-items:flex-end;justify-content:space-between}
.left{max-width:65%}
.badge{display:inline-block;background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);color:#fff;font-weight:700;font-size:11px;padding:5px 14px;border-radius:50px;margin-bottom:10px;letter-spacing:1.5px;text-transform:uppercase;border:1px solid rgba(255,255,255,0.12)}
.title{font-size:52px;font-weight:900;color:#fff;line-height:1.05;margin-bottom:4px;text-shadow:0 2px 20px rgba(0,0,0,0.3);letter-spacing:-0.5px}
.subtitle{font-size:18px;font-weight:500;color:rgba(255,255,255,0.85);text-shadow:0 1px 10px rgba(0,0,0,0.2)}
.right{text-align:right;flex-shrink:0}
.price{font-size:30px;font-weight:800;color:#fff;text-shadow:0 2px 15px rgba(0,0,0,0.2)}
.price span{font-weight:400;font-size:14px;opacity:0.8}
.cta{background:#25D366;color:#fff;font-weight:700;font-size:15px;padding:12px 28px;border-radius:50px;border:none;box-shadow:0 4px 20px rgba(0,0,0,0.3);cursor:pointer;display:inline-flex;align-items:center;gap:8px;margin-top:8px}
.features{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.feature{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.8);padding:4px 12px;border-radius:50px;font-size:11px;font-weight:500;border:1px solid rgba(255,255,255,0.06)}
.brand{position:absolute;top:24px;right:32px;z-index:10;color:rgba(255,255,255,0.4);font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase}
.ribbon{position:absolute;top:24px;left:32px;z-index:10;display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.25);backdrop-filter:blur(8px);padding:4px 14px;border-radius:50px}
.ribbon svg{width:14px;height:14px}
.ribbon span{color:rgba(255,255,255,0.7);font-size:10px;font-weight:600;letter-spacing:0.5px}
</style></head>
<body>
<div class="bg">
  <div class="overlay"></div>
  <div class="grad"></div>
  <div class="ribbon">
    <svg viewBox="0 0 24 24" fill="#25D366"><path d="M23.5 11.5C23.5 6.26 19.24 2 14 2S4.5 6.26 4.5 11.5c0 2.5.8 4.8 2.2 6.6L3.5 22l4.1-2.4c1.8.9 3.9 1.4 6.4 1.4 5.24 0 9.5-4.26 9.5-9.5z"/></svg>
    <span>COMPRA POR WHATSAPP</span>
  </div>
  <div class="brand">VentasPro</div>
  <div class="content">
    <div class="row">
      <div class="left">
        <div class="badge">${ad.badge}</div>
        <div class="title">${ad.title}</div>
        <div class="subtitle">${ad.subtitle}</div>
        <div class="features">
          ${ad.features.map(f => '<div class="feature">' + f + '</div>').join('')}
        </div>
      </div>
      <div class="right">
        <div class="price">${ad.price} <span>COP</span></div>
        <div class="cta">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          WhatsApp
        </div>
      </div>
    </div>
  </div>
</div>
</body></html>`;
}

const ADS = [
  { name:'ia', bg:'ia-real.jpg', title:'Inteligencia Artificial', subtitle:'Domina la IA desde cero', badge:'NUEVO', price:'$20,000', overlay:'linear-gradient(135deg, rgba(99,102,241,0.75) 0%, rgba(0,0,0,0.4) 100%)', features:['Machine Learning','Python','Redes Neuronales','Certificado'] },
  { name:'programacion', bg:'programacion-real.jpg', title:'Programacion', subtitle:'Crea el futuro con codigo', badge:'DESDE CERO', price:'$20,000', overlay:'linear-gradient(135deg, rgba(59,130,246,0.75) 0%, rgba(0,0,0,0.4) 100%)', features:['Full Stack','JavaScript','Python','Certificado'] },
  { name:'diseno', bg:'diseno-real.jpg', title:'Diseno Grafico', subtitle:'Transforma tu creatividad en carrera', badge:'CREATIVO', price:'$20,000', overlay:'linear-gradient(135deg, rgba(236,72,153,0.75) 0%, rgba(0,0,0,0.4) 100%)', features:['Photoshop','Illustrator','After Effects','Certificado'] },
  { name:'ingles', bg:'ingles-real.jpg', title:'Ingles', subtitle:'Habla el idioma del exito', badge:'ONLINE', price:'$20,000', overlay:'linear-gradient(135deg, rgba(16,185,129,0.75) 0%, rgba(0,0,0,0.4) 100%)', features:['Basico a Avanzado','Conversacion','Negocios','Certificado'] },
  { name:'piano', bg:'piano-real.jpg', title:'Piano y Musica', subtitle:'La musica es tu mejor inversion', badge:'INCLUIDO', price:'$60,000', overlay:'linear-gradient(135deg, rgba(139,92,246,0.75) 0%, rgba(0,0,0,0.4) 100%)', features:['Principiante','Partituras','Tecnica','Certificado'] },
  { name:'megapack', bg:'megapack-real.jpg', title:'MegaPack Completo', subtitle:'81 cursos en un solo acceso', badge:'AHORRA 70%', price:'$60,000', overlay:'linear-gradient(135deg, rgba(245,158,11,0.75) 0%, rgba(0,0,0,0.4) 100%)', features:['81 Cursos','Todas las areas','Acceso total','Certificados'] }
];

async function gen(ad) {
  const b = await puppeteer.launch({ headless:true, args:['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({width:1200,height:630});
  await p.setContent(html(ad), {waitUntil:'networkidle0'});
  await new Promise(r => setTimeout(r, 1500));
  const fp = OUT + '\\' + ad.name + '-final.png';
  await p.screenshot({path:fp,type:'png'});
  const s = fs.statSync(fp).size;
  await b.close();
  return {file: ad.name + '-final.png', size:s};
}

async function main() {
  console.log('=== Ads con FOTOS REALES del producto ===\n');
  for (const ad of ADS) {
    console.log('[' + ad.name + '] ' + ad.title + '...');
    try { const r = await gen(ad); console.log('  ✅ ' + r.file + ' (' + (r.size/1024).toFixed(0) + 'KB)'); }
    catch(e) { console.log('  ❌ ' + e.message.substring(0,80)); }
  }
  console.log('\n=== Resultados ===');
  fs.readdirSync(OUT).filter(f => f.endsWith('-final.png')).forEach(f => {
    console.log('  📷 ' + f + ' - ' + (fs.statSync(OUT+'\\'+f).size/1024).toFixed(0) + 'KB');
  });
}

main().catch(console.error);
