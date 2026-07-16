import requests

key = "fe_oa_db8434da9d092b657e26dba8e2cdbf5cc460848f7e3b490c"
base = "https://freemodel.dev"

# Test models
r = requests.get(f"{base}/v1/models", headers={"Authorization": f"Bearer {key}"}, timeout=15)
print(f"Models: {r.status_code}")
if r.ok:
    for m in r.json().get("data", []):
        print(f"  {m['id']}")

# Test chat
r2 = requests.post(f"{base}/v1/chat/completions",
    json={"model": "gpt-4o", "messages": [{"role": "user", "content": "Say hello in one word"}], "max_tokens": 10},
    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    timeout=30)
print(f"Chat: {r2.status_code}")
if r2.ok:
    print(f"  {r2.json()['choices'][0]['message']['content']}")
else:
    print(f"  {r2.text[:200]}")

# Test vision
r3 = requests.post(f"{base}/v1/chat/completions",
    json={"model": "gpt-4o", "messages": [{"role": "user", "content": [
        {"type": "text", "text": "What is in this image? Reply with one word"},
        {"type": "image_url", "image_url": {"url": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/300px-PNG_transparency_demonstration_1.png"}}
    ]}], "max_tokens": 20},
    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    timeout=30)
print(f"Vision: {r3.status_code}")
if r3.ok:
    print(f"  {r3.json()['choices'][0]['message']['content']}")
else:
    print(f"  {r3.text[:200]}")
