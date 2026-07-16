"""
verify_sent.py — Verifica Gmail por confirmaciones de envio
y marca ordenes como enviadas en el JSON.
Corre despues de fill_orders_final.js como red de seguridad.
Busca en los ultimos receipts de formularios.
"""
import imaplib, email, json, re, os, sys

sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)

script_dir = os.path.dirname(os.path.abspath(__file__))

# Read credentials directly from check_gmail_cuentas.py without importing it
creds_path = os.path.join(script_dir, "check_gmail_cuentas.py")
with open(creds_path, "rb") as f:
    content = f.read()

EMAIL_VAR = re.search(rb'EMAIL\s*=\s*"([^"]+)"', content).group(1).decode()
PASS_VAR = re.search(rb'PASSWORD\s*=\s*"([^"]+)"', content).group(1).decode()
IMAP_VAR = re.search(rb'IMAP_SERVER\s*=\s*"([^"]+)"', content).group(1).decode()

print("[VERIFY] Verificando Gmail por confirmaciones de envio...")

mail = imaplib.IMAP4_SSL(IMAP_VAR)
try:
    mail.login(EMAIL_VAR, PASS_VAR)
except Exception as ex:
    print(f"  ❌ Error de conexion IMAP: {ex}")
    sys.exit(1)

mail.select("INBOX")
status, messages = mail.search(None, '(FROM "forms-receipts")')
if status != "OK" or not messages[0]:
    print("  No se encontraron receipts")
    mail.logout()
    sys.exit(0)

ids = messages[0].split()
print(f"  Total receipts en Gmail: {len(ids)}")

ots_path = os.path.join(script_dir, "ordenes_procesadas.json")
with open(ots_path, encoding="utf-8") as f:
    orders = json.load(f)

pending = [o for o in orders if not o.get("enviado")]
if not pending:
    print("  No hay ordenes pendientes por verificar")
    mail.logout()
    sys.exit(0)

print(f"  Ordenes pendientes: {len(pending)}")

pending_cuentas = {str(o.get("cuenta", "")).strip() for o in pending if o.get("cuenta")}
print(f"  Cuentas a buscar: {len(pending_cuentas)}")

# Revisar solo los ultimos 50 receipts (suficiente para envios nuevos)
recent = ids[-50:]
confirmed_cuentas = set()

for msg_id in recent:
    s, d = mail.fetch(msg_id, "(RFC822)")
    if s != "OK": continue
    msg = email.message_from_bytes(d[0][1])
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            try:
                payload = part.get_payload(decode=True)
                if payload:
                    body += payload.decode("utf-8", errors="replace")
            except:
                pass
    else:
        try:
            body = msg.get_payload(decode=True).decode("utf-8", errors="replace")
        except:
            pass
    for cuenta in pending_cuentas:
        if cuenta in body:
            confirmed_cuentas.add(cuenta)
            break

mail.logout()

# Marcar como enviadas
updated = 0
for o in orders:
    cuenta = str(o.get("cuenta", "")).strip()
    if cuenta in confirmed_cuentas and not o.get("enviado"):
        o["enviado"] = True
        updated += 1
        print(f"  ✅ OT {o.get('ot','?')} - Cuenta {cuenta} - {o.get('nombre','')[:30]} (CONFIRMADO por Gmail)")

if updated:
    with open(ots_path, "w", encoding="utf-8") as f:
        json.dump(orders, f, ensure_ascii=False, indent=2)
    print(f"\n✅ {updated} orden(es) marcadas como enviadas por verificacion Gmail")
else:
    print("  Sin nuevas confirmaciones en Gmail")
