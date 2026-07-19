// Generates DALL-E prompts for each product category
// Copy these prompts into ChatGPT (with DALL-E) to generate ad images

import { categories } from './ad-creatives.mjs';

console.log('🎨 DALL-E IMAGE PROMPTS — Curso Digitales Colombia');
console.log('='.repeat(60));
console.log('Copia cada prompt en ChatGPT con DALL-E para generar la imagen.\n');

categories.forEach(cat => {
  console.log(`📁 ${cat.name}`);
  console.log(`   Productos: ${cat.products.slice(0, 3).join(', ')}${cat.products.length > 3 ? '...' : ''}`);
  console.log(`\n   🖼️  Prompt:`);
  console.log(`   ${cat.imagePrompt}`);
  console.log('\n' + '-'.repeat(60) + '\n');
});

console.log('\n✅ RECOMENDACIONES:');
console.log('1. Usa 1080×1350 (4:5) para Facebook Feed');
console.log('2. Añade texto superpuesto en Canva después de generar');
console.log('3. Mantén el texto en la imagen < 20% para evitar rechazos');
console.log('4. Usa imágenes auténticas, no stock photography');
console.log('5. Incluye el precio (20.000 COP / 60.000 COP) en el diseño');
