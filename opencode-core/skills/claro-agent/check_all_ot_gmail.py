import imaplib, email, json, os, sys
from email.header import decode_header

sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)

EMAIL = "daveymena16@gmail.com"
PASS = "cwfx xjwe syaj wcku"

mail = imaplib.IMAP4_SSL("imap.gmail.com")
mail.login(EMAIL, PASS)
print("Conectado!")
mail.select("INBOX")

orders = json.load(open("ordenes_procesadas.json", encoding="utf-8"))

# User's 34 OTs
user_ots = [
    "8044470","8037274","8002354","7976193","7957214","7955164",
    "7970020","7965841","7936028","7952325","7927327","7817136",
    "7757595","8043066","7868460","8039485","8027428","7993428",
    "8006905","8017402","7973829","7970361","7962000","7938630",
    "472881949","7964944","7954654","472883311","7939861","7929463",
    "472727748","7838981","7825493","7763816"
]

found = []
notfound = []

for ot in user_ots:
    status, messages = mail.search(None, f'TEXT "{ot}"')
    ids = messages[0].split() if status == "OK" and messages[0] else []
    if ids:
        found.append(ot)
        print(f"OT {ot}: {len(ids)} emails")
    else:
        notfound.append(ot)
        print(f"OT {ot}: SIN email")

mail.logout()

print(f"\n=== RESUMEN ===")
print(f"Con confirmacion: {len(found)}")
print(f"Sin confirmacion: {len(notfound)}")
if notfound:
    print(f"\nFaltantes:")
    for x in notfound:
        print(f"  OT {x}")
