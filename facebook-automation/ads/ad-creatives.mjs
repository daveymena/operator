// Ad creatives for Facebook campaigns — digital courses at 20,000 COP
// Copy + DALL-E prompts for image generation

const categories = [
  {
    name: 'Diseño Gráfico y Multimedia',
    products: ['Cursos Diseño Gráfico', 'Diseño Gráfico', 'Infografías', 'FX Premiere', 'Adobe Photoshop Retrato', 'Diseño de Interfaces Móviles', 'Curso Diseño de Interfaces Moviles', 'Curso Photoshop para Diseño Web', 'Curso Diseño Visual de Marcas', 'Diseño de Logotipos', 'Diseño de Logotipos con Retículas', 'Diseño Editorial Desde Cero', 'Curso Fotomontaje Publicitario', 'Curso Lettering Desde Cero', 'Curso Animación Express Redes Sociales', 'Curso Adobe InDesign Desde Cero', 'Curso Crea y Gestiona Una Marca', 'Portadas Editables', 'Cuadros Editables', 'Pack Canva', 'Pack Filmora'],
    hooks: ['Transforma tu creatividad en ingresos', 'Diseña como profesional desde tu casa', 'El diseño gráfico que sí vende'],
    body: 'Aprende diseño gráfico, edición de video, Photoshop e ilustración digital con cursos completos. Todo el conocimiento que necesitas para trabajar como freelancer o potenciar tu negocio.',
    imagePrompt: 'Modern Latin American graphic designer working on a laptop in a bright home office, flat lay with tablet and color palette, warm natural lighting, professional yet cozy atmosphere, diverse workspace, 4k quality, commercial photography style, clean composition --ar 4:5'
  },
  {
    name: 'Programación y Tecnología',
    products: ['Desarrollo Web', 'Curso de Desarrollo Web', 'Curso de Ecommerce', 'Curso Creación de Videojuegos', 'Curso Master en Animación 3D', 'Curso Cinema 4D', 'Pack Programación', 'Consola en Móvil - Reparación', 'Curso Reparación de Celulares', 'Curso Reparación de Play Station', 'Curso Car Audio', 'Ensamblaje de Computadoras', 'Armado de Computadora', '15 Mil Planos Muebles Carpintería'],
    hooks: ['El código que cambia vidas', 'Tu futuro en tecnología empieza hoy', 'De cero a desarrollador web'],
    body: 'Domina la programación, el desarrollo web, la creación de videojuegos y más. Cursos prácticos desde nivel básico hasta avanzado. Aprende a tu ritmo con acceso de por vida.',
    imagePrompt: 'Colombian young adult coding on dual monitors in a modern home office setup, warm evening lighting, screen showing colorful code, coffee mug nearby, plants in background, cozy Latin American apartment vibe, professional yet relatable, 4k commercial photography --ar 4:5'
  },
  {
    name: 'Marketing y Negocios',
    products: ['Marketing Digital', 'Pack Marketing Digital', 'Pack SEO Marketing Desde Cero', 'Curso Crea Tu Marca', 'Libros Marketing', 'Curso de Ecommerce'],
    hooks: ['Aprende marketing digital y triplica tus ventas', 'El negocio que siempre quisiste, desde cero', 'Marketing digital sin misterios'],
    body: 'Domina el marketing digital, SEO, redes sociales y creación de marca. Estrategias probadas que funcionan en el mercado latinoamericano. Ideal para emprendedores y dueños de negocio.',
    imagePrompt: 'Latin American entrepreneur reviewing analytics on a tablet in a modern office, smartphone showing social media insights, laptop with dashboard, natural daylight, professional environment, warm tones, authentic business setting, 4k commercial photography --ar 4:5'
  },
  {
    name: 'Idiomas y Desarrollo Personal',
    products: ['Inglés', 'Curso Inglés Oxford', 'Pack Idiomas', 'Curso Locución Profesional', 'Psicología Profesional', 'Súper Memoria', 'Preuniversitario', 'Curso Pilates', 'Curso Fuerza Fit', 'Fitness El Camino del Guerrero'],
    hooks: ['Habla inglés y abre puertas al mundo', 'Invierte en ti, es el mejor negocio', 'Domina un nuevo idioma desde casa'],
    body: 'Aprende inglés, técnicas de memorización, locución profesional y desarrollo personal. Métodos efectivos que se adaptan a tu ritmo de vida. Resultados desde la primera semana.',
    imagePrompt: 'Young Colombian student studying English with headphones and smartphone, bilingual notebook visible, cozy bedroom study corner, plants and warm lighting, authentic Latin American home environment, natural learning moment, 4k commercial photography --ar 4:5'
  },
  {
    name: 'Oficina y Productividad',
    products: ['Excel Avanzado', 'Office Completo', 'Instaladores', 'Curso WordPress'],
    hooks: ['Domina Excel como un experto', 'Office profesional: tu carta de presentación', 'La herramienta que todo profesional necesita'],
    body: 'Domina Excel, Word, PowerPoint y herramientas ofimáticas. Cursos prácticos con ejercicios reales. Aumenta tu productividad y destaca en tu trabajo.',
    imagePrompt: 'Colombian professional woman working on Excel spreadsheets in a modern office, dual screen setup, graphs and charts visible, organized desk, natural lighting, professional corporate atmosphere, authentic workplace scene, 4k commercial photography --ar 4:5'
  },
  {
    name: 'Ingeniería y Arquitectura',
    products: ['Arquitectura', 'Ingeniería', 'Curso Revit BIM', 'Metrados y Lectura de Planos', 'Expedientes Técnicos Viviendas', 'Expedientes Obras - Residente', 'Pack Drywall Desde Cero', 'Proyectos'],
    hooks: ['Construye tu futuro profesional', 'Arquitectura e ingeniería al alcance de todos', 'De los planos a la obra, paso a paso'],
    body: 'Cursos profesionales de Revit BIM, AutoCAD, metrados, lectura de planos y expedientes técnicos. Aprende con metodología práctica aplicada al mercado colombiano.',
    imagePrompt: 'Latin American architect reviewing blueprints on a large wooden table, hard hat nearby, tablet showing 3D building model, natural light from large window, modern construction site background, professional engineering atmosphere, 4k commercial photography --ar 4:5'
  },
  {
    name: 'Hacking Ético y Ciberseguridad',
    products: ['Curso Hacking Ético'],
    hooks: ['Conviértete en un hacker ético', 'La ciberseguridad es el futuro', 'Protege lo que más importa'],
    body: 'Aprende hacking ético, ciberseguridad y protección de datos. Curso completo desde cero con laboratorios prácticos. Una de las carreras mejor pagadas del momento.',
    imagePrompt: 'Latin American cybersecurity professional in a dimly lit room, multiple monitors showing code and network diagrams, blue ambient lighting, modern tech setup, hoodie and headphones, professional ethical hacker aesthetic, 4k commercial photography --ar 4:5'
  },
  {
    name: 'MegaPack Completo',
    products: ['MegaPack Completo'],
    hooks: ['Los 81 cursos en UN solo pack', 'Tu carrera profesional completa', 'Todo el conocimiento que necesitas'],
    body: 'Accede a los 81 cursos digitales completos por un solo pago. Diseño, programación, marketing, idiomas, ingeniería y más. Actualizaciones perpetuas y soporte prioritario. La inversión más inteligente de tu vida.',
    imagePrompt: 'Collage-style image showing multiple course thumbnails arranged in a grid, diverse Latin American students learning different skills (coding, design, language, engineering), unified by a warm golden gradient overlay, professional online education platform aesthetic, 4k commercial photography --ar 4:5'
  },
  {
    name: 'MegaPack Piano',
    products: ['MegaPack Completo de Piano'],
    hooks: ['Toca el piano como un profesional', 'La música transforma vidas', 'Tu primer concierto te espera'],
    body: 'Curso completo de piano online. Más de 50 lecciones en video, partituras descargables y soporte personalizado. Aprende desde cero o perfecciona tu técnica.',
    imagePrompt: 'Close-up of hands playing a grand piano in a warm, elegant room, natural light from window, sheet music visible, cozy Latin American home atmosphere, professional musician aesthetic, emotional and artistic, 4k commercial photography --ar 4:5'
  }
];

// Quick ad templates
function generateAd(product) {
  const cat = categories.find(c => c.products.includes(product.name)) || categories[0];
  const hook = cat.hooks[Math.floor(Math.random() * cat.hooks.length)];
  const price = product.price.toLocaleString('es-CO');
  
  return {
    category: cat.name,
    primaryText: `${hook} 🚀\n\n${cat.body}\n\n✅ Curso completo\n✅ Acceso de por vida\n✅ Soporte personalizado\n✅ Actualizaciones gratis\n\n💰 Solo $${price} COP\n\n🎁 ¡Empieza hoy y transforma tu futuro!`,
    headline: `${product.name} — Solo $${price} COP`,
    description: 'Acceso de por vida • Soporte personalizado • Actualizaciones gratis',
    cta: 'Comprar ahora',
    imagePrompt: cat.imagePrompt,
    imageDescription: `Ad image for ${product.name}: ${cat.imagePrompt.substring(0, 60)}...`
  };
}

function generateAllAds(catalog) {
  return catalog.map(p => generateAd(p));
}

export { categories, generateAd, generateAllAds };
