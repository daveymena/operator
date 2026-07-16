import re, os
from playwright.sync_api import sync_playwright

FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfd9f3bIBYdrMps4YlASFWr2Zsg81eiIsXF8wtq2bZ_xaSsYA/viewform"
DIR = os.path.dirname(__file__)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page()
    page.goto(FORM_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    page.screenshot(path=os.path.join(DIR, "screenshot.png"), full_page=True)
    print("Title:", page.title())
    print("URL:", page.url)
    html = page.content()
    inputs = re.findall(r'name=["\'](entry\.[^"\']+)["\']', html)
    for inp in inputs[:20]:
        print("  input:", inp)
    b.close()
