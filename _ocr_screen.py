import pytesseract
from PIL import Image
import sys

img_path = r"C:\Users\ADMIN\Music\proyecto-unificado\screen_capture.png"
try:
    img = Image.open(img_path)
    text = pytesseract.image_to_string(img, lang='spa+eng')
    print(text)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)