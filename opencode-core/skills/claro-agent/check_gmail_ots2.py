"""
Search Gmail for any form submission confirmations (from Google or Claro).
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

# Search for Google Forms/Claro/Ot confirmation emails
searches = [
    '(OR FROM "google.com" FROM "forms-receipts")',
    '(SUBJECT "Google Forms" SUBJECT "Respuesta registrada")',
    '(BODY "hemos registrado" BODY "Respuesta enviada")',
    '(FROM "claro" FROM "Claro Colombia")',
    '(FROM "notificaciones" FROM "no-reply")',
]

for query in searches:
    status, messages = mail.search(None, query)
    count = len(messages[0].split()) if status == "OK" and messages[0] else 0
    print(f"\nQuery: {query[:60]}...")
    print(f"  Resultados: {count}")
    
    if count > 0:
        ids = messages[0].split()[-5:]  # Last 5
        for msg_id in ids:
            status, data = mail.fetch(msg_id, "(RFC822)")
            if status != "OK": continue
            msg = email.message_from_bytes(data[0][1])
            subject = decode_str(msg["Subject"])
            from_addr = decode_str(msg.get("From", ""))
            date = decode_str(msg["Date"])
            print(f"  [{date[:10]}] {from_addr[:40]} | {subject[:80]}")

# Also search for specific OT number patterns in last 200 emails
print("\n\n--- Buscando numeros OT en emails recientes ---")
status, messages = mail.search(None, "ALL")
if status == "OK" and messages[0]:
    all_ids = messages[0].split()
    recent = all_ids[-200:]
    ot_count = 0
    for msg_id in recent:
        status, data = mail.fetch(msg_id, "(RFC822)")
        if status != "OK": continue
        msg = email.message_from_bytes(data[0][1])
        subject = decode_str(msg["Subject"])
        from_addr = decode_str(msg.get("From", ""))
        
        # Check for 7+ digit numbers (OT format)
        ots = re.findall(r'\b(\d{7,})\b', subject)
        if ots:
            ot_count += 1
            date = decode_str(msg["Date"])
            print(f"  [{date[:10]}] {from_addr[:40]} | {subject[:80]} | OT: {ots[0]}")
    
    print(f"\nTotal correos con OTs en asunto: {ot_count} / 200")

mail.logout()
