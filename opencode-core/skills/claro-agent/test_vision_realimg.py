import requests, base64, os

key = "fe_oa_db8434da9d092b657e26dba8e2cdbf5cc460848f7e3b490c"
base = "https://api.freemodel.dev"

# Use a real file - let's create a simple test image using a real tool
# or use the captcha audio file? No, we need an image.
# Let's download a real small PNG
r_img = requests.get("https://www.google.com/images/branding/googlelogo/1x/googlelogo_light_color_272x92dp.png", timeout=10)
img_bytes = r_img.content
print(f"Downloaded image: {len(img_bytes)} bytes")

img_b64 = base64.b64encode(img_bytes).decode()
data_url = f"data:image/png;base64,{img_b64}"

r = requests.post(f"{base}/v1/chat/completions",
    json={"model": "gpt-5.5", "messages": [{"role": "user", "content": [
        {"type": "text", "text": "What company logo is this? Reply with one word"},
        {"type": "image_url", "image_url": {"url": data_url}}
    ]}], "max_tokens": 20},
    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    timeout=30)
print(f"Vision gpt-5.5: {r.status_code}")
if r.ok:
    content = r.json()['choices'][0]['message']['content']
    print(f"  Response: {content}")
else:
    print(f"  {r.text[:300]}")

# Also try with URL directly
r2 = requests.post(f"{base}/v1/chat/completions",
    json={"model": "gpt-5.5", "messages": [{"role": "user", "content": [
        {"type": "text", "text": "What company logo is this? Reply with one word"},
        {"type": "image_url", "image_url": {"url": "https://www.google.com/images/branding/googlelogo/1x/googlelogo_light_color_272x92dp.png"}}
    ]}], "max_tokens": 20},
    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    timeout=30)
print(f"Vision gpt-5.5 URL: {r2.status_code}")
if r2.ok:
    content = r2.json()['choices'][0]['message']['content']
    print(f"  Response: {content}")
else:
    print(f"  {r2.text[:300]}")
