const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ORDENES_FILE = path.join(__dirname, "ordenes_procesadas.json");
const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfd9f3bIBYdrMps4YlASFWr2Zsg81eiIsXF8wtq2bZ_xaSsYA/viewform";

const DATOS_FIJOS = {
  cedula_tecnico: "1077449318",
  nombre_tecnico: "Davey Mena Mosquera",
  cedula_auxiliar: "0",
  nombre_auxiliar: "x",
  telefono: "3136174267",
  correo: "daveymena16@gmail.com"
};

const ENTRY_IDS = {
  email: "1474006871",
  ciudad: "1471424487",
  cuenta: "1870755430",
  nodo: "32249358",
  ot: "1081592980",
  tipo: "1623086197",
  cedulaTec: "161010304",
  nombreTec: "2050465209",
  cedulaAux: "1868234486",
  nombreAux: "156600285"
};

function loadOrders() {
  if (fs.existsSync(ORDENES_FILE)) {
    return JSON.parse(fs.readFileSync(ORDENES_FILE, "utf8"));
  }
  return [];
}

function saveOrders(orders) {
  fs.writeFileSync(ORDENES_FILE, JSON.stringify(orders, null, 2), "utf8");
}

async function fillForm(page, order) {
  await page.goto(FORM_URL, { waitUntil: "networkidle" });

  const fields = [
    { id: ENTRY_IDS.email, value: DATOS_FIJOS.correo },
    { id: ENTRY_IDS.ciudad, value: order.ciudad || "Cali" },
    { id: ENTRY_IDS.cuenta, value: order.cuenta || "" },
    { id: ENTRY_IDS.nodo, value: order.nodo || "" },
    { id: ENTRY_IDS.ot, value: order.ot },
    { id: ENTRY_IDS.tipo, value: order.tipo || "MANTENIMIENTO FTTH" },
    { id: ENTRY_IDS.cedulaTec, value: DATOS_FIJOS.cedula_tecnico },
    { id: ENTRY_IDS.nombreTec, value: DATOS_FIJOS.nombre_tecnico },
    { id: ENTRY_IDS.cedulaAux, value: DATOS_FIJOS.cedula_auxiliar },
    { id: ENTRY_IDS.nombreAux, value: DATOS_FIJOS.nombre_auxiliar },
  ];

  for (const field of fields) {
    const selector = `input[name="entry.${field.id}"], textarea[name="entry.${field.id}"]`;
    const el = await page.$(selector);
    if (el) {
      await el.click();
      await el.fill(field.value);
      console.log(`  ✓ ${field.id}=${field.value}`);
    } else {
      console.log(`  ✗ Campo no encontrado: entry.${field.id}`);
    }
  }

  await page.waitForTimeout(1000);

  const submitBtn = await page.$('div[role="button"][aria-label^="Enviar"], span[role="button"][aria-label^="Enviar"], button[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
    console.log("  ✓ Formulario enviado");
    await page.waitForTimeout(2000);
    return true;
  } else {
    console.log("  ✗ Boton de enviar no encontrado");
    return false;
  }
}

async function main() {
  let browser;
  try {
    browser = await chromium.launch({
      headless: false,
      args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: "es-CO",
    });

    const orders = loadOrders();
    const pending = orders.filter(o => o.status === "pending");

    console.log(`${pending.length} ordenes pendientes\n`);

    for (const order of pending) {
      console.log(`Procesando OT ${order.ot}...`);
      const page = await context.newPage();
      try {
        const ok = await fillForm(page, order);
        if (ok) {
          order.status = "completed";
          saveOrders(orders);
          console.log(`  OT ${order.ot} completada\n`);
        }
      } catch (err) {
        console.error(`  Error en OT ${order.ot}: ${err.message}`);
      } finally {
        await page.close();
      }
    }

    console.log("Proceso terminado.");
  } catch (err) {
    console.error("FATAL:", err.message);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

main();