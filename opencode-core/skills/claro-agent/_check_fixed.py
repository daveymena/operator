"""
Show FULL body of form receipts - both matching and non-matching
to see where the account data actually appears.
"""
import imaplib
import email
from email.header import decode_header
import json
import re
import os, sys

sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)

EMAIL = "daveymena16@gmail.com"
PASSWORD = "cwfx xjwe syaj wcku"

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

mail = imaplib.IMAP4_SSL("imap.gmail.com")
mail.login(EMAIL, PASSWORD)
print("Conectado!")
mail.select("INBOX")

# Get form receipts
status, messages = mail.search(None, '(FROM "forms-receipts")')
if status != "OK" or not messages[0]:
    print("No forms receipts found")
    exit()

ids = messages[0].split()
print(f"Total form receipts: {len(ids)}")

# Show a few from June 15 (first ones) with full body
print(f"\n{'='*70}")
print("ULTIMOS 5 RECEIPTS - BODY COMPLETO")
print(f"{'='*70}")

# Get last 5
recent = ids[-5:]
for msg_id in recent:
    status, data = mail.fetch(msg_id, "(RFC822)")
    if status != "OK": continue
    msg = email.message_from_bytes(data[0][1])
    
    subject = decode_str(msg["Subject"])
    date_raw = decode_str(msg["Date"])[:25]
    
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                body = part.get_payload(decode=True).decode("utf-8", errors="replace")
                break
    else:
        body = msg.get_payload(decode=True).decode("utf-8", errors="replace")
    
    print(f"\n--- [{date_raw}] ---")
    print(f"Subject: {subject}")
    print(f"LENGTH: {len(body)} chars")
    print(f"BODY:")
    print(body[:2000])
    print("---")

# Now show the FIRST form receipt (oldest one we have)
print(f"\n\n{'='*70}")
print("PRIMER RECEIPT (el mas antiguo)")
print(f"{'='*70}")

first_id = ids[0]
status, data = mail.fetch(first_id, "(RFC822)")
if status == "OK":
    msg = email.message_from_bytes(data[0][1])
    subject = decode_str(msg["Subject"])
    date_raw = decode_str(msg["Date"])[:25]
    
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                body = part.get_payload(decode=True).decode("utf-8", errors="replace")
                break
    else:
        body = msg.get_payload(decode=True).decode("utf-8", errors="replace")
    
    print(f"\n[{date_raw}] Subject: {subject}")
    print(f"Body length: {len(body)} chars")
    print(body[:2000])

mail.logout()
