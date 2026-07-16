"""
Check Gmail via IMAP to find which orders have been submitted already.
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

def search_orders():
    print(f"Conectando a {EMAIL}...")
    mail = imaplib.IMAP4_SSL(IMAP_SERVER)
    mail.login(EMAIL, PASSWORD)
    print("Conectado!")
    
    mail.select("INBOX")
    
    # Search for Google Forms confirmation emails
    # These typically have subject containing "Respuesta registrada" or similar
    status, messages = mail.search(None, '(SUBJECT "Respuesta" SUBJECT "registrada" SUBJECT "Google Forms")')
    if status != "OK":
        print("No se pudo buscar")
        mail.logout()
        return []
    
    ids = messages[0].split()
    print(f"Encontrados {len(ids)} emails de formularios")
    
    results = []
    for i, msg_id in enumerate(ids):
        status, data = mail.fetch(msg_id, "(RFC822)")
        if status != "OK": continue
        
        raw_email = data[0][1]
        msg = email.message_from_bytes(raw_email)
        
        subject = decode_str(msg["Subject"])
        date = decode_str(msg["Date"])
        
        # Get body
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
        
        # Look for OT numbers or order identifiers in the body
        # Google Forms confirmation typically shows:
        # "Hemos registrado tu respuesta" or "Respuesta registrada"
        confirmed = any(kw in body.lower() for kw in ["registrada", "hemos registrado", "respuesta enviada"])
        
        # Try to extract OT number from body
        ot_match = re.search(r'(?:OT|ot|ORDEN|orden)\s*[#:;\s]*(\d{5,})', body)
        ot = ot_match.group(1) if ot_match else ""
        
        results.append({
            "subject": subject[:100],
            "date": date,
            "confirmed": confirmed,
            "ot": ot,
            "body_snippet": body[:200].replace("\n", " ")
        })
        
        print(f"[{i+1}/{len(ids)}] {subject[:60]}... | OT: {ot or '?'} | Confirmado: {confirmed}")
        
        if i >= 200:  # Limit to avoid timeout
            break
    
    mail.logout()
    return results

results = search_orders()

# Save results
output_path = os.path.join(os.path.dirname(__file__), "gmail_confirmed.json")
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
print(f"\nGuardado en {output_path}")
print(f"Total confirmados: {sum(1 for r in results if r['confirmed'])}")
print(f"OTS encontradas: {[r['ot'] for r in results if r['ot']]}")
