# Claro Agent - Context for Hermes

## Project Location
- Windows: C:\Users\ADMIN\Downloads\Hello-World\claro_agente_final
- WSL: /mnt/c/Users/ADMIN/Downloads/Hello-World/claro_agente_final

## Gmail Credentials
- Email: daveymena16@gmail.com
- Password: cwfx xjwe syaj wcku
- IMAP Server: imap.gmail.com (SSL port 993)

## Available Scripts (run from project directory)
- python3 hermes_pipeline.py --orden "texto" - process a new order
- python3 hermes_pipeline.py --run-pending - submit pending orders via form
- python3 hermes_pipeline.py --status - show pending/completed orders
- node fill_orders_final.js - fill Google Form with pending orders
- python3 check_gmail_ots.py - search Gmail for OT numbers
- python3 check_gmail_cuentas.py - find cuentas sent via form confirmations
- python3 check_gmail_ots2.py - search recent emails for OT patterns
- python3 solve_audio_captcha.py [audio_file] - transcribe audio captcha

## Technician Fixed Data
- Cedula: 1077449318
- Nombre: Davey Mena Mosquera
- Auxiliar: 0
- Telefono: 3136174267
- Correo: daveymena16@gmail.com

## Pipeline Flow
1. User provides order text
2. Extract: OT, ciudad, tipo_trabajo, seriales, materiales
3. Save to ordenes_procesadas.json
4. Run python3 hermes_pipeline.py --run-pending
5. Verify submission via Gmail (check_gmail_cuentas.py)
6. Report results to user

## Material Rules
- Posventa: include Cable UTP, RJ45, Patch cords
- Deco: always include 1 Control remoto de deco
- Cable change: Patch cord fibra (Pigtail)
- Fiber change: Fibra Drop (1 unit) + tensors
- ONT change: conectores mecanicos (1-2 units)
- Vary quantities slightly between orders
- Software work: aplicaMaterial = No
