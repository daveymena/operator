import requests

key = "fe_oa_db8434da9d092b657e26dba8e2cdbf5cc460848f7e3b490c"
base = "https://freemodel.dev"

paths = [
    "/v1/chat/completions",
    "/api/chat/completions",
    "/api/v1/chat/completions",
    "/chat/completions",
    "/completions",
    "/v1/completions",
]

for path in paths:
    try:
        r = requests.post(f"{base}{path}",
            json={"model": "gpt-5.5", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 5},
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            timeout=10)
        print(f"POST {path}: {r.status_code}")
        if r.status_code < 500:
            print(f"  {r.text[:200]}")
    except Exception as e:
        print(f"POST {path}: ERROR {str(e)[:50]}")

# Try GET
for path in ["/", "/v1", "/api", "/health", "/docs"]:
    try:
        r = requests.get(f"{base}{path}", headers={"Authorization": f"Bearer {key}"}, timeout=10)
        print(f"GET {path}: {r.status_code}")
        if r.status_code < 500:
            print(f"  {r.text[:200]}")
    except Exception as e:
        pass
