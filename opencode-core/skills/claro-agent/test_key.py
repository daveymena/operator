import requests, json, os

key = "fe_oa_db8434da9d092b657e26dba8e2cdbf5cc460848f7e3b490c"

endpoints = [
    # OpenAI compatible
    ("https://api.openai.com/v1/models", {"Authorization": f"Bearer {key}"}),
    # Groq
    ("https://api.groq.com/openai/v1/models", {"Authorization": f"Bearer {key}"}),
    # OpenRouter
    ("https://openrouter.ai/api/v1/auth/key", {"Authorization": f"Bearer {key}"}),
    # Together
    ("https://api.together.xyz/v1/models", {"Authorization": f"Bearer {key}"}),
    # DeepSeek
    ("https://api.deepseek.com/v1/models", {"Authorization": f"Bearer {key}"}),
    # Fireworks
    ("https://api.fireworks.ai/v1/models", {"Authorization": f"Bearer {key}"}),
    # Anthropic
    ("https://api.anthropic.com/v1/models", {"x-api-key": key}),
    # Mistral
    ("https://api.mistral.ai/v1/models", {"Authorization": f"Bearer {key}"}),
    # xAI
    ("https://api.x.ai/v1/models", {"Authorization": f"Bearer {key}"}),
    # Google Gemini (REST)
    (f"https://generativelanguage.googleapis.com/v1beta/models?key={key}", {}),
    # Perplexity
    ("https://api.perplexity.ai/models", {"Authorization": f"Bearer {key}"}),
    # Cerebras
    ("https://api.cerebras.ai/v1/models", {"Authorization": f"Bearer {key}"}),
]

for url, headers in endpoints:
    try:
        r = requests.get(url, headers=headers, timeout=10)
        print(f"[{r.status_code}] {url.split('/')[2]}")
        if r.status_code == 200:
            print(f"  WORKS! {r.text[:100]}")
    except Exception as e:
        print(f"[ERR] {url.split('/')[2]}: {str(e)[:50]}")
