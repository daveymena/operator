// Descarga imágenes gratis de Pexels para las categorías que faltan
import fs from 'fs';

const OUT = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\assets\\images';

const IMAGES = [
  {
    file: 'diseno-grafico',
    url: 'https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?w=600&h=750&fit=crop',
    fallback: 'https://images.pexels.com/photos/574069/pexels-photo-574069.jpeg?w=600&h=750&fit=crop'
  },
  {
    file: 'excel-oficina',
    url: 'https://images.pexels.com/photos/669615/pexels-photo-669615.jpeg?w=600&h=750&fit=crop',
    fallback: 'https://images.pexels.com/photos/3803521/pexels-photo-3803521.jpeg?w=600&h=750&fit=crop'
  },
  {
    file: 'hacking',
    url: 'https://images.pexels.com/photos/5380664/pexels-photo-5380664.jpeg?w=600&h=750&fit=crop',
    fallback: 'https://images.pexels.com/photos/577585/pexels-photo-577585.jpeg?w=600&h=750&fit=crop'
  },
  {
    file: 'piano',
    url: 'https://images.pexels.com/photos/164709/pexels-photo-164709.jpeg?w=600&h=750&fit=crop',
    fallback: 'https://images.pexels.com/photos/7207220/pexels-photo-7207220.jpeg?w=600&h=750&fit=crop'
  }
];

fs.mkdirSync(OUT, { recursive: true });

async function download(url, filepath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filepath, buf);
  return buf.length;
}

async function main() {
  console.log('📥 Descargando imágenes de Pexels...\n');
  for (const img of IMAGES) {
    const path = `${OUT}/${img.file}.png`;
    console.log(`[${img.file}]...`);
    try {
      const size = await download(img.url, path);
      console.log(`   ✅ ${(size/1024).toFixed(0)}KB`);
    } catch(e) {
      console.log(`   ⚠️  Error: ${e.message}. Usando fallback...`);
      try {
        const size = await download(img.fallback, path);
        console.log(`   ✅ Fallback: ${(size/1024).toFixed(0)}KB`);
      } catch(e2) {
        console.log(`   ❌ Fallback también falló: ${e2.message}`);
      }
    }
  }
  
  // Show final sizes
  console.log('\n📊 Resultados:');
  IMAGES.forEach(img => {
    try {
      const stat = fs.statSync(`${OUT}/${img.file}.png`);
      console.log(`   ${img.file}: ${(stat.size/1024).toFixed(0)}KB ${stat.size > 50000 ? '✅' : '⚠️ pequeño'}`);
    } catch {
      console.log(`   ${img.file}: ❌ no existe`);
    }
  });
}

main().catch(e => console.log('FATAL:', e.message));
