import requests, re

r = requests.get("https://freemodel.dev", timeout=10)
html = r.text

# Look for API-related content
apis = re.findall(r'api[^"<>]*', html, re.I)
print("API references:", apis[:30])

# Check for key/auth references
auths = re.findall(r'(?:key|auth|token|bearer|endpoint|base)[^"<>]*', html, re.I)
print("Auth references:", auths[:20])

# Look for any JS files or config
scripts = re.findall(r'src="([^"]+\.js)"', html)
print("Scripts:", scripts[:10])

# Try to get any JS config
for s in scripts[:3]:
    try:
        sr = requests.get(f"https://freemodel.dev{s}", timeout=10)
        if "api" in sr.text.lower() or "key" in sr.text.lower():
            lines = [l for l in sr.text.split('\n') if 'api' in l.lower() or 'key' in l.lower() or 'endpoint' in l.lower() or 'base' in l.lower() or 'gpt' in l.lower()]
            print(f"\n{s} relevant lines:")
            for l in lines[:10]:
                print(f"  {l[:200]}")
    except:
        pass
