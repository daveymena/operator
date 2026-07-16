import os, sys, requests

api_key = os.environ.get("GROQ_API_KEY", "")
print(f"GROQ_API_KEY set: {bool(api_key)}")
if not api_key:
    print("No Groq API key available")
    sys.exit(1)

audio_path = os.path.join(os.path.dirname(__file__), "_captcha_1782818127647.mp3")
print(f"Audio file exists: {os.path.exists(audio_path)}")
if not os.path.exists(audio_path):
    sys.exit(1)

print(f"Audio size: {os.path.getsize(audio_path)} bytes")

with open(audio_path, "rb") as f:
    files = {"file": ("audio.mp3", f, "audio/mpeg")}
    headers = {"Authorization": f"Bearer {api_key}"}
    resp = requests.post(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        headers=headers,
        files=files,
        data={"model": "whisper-large-v3", "language": "es", "response_format": "json"},
        timeout=60
    )

print(f"Status: {resp.status_code}")
if resp.ok:
    text = resp.json().get("text", "")
    print(f"Text: \"{text}\"")
    if text:
        print("SUCCESS: Groq Whisper transcribio el audio!")
    else:
        print("FAIL: Empty transcription")
else:
    print(f"Error: {resp.text[:300]}")
