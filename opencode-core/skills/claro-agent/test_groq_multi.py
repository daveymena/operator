import os, sys, requests

api_key = os.environ.get("GROQ_API_KEY", "")
audio_path = os.path.join(os.path.dirname(__file__), "_captcha_1782818127647.mp3")

tests = [
    {"model": "whisper-large-v3", "language": None},
    {"model": "whisper-large-v3", "language": "es"},
    {"model": "whisper-large-v3", "language": "en"},
    {"model": "whisper-large-v3-turbo", "language": None},
    {"model": "whisper-large-v3-turbo", "language": "es"},
]

for t in tests:
    data = {"model": t["model"], "response_format": "json"}
    if t["language"]:
        data["language"] = t["language"]
    with open(audio_path, "rb") as f:
        files = {"file": ("audio.mp3", f, "audio/mpeg")}
        headers = {"Authorization": f"Bearer {api_key}"}
        resp = requests.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers=headers, files=files, data=data, timeout=60
        )
    label = f'{t["model"]}/{t.get("language", "auto")}'
    if resp.ok:
        text = resp.json().get("text", "").strip()
        print(f'{label}: "{text}"')
    else:
        print(f'{label}: ERROR {resp.status_code}')
