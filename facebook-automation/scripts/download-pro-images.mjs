import fs from 'fs';

const OUT = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\assets\\images';
fs.mkdirSync(OUT, { recursive: true });

// High quality Pexels images by category - landscape orientation
const IMAGES = [
  // IA - Artificial Intelligence
  {
    file: 'ia-bg',
    url: 'https://images.pexels.com/photos/373543/pexels-photo-373543.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
    fallback: 'https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
  },
  // Programacion
  {
    file: 'programacion-bg',
    url: 'https://images.pexels.com/photos/546819/pexels-photo-546819.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
    fallback: 'https://images.pexels.com/photos/577585/pexels-photo-577585.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
  },
  // Diseno
  {
    file: 'diseno-bg',
    url: 'https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
    fallback: 'https://images.pexels.com/photos/574069/pexels-photo-574069.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
  },
  // Ingles
  {
    file: 'ingles-bg',
    url: 'https://images.pexels.com/photos/458418/pexels-photo-458418.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
    fallback: 'https://images.pexels.com/photos/3769021/pexels-photo-3769021.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
  },
  // Piano
  {
    file: 'piano-bg',
    url: 'https://images.pexels.com/photos/210764/pexels-photo-210764.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
    fallback: 'https://images.pexels.com/photos/164709/pexels-photo-164709.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
  },
];

async function download(url, filepath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filepath, buf);
  return buf.length;
}

async function main() {
  console.log('Descargando imagenes profesionales de Pexels...\n');
  
  for (const img of IMAGES) {
    const filePath = OUT + '\\' + img.file + '.jpg';
    console.log('[' + img.file + ']...');
    try {
      let size = await download(img.url, filePath);
      console.log('  ✅ ' + (size/1024).toFixed(0) + 'KB');
    } catch(e) {
      console.log('  ⚠️  Error: ' + e.message.substring(0, 60));
      try {
        let size = await download(img.fallback, filePath);
        console.log('  ✅ Fallback: ' + (size/1024).toFixed(0) + 'KB');
      } catch(e2) {
        console.log('  ❌ Fallback fallo: ' + e2.message.substring(0, 60));
      }
    }
  }
  
  console.log('\nResultados:');
  IMAGES.forEach(img => {
    try {
      const stat = fs.statSync(OUT + '\\' + img.file + '.jpg');
      console.log('  ' + img.file + '.jpg - ' + (stat.size/1024).toFixed(0) + 'KB ✅');
    } catch {
      console.log('  ' + img.file + '.jpg - ❌ No existe');
    }
  });
}

main().catch(console.error);
