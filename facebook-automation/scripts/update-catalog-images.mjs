import fs from 'fs';

const CATALOG_PATH = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\tokens\\megapack-82-productos.json';
const IMG_BASE = 'C:\\\\Users\\\\ADMIN\\\\Music\\\\proyecto-unificado\\\\facebook-automation\\\\assets\\\\images\\\\';

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));

const imageMap = {
  'piano': 'piano.jpg',
  'programacion': 'programacion.jpg',
  'diseno': 'diseno.jpg',
  'ingles': 'ingles.jpg',
  'ia': 'ia.jpg',
};

function matchCategory(name, desc) {
  const text = (name + ' ' + desc).toLowerCase();
  
  if (text.includes('piano') || text.includes('guitarra') || (text.includes('música') && !text.includes('marca'))) {
    return 'piano';
  }
  if (text.includes('programación') || text.includes('programacion') || text.includes('desarrollo web') || text.includes('wordpress') || text.includes('codigo') || text.includes('código') || text.includes('programador')) {
    return 'programacion';
  }
  if (text.includes('diseño') || text.includes('diseno') || text.includes('gráfico') || text.includes('grafico') || text.includes('photoshop') || text.includes('ilustración') || text.includes('ilustracion') || text.includes('logotipo') || text.includes('branding') || text.includes('editorial') || text.includes('indesign') || text.includes('filmora') || text.includes('cinema') || text.includes('animación') || text.includes('animacion') || text.includes('lettering') || text.includes('canva') || text.includes('interfaz') || text.includes('fotomontaje') || text.includes('sublimado') || text.includes('portada') || text.includes('infografía') || text.includes('infografia') || text.includes('cuadro') || text.includes('premiere') || (text.includes('marca') && text.includes('visual'))) {
    return 'diseno';
  }
  if (text.includes('inglés') || text.includes('ingles') || text.includes('idioma') || text.includes('oxford')) {
    return 'ingles';
  }
  if (text.includes('hacking') || text.includes('ciberseguridad')) {
    return 'ia';
  }
  
  return null;
}

let updatedCount = 0;

for (const product of catalog) {
  const currentImg = product.images?.[0] || '';
  
  // Only replace local placeholder images (paths without proper backslash, or specific png files)
  const isLocalPlaceholder = currentImg.startsWith('C:') || currentImg === '';
  
  if (isLocalPlaceholder) {
    const match = matchCategory(product.name, product.description);
    if (match && imageMap[match]) {
      product.images = [`${IMG_BASE}${imageMap[match]}`];
      updatedCount++;
      console.log(`  [${match}] ${product.id}: ${product.name}`);
    }
  }
}

// MegaPack Completo (id 83) - use ia image as generic tech
const megapack = catalog.find(p => p.id === 83 || p.name === 'MegaPack Completo');
if (megapack && (megapack.images?.length === 0 || (megapack.images?.[0] || '').startsWith('C:'))) {
  megapack.images = [`${IMG_BASE}ia.jpg`];
  updatedCount++;
  console.log(`  [megapack] MegaPack Completo`);
}

fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
console.log(`\n Actualizados ${updatedCount} productos`);
