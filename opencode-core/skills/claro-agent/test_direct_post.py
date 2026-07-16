import requests, re

FORM_ID = "1FAIpQLSfd9f3bIBYdrMps4YlASFWr2Zsg81eiIsXF8wtq2bZ_xaSsYA"
VIEW_URL = f"https://docs.google.com/forms/d/e/{FORM_ID}/viewform"
POST_URL = f"https://docs.google.com/forms/d/e/{FORM_ID}/formResponse"

s = requests.Session()

# Step 1: GET the form to get fbzx token
r = s.get(VIEW_URL, timeout=30)
html = r.text

# Extract fbzx
m = re.search(r'name="fbzx"[^>]*value="([^"]+)"', html)
fbzx = m.group(1) if m else ""
print(f"fbzx: {fbzx}")

# Extract all entry field names
entries = re.findall(r'name="(entry\.\d+)"', html)
unique_entries = list(set(entries))
print(f"Entries found: {len(unique_entries)}")
for e in sorted(unique_entries):
    print(f"  {e}")

# Extract page history
pages = re.findall(r'value="(\d+)"[^>]*jsname[^>]*data-initial-page', html)
page_history = ",".join(pages) if pages else "0"
print(f"Page history: {page_history}")

# Step 2: Try submitting with a simple test
if fbzx:
    data = {"fbzx": fbzx, "pageHistory": page_history, "fvv": "1"}
    # Add first few entries with dummy values
    for i, e in enumerate(sorted(unique_entries)[:3]):
        data[e] = f"test_{i}"
    
    r2 = s.post(POST_URL, data=data, timeout=30)
    print(f"POST status: {r2.status_code}")
    print(f"URL: {r2.url}")
    # Check if submission succeeded (usually redirects to response page)
    print(f"Redirected to: {r2.url}")
