// Generates complete campaign package: images prompts + copy + structure
import fs from 'fs';
import { categories, generateAd } from './ad-creatives.mjs';

const catalog = JSON.parse(fs.readFileSync(
  'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\tokens\\megapack-82-productos.json', 'utf8'
));

const packageDir = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\ads\\campaign-package';
if (!fs.existsSync(packageDir)) fs.mkdirSync(packageDir, { recursive: true });

// Generate individual ads for each product
const ads = catalog.map(p => generateAd(p));

// Group by category
const byCategory = {};
ads.forEach(ad => {
  if (!byCategory[ad.category]) byCategory[ad.category] = [];
  byCategory[ad.category].push(ad);
});

// Write complete package
const packageData = {
  generatedAt: new Date().toISOString(),
  totalProducts: catalog.length,
  categories: Object.keys(byCategory),
  summary: {
    individual: { count: catalog.filter(p => p.price === 20000).length, price: '20,000 COP' },
    bundle: { name: 'MegaPack Completo', price: '60,000 COP' },
    piano: { name: 'MegaPack Completo de Piano', price: '60,000 COP' }
  },
  ads: ads.map(ad => ({
    category: ad.category,
    primaryText: ad.primaryText,
    headline: ad.headline,
    description: ad.description,
    cta: ad.cta,
    imagePrompt: ad.imagePrompt
  }))
};

// Save package JSON
fs.writeFileSync(`${packageDir}/campaign-package.json`, JSON.stringify(packageData, null, 2));

// Save prompts for DALL-E
let promptsMd = '# 🎨 DALL-E Prompts para Imágenes de Anuncios\n\n';
promptsMd += '## Especificaciones técnicas\n';
promptsMd += '- **Formato**: 1080×1350 (4:5) para Facebook Feed\n';
promptsMd += '- **Estilo**: Fotografía comercial auténtica, no stock photography\n';
promptsMd += '- **Colores**: Cálidos, latinoamericanos, profesionales\n';
promptsMd += '- **Texto**: Máximo 20% de la imagen (política de Facebook)\n\n';
promptsMd += '---\n\n';

categories.forEach(cat => {
  promptsMd += `## 📁 ${cat.name}\n\n`;
  promptsMd += `**Productos**: ${cat.products.join(', ')}\n\n`;
  promptsMd += `### Prompt para DALL-E:\n\n`;
  promptsMd += `\`\`\`\n${cat.imagePrompt}\n\`\`\`\n\n`;
  promptsMd += '---\n\n';
});

fs.writeFileSync(`${packageDir}/dalle-prompts.md`, promptsMd);

// Save copy templates
let copyMd = '# 📝 Copy para Anuncios de Facebook\n\n';
copyMd += '## Estructura que funciona\n\n';
copyMd += '1. **Hook** (primeras 2 líneas) — Detiene el scroll\n';
copyMd += '2. **Body** (3-4 líneas) — Explica el beneficio\n';
copyMd += '3. **Features** (viñetas) — Puntos de venta\n';
copyMd += '4. **Precio** — Llamativo y claro\n';
copyMd += '5. **CTA** — Acción específica\n\n';
copyMd += '---\n\n';

Object.entries(byCategory).forEach(([catName, ads]) => {
  copyMd += `## ${catName}\n\n`;
  copyMd += `**Ejemplo de anuncio:**\n\n`;
  copyMd += `### Texto principal:\n${ads[0].primaryText}\n\n`;
  copyMd += `### Headline:\n${ads[0].headline}\n\n`;
  copyMd += `### Description:\n${ads[0].description}\n\n`;
  copyMd += `### CTA:\n${ads[0].cta}\n\n`;
  copyMd += '---\n\n';
});

fs.writeFileSync(`${packageDir}/copy-templates.md`, copyMd);

console.log('✅ Campaign package generated!');
console.log(`📁 ${packageDir}`);
console.log(`   - campaign-package.json  (full data)`);
console.log(`   - dalle-prompts.md       (image prompts)`);
console.log(`   - copy-templates.md      (ad copy templates)`);
console.log(`\n📊 Stats:`);
console.log(`   ${ads.length} ads generated`);
console.log(`   ${Object.keys(byCategory).length} categories`);
console.log(`   ${catalog.filter(p => p.price === 20000).length} products at 20,000 COP`);
console.log(`   ${catalog.filter(p => p.price === 60000).length} products at 60,000 COP`);
