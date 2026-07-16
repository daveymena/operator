"""
Search specifically for Google Forms confirmation emails and Claro-related emails.
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

# Search for Google Forms confirmation emails
# Google sends from "forms-receipts@google.com" or similar
queries = [
    '(FROM "forms-receipts" SUBJECT "respuesta")',
    '(FROM "forms" SUBJECT "registrada")',
    '(FROM "google" SUBJECT "Forms")',
    '(SUBJECT "Google Forms")',
    '(SUBJECT "Respuesta registrada")',
    '(SUBJECT "hemos registrado")',
    '(FROM "claro" SUBJECT "OT")',
    '(FROM "claro" SUBJECT "orden")',
]

all_results = []
for query in queries:
    status, messages = mail.search(None, query)
    if status == "OK" and messages[0]:
        ids = messages[0].split()
        print(f"\nQuery '{query}': {len(ids)} resultados")
        
        for msg_id in ids[-10:]:  # Last 10
            status, data = mail.fetch(msg_id, "(RFC822)")
            if status != "OK": continue
            
            raw_email = data[0][1]
            msg = email.message_from_bytes(raw_email)
            
            subject = decode_str(msg["Subject"])
            date = decode_str(msg["Date"])
            from_addr = decode_str(msg.get("From", ""))
            
            body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    if part.get_content_type() == "text/plain":
                        body = part.get_payload(decode=True).decode("utf-8", errors="replace")
                        break
            else:
                body = msg.get_payload(decode=True).decode("utf-8", errors="replace")
            
            ots = re.findall(r'(?:OT|ot)[\s:#;]*(\d{5,})', body + subject)
            
            info = {
                "from": from_addr[:80],
                "subject": subject[:120],
                "date": date[:30],
                "ots": list(set(ots))[:5],
            }
            all_results.append(info)
            print(f"  [{date[:10]}] {from_addr[:40]} | {subject[:60]}")
            if ots:
                print(f"    OT: {ots}")

mail.logout()

output_path = os.path.join(os.path.dirname(__file__), "gmail_forms.json")
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(all_results, f, ensure_ascii=False, indent=2)
print(f"\nGuardado en {output_path}")
print(f"Total: {len(all_results)}")
