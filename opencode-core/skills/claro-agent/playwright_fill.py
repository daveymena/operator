import json, os, sys, time
from playwright.sync_api import sync_playwright

ORDENES = os.path.join(os.path.dirname(__file__), "ordenes_procesadas.json")
FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfd9f3bIBYdrMps4YlASFWr2Zsg81eiIsXF8wtq2bZ_xaSsYA/viewform"

ENTRY = {
    "email": "1474006871",
    "ciudad": "1471424487",
    "cuenta": "1870755430",
    "nodo": "32249358",
    "ot": "1081592980",
    "tipo": "1623086197",
    "cedulaTec": "161010304",
    "nombreTec": "2050465209",
    "cedulaAux": "1868234486",
    "nombreAux": "156600285",
}

TECNICO = {
    "cedula": "1077449318",
    "nombre": "Davey Mena Mosquera",
    "aux_cedula": "0",
    "aux_nombre": "x",
    "telefono": "3136174267",
    "correo": "daveymena16@gmail.com",
}

def load_orders():
    with open(ORDENES, encoding="utf-8") as f:
        return json.load(f)

def save_orders(orders):
    with open(ORDENES, "w", encoding="utf-8") as f:
        json.dump(orders, f, ensure_ascii=False, indent=2)

def fill_form(page, order):
    page.goto(FORM_URL, wait_until="domcontentloaded")
    time.sleep(3)
    page.screenshot(path=os.path.join(os.path.dirname(__file__), "form_screenshot.png"))
    print(f"  URL actual: {page.url}")
    print(f"  Titulo: {page.title()}")

    page.wait_for_selector('div[role="listitem"], form, input, [aria-label]', timeout=20000)

    fields = [
        (ENTRY["email"], TECNICO["correo"]),
        (ENTRY["ciudad"], order.get("ciudad", "Cali")),
        (ENTRY["cuenta"], order.get("cuenta", "")),
        (ENTRY["nodo"], order.get("nodo", "")),
        (ENTRY["ot"], order["ot"]),
        (ENTRY["tipo"], order.get("tipo", "MANTENIMIENTO FTTH")),
        (ENTRY["cedulaTec"], TECNICO["cedula"]),
        (ENTRY["nombreTec"], TECNICO["nombre"]),
        (ENTRY["cedulaAux"], TECNICO["aux_cedula"]),
        (ENTRY["nombreAux"], TECNICO["aux_nombre"]),
    ]

    for eid, value in fields:
        sel = f'input[name="entry.{eid}"], textarea[name="entry.{eid}"], div[data-answer-value] input[type="text"]'
        el = page.query_selector(f'input[name="entry.{eid}"], textarea[name="entry.{eid}"]')
        if el:
            el.scroll_into_view_if_needed()
            page.wait_for_timeout(300)
            el.fill(value)
            print(f"  OK entry.{eid} = {value}")
        else:
            print(f"  NO entry.{eid} - probando selector alternativo...")
            page.wait_for_timeout(500)
            page.evaluate(f'document.querySelector("input[name*=\'{eid}\']")?.value = "{value}"')

    page.wait_for_timeout(1000)

    btn = page.query_selector('div[role="button"][aria-label*="nviar"], button[type="submit"], span[role="button"][aria-label*="nviar"]')
    if btn:
        btn.click()
        print("  FORMULARIO ENVIADO")
        page.wait_for_timeout(2000)
        return True

    print("  No se encontro boton enviar")
    return False

def main():
    orders = load_orders()
    pending = [o for o in orders if o.get("status", "pending") == "pending"]
    if not pending:
        print("0 ordenes pendientes")
        return

    print(f"{len(pending)} orden(es) pendiente(s)")
    test = "--test" in sys.argv
    if test:
        pending = pending[:1]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"])
        context = browser.new_context(viewport={"width": 1280, "height": 900}, locale="es-CO")

        for order in pending:
            print(f"\nOT {order['ot']}...")
            page = context.new_page()
            try:
                ok = fill_form(page, order)
                if ok:
                    order["status"] = "completed"
                    save_orders(orders)
            except Exception as e:
                print(f"  ERROR: {e}")
            finally:
                page.close()

        context.close()
        input("Presiona Enter para cerrar el navegador...")
        browser.close()

if __name__ == "__main__":
    main()