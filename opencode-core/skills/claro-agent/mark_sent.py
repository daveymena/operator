"""
Mark orders as sent based on Gmail confirmation emails.
"""
import json, os

ots_path = os.path.join(os.path.dirname(__file__), "ordenes_procesadas.json")
with open(ots_path, encoding="utf-8") as f:
    orders = json.load(f)

# Cuentas found in form receipts (already submitted)
sent_cuentas = {"21849525", "27463271", "88421238", "35539275", "88019419", "12651895", "66906470"}

updated = 0
for o in orders:
    cuenta = str(o.get("cuenta", "")).strip()
    if cuenta in sent_cuentas and not o.get("enviado"):
        o["enviado"] = True
        updated += 1
        print(f"  Marcada: OT {o.get('ot', '?')} - Cuenta {cuenta} - {o.get('nombre', '')[:30]}")

if updated:
    with open(ots_path, "w", encoding="utf-8") as f:
        json.dump(orders, f, ensure_ascii=False, indent=2)
    print(f"\nActualizadas {updated} ordenes como enviadas")
else:
    print("No se requirieron cambios")

pending = sum(1 for o in orders if not o.get("enviado"))
print(f"Pendientes ahora: {pending}")
