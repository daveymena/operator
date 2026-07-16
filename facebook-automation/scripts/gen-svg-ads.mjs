import fs from 'fs';

const KEY = process.env.ZEN_API_KEY;
const BASE = 'https://opencode.ai/zen/v1';
const OUT = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\assets\\images';

fs.mkdirSync(OUT, { recursive: true });

const CATEGORIES = [
  {
    name: 'ia',
    title: 'Inteligencia Artificial',
    subtitle: 'Domina la IA desde cero',
    color1: '#6366f1',
    color2: '#8b5cf6',
    icon: '🤖'
  },
  {
    name: 'programacion',
    title: 'Programación',
    subtitle: 'Crea software, cambia el mundo',
    color1: '#3b82f6',
    color2: '#06b6d4',
    icon: '💻'
  },
  {
    name: 'diseno',
    title: 'Diseño Gráfico',
    subtitle: 'Transforma tu creatividad en carrera',
    color1: '#ec4899',
    color2: '#f97316',
    icon: '🎨'
  },
  {
    name: 'ingles',
    title: 'Inglés',
    subtitle: 'Habla el idioma del éxito',
    color1: '#10b981',
    color2: '#14b8a6',
    icon: '🌎'
  },
  {
    name: 'piano',
    title: 'Piano y Música',
    subtitle: 'La música es tu mejor inversión',
    color1: '#8b5cf6',
    color2: '#a855f7',
    icon: '🎹'
  }
];

async function generateSVG(cat) {
  const prompt = `Create a professional Facebook ad banner SVG (1200x630 pixels) for an online course. Design specifications:
- Background: modern gradient from ${cat.color1} to ${cat.color2}
- A subtle geometric pattern or abstract shapes overlay
- Large bold text centered: "${cat.title}" in white, font size ~72px
- Subtitle: "${cat.subtitle}" in white/light gray, font size ~28px
- A small decorative ${cat.icon} icon
- Bottom: "VentasPro" brand name in small text
- Clean, modern, professional look suitable for social media ads
- DO NOT use external fonts, use system sans-serif
- Make it look like a premium online course ad
Output ONLY valid SVG code, no explanation, no markdown formatting.`;

  const body = JSON.stringify({
    model: 'deepseek-v4-flash-free',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2000,
    temperature: 0.3
  });

  const res = await fetch(BASE + '/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + KEY,
      'Content-Type': 'application/json'
    },
    body
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(res.status + ': ' + err.substring(0, 100));
  }

  const data = await res.json();
  let svg = data.choices[0].message.content;
  
  // Extract SVG from markdown if wrapped
  const svgMatch = svg.match(/<svg[\s\S]*?<\/svg>/i);
  if (svgMatch) svg = svgMatch[0];
  
  // Validate it has SVG tags
  if (!svg.includes('<svg')) {
    throw new Error('No SVG in response: ' + svg.substring(0, 200));
  }
  
  return svg;
}

async function main() {
  for (const cat of CATEGORIES) {
    console.log('Generando SVG para: ' + cat.name + ' (' + cat.title + ')...');
    try {
      const svg = await generateSVG(cat);
      const filePath = OUT + '\\' + cat.name + '-ad.svg';
      fs.writeFileSync(filePath, svg);
      console.log('  ✅ Guardado: ' + cat.name + '-ad.svg (' + svg.length + ' bytes)');
    } catch (e) {
      console.log('  ❌ Error: ' + e.message);
    }
    // Wait between requests
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('\nListo! Revisa la carpeta: ' + OUT);
}

main().catch(console.error);
