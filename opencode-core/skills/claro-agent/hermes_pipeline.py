"""
hermes_pipeline.py
==================
Pipeline completo de automatizacion para Hermes Agent.
Procesa ordenes de Claro desde texto crudo hasta el llenado del formulario.

Hermes ejecuta esto via su tool 'terminal':
  python hermes_pipeline.py --orden "texto de la orden"
  python hermes_pipeline.py --status
  python hermes_pipeline.py --run-pending
  python hermes_pipeline.py --solve-captcha <audio_file>
"""

import sys
import os
import json
import subprocess
import re
from datetime import datetime

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
ORDENES_FILE = os.path.join(PROJECT_DIR, "ordenes_procesadas.json")
REPORTE_FILE = os.path.join(PROJECT_DIR, "reporte_diario.txt")
SOLVE_CAPTCHA = os.path.join(PROJECT_DIR, "solve_audio_captcha.py")
import platform as _p; NODE_PATH = "/usr/bin/node" if _p.system() != "Windows" else "node"
FILL_SCRIPT = os.path.join(PROJECT_DIR, "fill_orders_final.js")

DATOS_FIJOS = {
    "cedula_tecnico": "1077449318",
    "nombre_tecnico": "Davey Mena Mosquera",
    "cedula_auxiliar": "0",
    "nombre_auxiliar": "x",
    "telefono": "3136174267",
    "correo": "daveymena16@gmail.com"
}


def load_orders():
    if os.path.exists(ORDENES_FILE):
        with open(ORDENES_FILE, encoding="utf-8") as f:
            return json.load(f)
    return []


def save_orders(orders):
    with open(ORDENES_FILE, "w", encoding="utf-8") as f:
        json.dump(orders, f, ensure_ascii=False, indent=2)


def extract_order_from_text(text):
    """Extrae datos de orden desde texto crudo usando NLP basico."""
    order = {
        "cuenta": "",
        "ot": "",
        "ciudad": "",
        "nodo": "",
        "tipo": "MANTENIMIENTO FTTH",
        "serial_ont": "",
        "serial_deco": "",
        "aplicaMaterial": "No",
        "status": "pending",
        "direccion": "",
        "nombre": "",
        "notes": text.strip()
    }

    text_lower = text.lower()

    ot_match = re.search(r'(?:OT|ORDEN|N[°º]?)\s*:?\s*(\d{5,})', text, re.IGNORECASE)
    if ot_match:
        order["ot"] = ot_match.group(1)

    ciudad_match = re.search(r'CIUDAD\s*:?\s*([A-ZÁÉÍÓÚÑ\s]+)', text, re.IGNORECASE)
    if ciudad_match:
        order["ciudad"] = ciudad_match.group(1).strip().capitalize()

    nodo_match = re.search(r'NODO\s*:?\s*(\w+)', text, re.IGNORECASE)
    if nodo_match:
        order["nodo"] = nodo_match.group(1)

    cuenta_match = re.search(r'CUENTA\s*:?\s*(\d+)', text, re.IGNORECASE)
    if cuenta_match:
        order["cuenta"] = cuenta_match.group(1)

    if "postventa" in text_lower:
        order["tipo"] = "POSTVENTA FTTH"
    elif "instalacion" in text_lower or "instalación" in text_lower:
        order["tipo"] = "INSTALACION FTTH"

    serial_ont_match = re.search(r'SERIAL\s*(?:ONT)?\s*:?\s*([A-Z0-9.:]{10,})', text, re.IGNORECASE)
    if serial_ont_match:
        order["serial_ont"] = serial_ont_match.group(1)

    serial_deco_match = re.search(r'SERIAL\s*DECO\s*:?\s*([A-Z0-9.:]{10,})', text, re.IGNORECASE)
    if serial_deco_match:
        order["serial_deco"] = serial_deco_match.group(1)

    if any(w in text_lower for w in ["conector", "cable", "material", "fibra", "ont", "deco"]):
        order["aplicaMaterial"] = "Si"

    return order


def extract_orders_from_text(text):
    """Extrae multiples ordenes desde texto, separadas por lineas de OT."""
    lines = text.strip().split("\n")
    orders = []
    current_text = ""

    for line in lines:
        if re.match(r'OT\s*\d', line, re.IGNORECASE):
            if current_text.strip():
                orders.append(extract_order_from_text(current_text))
            current_text = line + "\n"
        else:
            current_text += line + "\n"

    if current_text.strip():
        orders.append(extract_order_from_text(current_text))

    return orders if orders else [extract_order_from_text(text)]


def append_orders(new_orders_text):
    """Agrega nuevas ordenes desde texto al JSON."""
    new_orders = extract_orders_from_text(new_orders_text)
    existing = load_orders()

    existing_ots = {o["ot"] for o in existing if o.get("ot")}
    added = 0
    for order in new_orders:
        if order["ot"] and order["ot"] not in existing_ots:
            for k, v in DATOS_FIJOS.items():
                if k not in order or not order.get(k):
                    order[k] = v
            existing.append(order)
            existing_ots.add(order["ot"])
            added += 1
        elif not order["ot"]:
            order["ot"] = f"MANUAL_{datetime.now().strftime('%H%M%S')}"
            for k, v in DATOS_FIJOS.items():
                if k not in order or not order.get(k):
                    order[k] = v
            existing.append(order)
            added += 1

    save_orders(existing)
    return added, len(new_orders)


def run_filler(test_mode=False):
    """Ejecuta el script de llenado de formularios."""
    cmd = [NODE_PATH, FILL_SCRIPT]
    if test_mode:
        cmd.append("--test")

    print(f"Ejecutando: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=PROJECT_DIR)
    print(result.stdout)

    if result.returncode != 0:
        print(f"ERROR ({result.returncode}): {result.stderr[:500]}")
        return False

    return True


def show_status():
    """Muestra el estado actual de las ordenes."""
    orders = load_orders()
    # Una orden esta completada si status=completed O enviado=true
    completed = [o for o in orders if o.get("status") == "completed" or o.get("enviado")]
    pending = [o for o in orders if o.get("status", "pending") == "pending" and not o.get("enviado")]


    print(f"\n{'='*50}")
    print(f"ORDENES CLARO - {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print(f"{'='*50}")
    print(f"Total: {len(orders)} | Pendientes: {len(pending)} | Completadas: {len(completed)}")
    print()

    if pending:
        print("PENDIENTES:")
        for o in pending:
            print(f"  OT {o['ot']} | {o.get('ciudad','?')} | {o.get('tipo','?')} | Mat:{o.get('aplicaMaterial','?')}")
        print()

    if os.path.exists(REPORTE_FILE):
        with open(REPORTE_FILE, encoding="utf-8") as f:
            content = f.read().strip()
        if content:
            print(f"ULTIMO REPORTE:")
            for line in content.split("\n")[-5:]:
                print(f"  {line}")

    return len(pending)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print("\nComandos:")
        print("  --orden <texto>       Procesar una o mas ordenes desde texto")
        print("  --orden-file <archivo> Procesar ordenes desde un archivo .txt")
        print("  --run-pending         Ejecutar fill_orders_final.js")
        print("  --test                Ejecutar en modo test (1 orden)")
        print("  --status              Ver estado de las ordenes")
        print("  --solve-captcha <audio>  Transcribir audio captcha")
        print("  --stats               Ver estadisticas")
        sys.exit(0)

    if "--status" in sys.argv:
        show_status()
        sys.exit(0)

    if "--stats" in sys.argv:
        orders = load_orders()
        types = {}
        cities = {}
        for o in orders:
            t = o.get("tipo", "?")
            types[t] = types.get(t, 0) + 1
            c = o.get("ciudad", "?")
            cities[c] = cities.get(c, 0) + 1
        print(f"\nTipos de trabajo:")
        for t, n in sorted(types.items(), key=lambda x: -x[1]):
            print(f"  {t}: {n}")
        print(f"\nCiudades:")
        for c, n in sorted(cities.items(), key=lambda x: -x[1]):
            print(f"  {c}: {n}")
        sys.exit(0)

    if "--solve-captcha" in sys.argv:
        idx = sys.argv.index("--solve-captcha")
        if idx + 1 < len(sys.argv):
            audio_file = sys.argv[idx + 1]
            method = "auto"
            if "--method" in sys.argv:
                midx = sys.argv.index("--method")
                if midx + 1 < len(sys.argv):
                    method = sys.argv[midx + 1]
            cmd = [sys.executable, SOLVE_CAPTCHA, audio_file, "--method", method]
            subprocess.run(cmd, cwd=PROJECT_DIR)
            sys.exit(0)

    if "--orden" in sys.argv:
        idx = sys.argv.index("--orden")
        text = " ".join(sys.argv[idx + 1:])
        added, total = append_orders(text)
        print(f"\nProcesadas {total} orden(es) del texto. Agregadas: {added} nueva(s).")
        pending = show_status()
        if pending > 0:
            print("\nEjecuta: python hermes_pipeline.py --run-pending")
        sys.exit(0)

    if "--orden-file" in sys.argv:
        idx = sys.argv.index("--orden-file")
        filepath = sys.argv[idx + 1]
        if os.path.exists(filepath):
            with open(filepath, encoding="utf-8") as f:
                text = f.read()
            added, total = append_orders(text)
            print(f"\nProcesadas {total} orden(es) del archivo. Agregadas: {added} nueva(s).")
        else:
            print(f"ERROR: archivo no encontrado: {filepath}")
        sys.exit(0)

    if "--run-pending" in sys.argv:
        pending = show_status()
        if pending > 0:
            test_mode = "--test" in sys.argv
            print(f"\nEjecutando filler para {pending} orden(es)...\n")
            run_filler(test_mode)
            
            # Post-run: verificar Gmail para CONFIRMAR envios (red de seguridad)
            print("\n[VERIFY] Verificando Gmail para confirmar envios...")
            verify_script = os.path.join(PROJECT_DIR, "verify_sent.py")
            subprocess.run([sys.executable, verify_script], cwd=PROJECT_DIR, timeout=90)
            
            print("\n" + "=" * 50)
            show_status()
        else:
            print("No hay ordenes pendientes.")
        sys.exit(0)


if __name__ == "__main__":
    main()
