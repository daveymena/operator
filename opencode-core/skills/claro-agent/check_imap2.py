"""
Check Gmail for any emails related to the orders.
"""
import imaplib
import email
from email.header import decode_header
import json
import re
import os

EMAIL = "daveymena16@gmail.com"
PASSWORD = "cwfx xjwe syaj wcku"
IMAP_SERVER = "imap.gmail.com"

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

# Get recent emails (last 50)
status, messages = mail.search(None, "ALL")
if status != "OK":
    print("No se pudo buscar")
    exit()

ids = messages[0].split()
# Get last 30 emails
recent = ids[-30:]
print(f"Total emails: {len(ids)}, revisando ultimos {len(recent)}...")

results = []
for msg_id in recent:
    status, data = mail.fetch(msg_id, "(RFC822)")
    if status != "OK": continue
    
    raw_email = data[0][1]
    msg = email.message_from_bytes(raw_email)
    
    subject = decode_str(msg["Subject"])
    date = decode_str(msg["Date"])
    from_addr = decode_str(msg.get("From", ""))
    
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
    
    # Look for OT numbers
    ots = re.findall(r'(?:OT|ot|O\.?T\.?)[\s:#;]*(\d{5,})', body + subject)
    ots += re.findall(r'(?<!\d)(\d{7,})(?!\d)', body + subject)  # 7+ digit numbers
    
    # Check if it's a form submission confirmation
    is_form = "forms" in from_addr.lower() or "google" in from_addr.lower()
    is_confirmation = any(kw in body.lower() for kw in ["registrada", "hemos registrado", "respuesta enviada"])
    is_claro = "claro" in (body + subject).lower()
    
    results.append({
        "from": from_addr[:60],
        "subject": subject[:100],
        "date": date[:30],
        "ots": list(set(ots))[:5],
        "is_form": is_form,
        "is_confirmation": is_confirmation,
        "is_claro": is_claro,
        "body_snippet": body[:150].replace("\n", " ")
    })
    
    markers = []
    if is_form: markers.append("FORMS")
    if is_confirmation: markers.append("CONFIRM")
    if ots: markers.append(f"OT={ots[0]}")
    if is_claro: markers.append("CLARO")
    
    print(f"[{results[-1]['date'][:10]}] {from_addr[:30]} | {subject[:50]} | {' '.join(markers)}")

mail.logout()

# Save
output_path = os.path.join(os.path.dirname(__file__), "gmail_recent.json")
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
print(f"\nGuardado en {output_path}")
