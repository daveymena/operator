import fs from 'fs';

const OUT = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\assets\\images';

const SEARCHES = [
  // IA - Person working with AI/technology
  { 
    file: 'ia-real',
    url: 'https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
    fallback: 'https://images.pexels.com/photos/1181298/pexels-photo-1181298.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
    desc: 'Persona con tecnologia'
  },
  // Programacion - Person coding
  { 
    file: 'programacion-real',
    url: 'https://images.pexels.com/photos/3861961/pexels-photo-3861961.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
    fallback: 'https://images.pexels.com/photos/1181672/pexels-photo-1181672.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
    desc: 'Persona programando'
  },
  // Diseno - Person designing
  { 
    file: 'diseno-real',
    url: 'https://images.pexels.com/photos/5756911/pexels-photo-5756911.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
    fallback: 'https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
    desc: 'Persona disenando'
  },
  // Ingles - Person studying/learning
  { 
    file: 'ingles-real',
    url: 'https://images.pexels.com/photos/3769021/pexels-photo-3769021.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
    fallback: 'https://images.pexels.com/photos/5212345/pexels-photo-5212345.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
    desc: 'Persona estudiando'
  },
  // Piano - Person playing piano
  { 
    file: 'piano-real',
    url: 'https://images.pexels.com/photos/164709/pexels-photo-164709.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
    fallback: 'https://images.pexels.com/photos/210764/pexels-photo-210764.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
    desc: 'Persona tocando piano'
  },
  // Megapack - Bundle/collage
  { 
    file: 'megapack-real',
    url: 'https://images.pexels.com/photos/546819/pexels-photo-546819.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
    fallback: 'https://images.pexels.com/photos/1181298/pexels-photo-1181298.jpeg?auto=compress&cs=tinysrgb&w=1260&h=630&fit=crop',
    desc: 'Collage cursos'
  }
];

async function download(url, filepath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filepath, buf);
  return buf.length;
}

async function main() {
  console.log('=== Buscando imagenes REALES del producto ===\n');
  
  for (const s of SEARCHES) {
    const filePath = OUT + '\\' + s.file + '.jpg';
    console.log('[' + s.file + '] ' + s.desc + '...');
    try {
      const size = await download(s.url, filePath);
      console.log('  ✅ ' + (size/1024).toFixed(0) + 'KB');
    } catch(e) {
      console.log('  ⚠️  ' + e.message.substring(0, 60));
      try {
        const size = await download(s.fallback, filePath);
        console.log('  ✅ Fallback: ' + (size/1024).toFixed(0) + 'KB');
      } catch(e2) {
        console.log('  ❌ Error: ' + e2.message.substring(0, 60));
      }
    }
  }
  
  console.log('\n=== Resultados ===');
  SEARCHES.forEach(s => {
    try {
      const stat = fs.statSync(OUT + '\\' + s.file + '.jpg');
      console.log('  📷 ' + s.file + '.jpg - ' + (stat.size/1024).toFixed(0) + 'KB ✅');
    } catch {
      console.log('  📷 ' + s.file + '.jpg - ❌');
    }
  });
}

main().catch(console.error);
