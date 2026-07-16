"""Test audio transcription with freemodel API"""
import json, base64, os, sys, requests

API_KEY = "fe_oa_db8434da9d092b657e26dba8e2cdbf5cc460848f7e3b490c"
AUDIO_FILE = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\ADMIN\Downloads\Hello-World\claro_agente_final\_captcha_1782818127647.mp3"

if not os.path.exists(AUDIO_FILE):
    print(f"File not found: {AUDIO_FILE}")
    sys.exit(1)

with open(AUDIO_FILE, "rb") as f:
    audio_b64 = base64.b64encode(f.read()).decode()

print(f"Audio size: {len(audio_b64)} bytes base64")

# Test with gpt-4o-audio-preview
for model in ["gpt-4o-audio-preview", "gpt-4o", "gpt-4o-mini"]:
    print(f"\n--- Testing {model} ---")
    try:
        resp = requests.post(
            "https://api.freemodel.dev/v1/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {API_KEY}"
            },
            json={
                "model": model,
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "input_audio", "input_audio": {"data": audio_b64, "format": "mp3"}},
                        {"type": "text", "text": "Listen carefully to this audio. It contains spoken digits. Transcribe ONLY the digits you hear, separated by spaces. Example: 7 3 9 2"}
                    ]
                }],
                "max_tokens": 50
            },
            timeout=30
        )
        data = resp.json()
        text = data.get("choices", [{}])[0].get("message", {}).get("content", "NO RESPONSE")
        print(f"  Response: {text[:200]}")
        
        # Check for numbers
        import re
        nums = re.findall(r'\d+', text)
        print(f"  Numbers found: {nums}")
    except Exception as e:
        print(f"  Error: {e}")
