"""
Check Google Forms confirmation emails to find which account numbers
(cuentas) have already been submitted.
"""
import imaplib
import email
from email.header import decode_header
import json
import re
import os, sys

EMAIL = "daveymena16@gmail.com"
PASSWORD = "cwfx xjwe syaj wcku"
IMAP_SERVER = "imap.gmail.com"

sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)

def decode_str(s):
    if not s: return ""
    parts = decode_header(s)
    result = []
    for part, charset in parts:
        if isinstance(part, bytes):
            result.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            result.append(str(part))
    return "".join(result)

# Load pending orders
ots_path = os.path.join(os.path.dirname(__file__), "ordenes_procesadas.json")
with open(ots_path, encoding="utf-8") as f:
    orders = json.load(f)

# Build lookup by cuenta
cuenta_to_order = {}
for o in orders:
    c = str(o.get("cuenta", "")).strip()
    if c:
        cuenta_to_order[c] = o

print(f"Total orders: {len(orders)}")
print(f"Pending: {sum(1 for o in orders if not o.get('enviado'))}")
print(f"Unique cuentas: {len(cuenta_to_order)}")
print(f"Cuentas a buscar: {list(cuenta_to_order.keys())[:10]}...")

mail = imaplib.IMAP4_SSL(IMAP_SERVER)
mail.login(EMAIL, PASSWORD)
print("Conectado!")
mail.select("INBOX")

# Search for forms receipts
status, messages = mail.search(None, '(FROM "forms-receipts")')
if status != "OK" or not messages[0]:
    print("No se encontraron emails")
    mail.logout()
    exit()

ids = messages[0].split()
print(f"Total form receipts: {len(ids)}")

# Get the last 100 receipts (most recent submissions)
recent = ids[-100:]
found_cuentas = set()

for msg_id in recent:
    status, data = mail.fetch(msg_id, "(RFC822)")
    if status != "OK": continue
    msg = email.message_from_bytes(data[0][1])
    
    subject = decode_str(msg["Subject"])
    date = decode_str(msg["Date"])
    
    # Get body text
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                body = part.get_payload(decode=True).decode("utf-8", errors="replace")
                break
            elif part.get_content_type() == "text/html":
                body = part.get_payload(decode=True).decode("utf-8", errors="replace")
    else:
        body = msg.get_payload(decode=True).decode("utf-8", errors="replace")
    
    # Search for any of our cuentas in the body + subject
    for cuenta in cuenta_to_order:
        if cuenta in body or cuenta in subject:
            found_cuentas.add(cuenta)
            print(f"  [{date[:10]}] Cuenta {cuenta} ENVIADA! (OT {cuenta_to_order[cuenta].get('ot', '?')})")

mail.logout()

print(f"\nCuentas encontradas en confirmaciones: {len(found_cuentas)}")
for c in sorted(found_cuentas):
    o = cuenta_to_order[c]
    print(f"  Cuenta {c} -> OT {o.get('ot', '?')} - {o.get('nombre', '')[:30]}")

# Also show which pending ones are NOT found
print(f"\n--- PENDIENTES (no encontrados en email) ---")
for o in orders:
    if not o.get("enviado") and str(o.get("cuenta", "")) not in found_cuentas:
        print(f"  OT {o.get('ot', '?')} - Cuenta {o.get('cuenta', '?')} - {o.get('nombre', '')[:30]}")
