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
for m in models:
    mid = m.get("id", "")
    if "vision" in mid.lower() or "llama-4" in mid.lower() or "gemini" in mid.lower():
        pricing = m.get("pricing", {})
        prompt = float(pricing.get("prompt", 999))
        image_cost = float(pricing.get("image", 999))
        print(f"{mid}: prompt=${prompt}/M, image=${image_cost}/image")
