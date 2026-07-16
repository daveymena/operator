import requests, os

key = os.environ.get("OPENROUTER_API_KEY", "")
if not key:
    print("No OpenRouter key")
    exit()

r = requests.get("https://openrouter.ai/api/v1/models", headers={"Authorization": f"Bearer {key}"})
if not r.ok:
    print(f"Error: {r.status_code}")
    exit()

models = r.json().get("data", [])
print("Free vision models (prompt=0 and image=0):")
for m in models:
    mid = m.get("id", "")
    pricing = m.get("pricing", {})
    prompt = float(pricing.get("prompt", 999))
    completion = float(pricing.get("completion", 999))
    image = float(pricing.get("image", 999))
    if prompt == 0 and image == 0 and ("vision" in mid.lower() or "gemini" in mid.lower() or "llama-3.2" in mid.lower()):
        print(f"  {mid}: prompt=${prompt}/M, image=${image}/image")
    if prompt == 0 and image == 0:
        print(f"  FREE: {mid}")
