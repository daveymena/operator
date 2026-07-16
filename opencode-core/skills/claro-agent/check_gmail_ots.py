"""
Search Gmail for any emails indicating already-submitted orders.
Check for: Claro emails, form submission confirmations, OT numbers.
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

mail = imaplib.IMAP4_SSL(IMAP_SERVER)
mail.login(EMAIL, PASSWORD)
print("Conectado!")
mail.select("INBOX")

# Load pending OTs from ordenes_procesadas.json
ots_path = os.path.join(os.path.dirname(__file__), "ordenes_procesadas.json")
with open(ots_path, encoding="utf-8") as f:
    data = json.load(f)
pending = [o for o in data if not o.get("enviado")]

print(f"OTs pendientes: {len(pending)}")
for o in pending:
    print(f"  OT {o.get('ot', '?')}")

# Search for ANY email mentioning these OT numbers
found_ots = set()
for ot_entry in pending:
    ot = str(ot_entry.get("ot", ""))
    if not ot: continue
    
    # Search for this OT number in subject/body
    status, messages = mail.search(None, f'TEXT "{ot}"')
    if status == "OK" and messages[0]:
        ids = messages[0].split()
        print(f"\nOT {ot}: {len(ids)} emails encontrados")
        found_ots.add(ot)
        
        # Show last 3 emails
        for msg_id in ids[-3:]:
            status, data = mail.fetch(msg_id, "(RFC822)")
            if status != "OK": continue
            msg = email.message_from_bytes(data[0][1])
            subject = decode_str(msg["Subject"])
            from_addr = decode_str(msg.get("From", ""))
            date = decode_str(msg["Date"])
            print(f"  [{date[:10]}] {from_addr[:40]} | {subject[:80]}")

mail.logout()

print(f"\nOTs con emails: {len(found_ots)}")
print(f"OTs sin emails: {len(pending) - len(found_ots)}")
