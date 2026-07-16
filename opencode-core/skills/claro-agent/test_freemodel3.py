import requests

# Try different key formats
keys = [
    "fe_oa_db8434da9d092b657e26dba8e2cdbf5cc460848f7e3b490c",
    "db8434da9d092b657e26dba8e2cdbf5cc460848f7e3b490c",
]

base = "https://freemodel.dev"
paths = ["/api/chat/completions", "/api/v1/chat/completions", "/chat/completions"]

for key in keys:
    for path in paths:
        try:
            r = requests.post(f"{base}{path}",
                json={"model": "gpt-5.5", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 5},
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                timeout=10)
            print(f"[{key[:30]}...] POST {path}: {r.status_code}")
            if r.status_code < 500:
                print(f"  {r.text[:200]}")
        except Exception as e:
            print(f"ERROR: {str(e)[:50]}")
