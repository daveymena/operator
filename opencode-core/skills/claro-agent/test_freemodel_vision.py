import requests, base64

key = "fe_oa_db8434da9d092b657e26dba8e2cdbf5cc460848f7e3b490c"
base = "https://api.freemodel.dev"

# Create a simple test image (1x1 pixel PNG)
import io
# Use a minimal valid PNG with some visible content
# Red dot on white background
test_png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMklEQVQ4T2NkYPj/n4EBBJgYKAQMFOmnhIFiAxgZGSk2gIHY8CclDBQbwMDAAOIiAJoNADH/AaHjAAAAAElFTkSuQmCC")

# Convert to base64 data URL
img_b64 = base64.b64encode(test_png).decode()
data_url = f"data:image/png;base64,{img_b64}"

# Test vision with gpt-5.5
r = requests.post(f"{base}/v1/chat/completions",
    json={"model": "gpt-5.5", "messages": [{"role": "user", "content": [
        {"type": "text", "text": "What color is this image? Reply with one word"},
        {"type": "image_url", "image_url": {"url": data_url}}
    ]}], "max_tokens": 10},
    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    timeout=30)
print(f"gpt-5.5 vision: {r.status_code}")
if r.ok:
    print(f"  {r.json()['choices'][0]['message']['content']}")
else:
    print(f"  {r.text[:200]}")

# Test with gpt-4o
r2 = requests.post(f"{base}/v1/chat/completions",
    json={"model": "gpt-4o", "messages": [{"role": "user", "content": [
        {"type": "text", "text": "What color is this image? Reply with one word"},
        {"type": "image_url", "image_url": {"url": data_url}}
    ]}], "max_tokens": 10},
    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    timeout=30)
print(f"gpt-4o vision: {r2.status_code}")
if r2.ok:
    print(f"  {r2.json()['choices'][0]['message']['content']}")
else:
    print(f"  {r2.text[:200]}")
