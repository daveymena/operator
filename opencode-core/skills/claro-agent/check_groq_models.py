import requests, os, json

key = os.environ.get('GROQ_API_KEY', '')
r = requests.get('https://api.groq.com/openai/v1/models', headers={'Authorization': f'Bearer {key}'})
data = r.json()
for m in data.get('data', []):
    mid = m['id']
    if 'vision' in mid or 'llama-4' in mid or 'llama-3.2' in mid or 'llama-3.1' in mid:
        print(f"{mid}: active={m.get('active', '?')}, context={m.get('context_window', '?')}")
