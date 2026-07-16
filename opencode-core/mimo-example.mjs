// ============================================================
// MiMoCode Control Example
// Ejemplo de cómo MiMoCode controla la PC a través del puente
// ============================================================

import { MimoConnector } from './mimo-connector.mjs';

async function main() {
  const pc = new MimoConnector();

  try {
    // 1. Connect to bridge
    await pc.connect();
    console.log('✓ Conectado a la PC');

    // 2. Get system info
    const info = await pc.sysinfo();
    console.log(`✓ PC: ${info.hostname} (${info.platform})`);
    console.log(`  RAM: ${info.memory}`);
    console.log(`  IP: ${info.ip}`);

    // 3. Take screenshot to see current state
    console.log('\n📸 Tomando screenshot...');
    const shot = await pc.screenshot();
    console.log(`✓ Screenshot guardado: ${shot.filePath}`);

    // 4. Open Chrome
    console.log('\n🌐 Abriendo Chrome...');
    await pc.openChrome('https://www.google.com');
    await sleep(3000);

    // 5. Take another screenshot to verify
    const shot2 = await pc.screenshot();
    console.log(`✓ Screenshot después de abrir Chrome: ${shot2.filePath}`);

    // 6. Type something in Google
    console.log('\n⌨️ Escribiendo en Google...');
    await pc.type('MiMoCode is controlling this PC');
    await sleep(500);
    await pc.pressEnter();
    await sleep(2000);

    // 7. Final screenshot
    const shot3 = await pc.screenshot();
    console.log(`✓ Screenshot final: ${shot3.filePath}`);

    // 8. Open Notepad and write something
    console.log('\n📝 Abriendo Notepad...');
    await pc.openNotepad();
    await sleep(2000);
    await pc.type('Hello from MiMoCode! I am controlling your PC.');
    await sleep(500);
    await pc.ctrlS();

    console.log('\n✅ Ejemplo completado. MiMoCode puede controlar tu PC.');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    pc.disconnect();
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

main();
