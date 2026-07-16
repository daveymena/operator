import requests

key = "fe_oa_db8434da9d092b657e26dba8e2cdbf5cc460848f7e3b490c"
key_stripped = "db8434da9d092b657e26dba8e2cdbf5cc460848f7e3b490c"

base = "https://api.freemodel.dev"

# Test different auth approaches
tests = [
    ("Bearer " + key, {"Authorization": f"Bearer {key}"}),
    ("api-key " + key, {"Authorization": f"api-key {key}"}),
    ("X-API-Key", {"X-API-Key": key}),
    ("Bearer stripped", {"Authorization": f"Bearer {key_stripped}"}),
    ("No auth", {}),
]

for name, headers in tests:
    try:
        r = requests.post(f"{base}/v1/chat/completions",
            json={"model": "gpt-5.5", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 5},
            headers={**headers, "Content-Type": "application/json"},
            timeout=10)
        print(f"[{name}] {r.status_code}: {r.text[:100]}")
    except Exception as e:
        print(f"[{name}] ERROR: {str(e)[:50]}")
