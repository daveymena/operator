"""
solve_audio_captcha.py
=======================
Resuelve audio captchas de Google reCAPTCHA usando speech-to-text.
Usa faster-whisper local + Google STT alternativo + AI refine.
"""

import sys, os, json, tempfile, urllib.request, subprocess, re, requests

try:
    import speech_recognition as sr
except ImportError:
    print("ERROR: speech_recognition no instalado", file=sys.stderr)
    sys.exit(1)

# --- Config AI ---
FREEMODEL_URL = "https://api.freemodel.dev/v1/chat/completions"
USER_API_KEY = "fe_oa_db8434da9d092b657e26dba8e2cdbf5cc460848f7e3b490c"

def _get_zen_api_key():
    try:
        import yaml
        cfg_path = os.path.join(os.environ.get("LOCALAPPDATA", ""), "hermes", "config.yaml")
        if os.path.exists(cfg_path):
            with open(cfg_path) as f:
                cfg = yaml.safe_load(f)
            if cfg and "keys" in cfg and "opencode" in cfg["keys"]:
                return cfg["keys"]["opencode"]
    except Exception:
        pass
    return os.environ.get("OPENCODE_API_KEY", "")

ZEN_API_KEY = _get_zen_api_key()

def _find_ffmpeg():
    import shutil
    ff = shutil.which("ffmpeg")
    if ff: return ff
    script_dir = os.path.dirname(os.path.abspath(__file__))
    for cand in [
        os.path.join(script_dir, "node_modules", "ffmpeg-static", "ffmpeg.exe"),
        os.path.join(script_dir, "..", "node_modules", "ffmpeg-static", "ffmpeg.exe")
    ]:
        if os.path.exists(cand):
            return os.path.abspath(cand)
    return "ffmpeg"

FFMPEG_PATH = _find_ffmpeg()

def convert_to_wav(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".wav": return path
    wav_path = path + ".wav"
    try:
        subprocess.run(
            [FFMPEG_PATH, "-y", "-i", path, "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", wav_path],
            capture_output=True, timeout=30, check=True
        )
        print(f"OK WAV: {FFMPEG_PATH}", file=sys.stderr)
        return wav_path
    except Exception as e:
        print(f"ERROR ffmpeg: {e}", file=sys.stderr)
        return path

def _get_groq_key():
    """Get Groq API key from environment, trying multiple sources."""
    # 1) Direct env var (may be overridden by .env with empty value)
    direct = os.environ.get("GROQ_API_KEY", "")
    if direct: return direct
    # 2) Try PowerShell system-level env
    try:
        import subprocess
        result = subprocess.run(
            ["powershell", "-Command", "[Environment]::GetEnvironmentVariable('GROQ_API_KEY', 'User')"],
            capture_output=True, text=True, timeout=5
        )
        key = result.stdout.strip()
        if key: return key
        result = subprocess.run(
            ["powershell", "-Command", "[Environment]::GetEnvironmentVariable('GROQ_API_KEY', 'Machine')"],
            capture_output=True, text=True, timeout=5
        )
        key = result.stdout.strip()
        if key: return key
    except Exception:
        pass
    return ""

def transcribe_groq(audio_path):
    """Transcribe using Groq Whisper-large-v3 (cloud, best accuracy)."""
    api_key = _get_groq_key()
    if not api_key:
        print("Groq SKIP: no API key", file=sys.stderr)
        return None
    try:
        with open(audio_path, "rb") as f:
            files = {"file": ("audio.mp3", f, "audio/mpeg")}
            headers = {"Authorization": f"Bearer {api_key}"}
            resp = requests.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers=headers,
                files=files,
                data={"model": "whisper-large-v3", "language": "es", "response_format": "json"},
                timeout=60
            )
        if resp.ok:
            text = resp.json().get("text", "").strip()
            if text:
                print(f"Groq OK: \"{text[:60]}\"", file=sys.stderr)
                return text
        print(f"Groq fail: {resp.status_code}", file=sys.stderr)
    except Exception as e:
        print(f"Groq error: {e}", file=sys.stderr)
    return None

def download_audio(url_or_path):
    if os.path.isfile(url_or_path): return url_or_path
    if url_or_path.startswith(("http://", "https://", "data:")):
        ext = ".mp3"
        for e in (".wav", ".flac", ".ogg"):
            if url_or_path.endswith(e): ext = e
        fd, path = tempfile.mkstemp(suffix=ext)
        os.close(fd)
        try:
            urllib.request.urlretrieve(url_or_path, path)
            print(f"OK audio descargado", file=sys.stderr)
            return path
        except Exception as e:
            print(f"ERROR download: {e}", file=sys.stderr)
            sys.exit(1)
    if not os.path.exists(url_or_path):
        print(f"ERROR: no existe {url_or_path}", file=sys.stderr)
        sys.exit(1)
    return url_or_path

def transcribe_google(audio_path, lang="es-ES"):
    recognizer = sr.Recognizer()
    with sr.AudioFile(audio_path) as source:
        audio = recognizer.record(source)
    try:
        text = recognizer.recognize_google(audio, language=lang)
        return text
    except sr.UnknownValueError:
        return None
    except sr.RequestError as e:
        print(f"ERROR Google STT ({lang}): {e}", file=sys.stderr)
        return None

def transcribe_whisper(audio_path, language=None):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return None, "no_whisper"
    model = None
    try:
        model = WhisperModel("base", device="cpu", compute_type="int8")
        kw = {"beam_size": 3, "word_timestamps": False}
        if language:
            kw["language"] = language
        segments, info = model.transcribe(audio_path, **kw)
        text = " ".join(seg.text for seg in segments).strip()
        if text:
            return text, f"whisper_{info.language if hasattr(info, 'language') else 'auto'}"
        return None, "whisper_empty"
    except Exception as e:
        print(f"ERROR whisper: {e}", file=sys.stderr)
        return None, "whisper_err"
    finally:
        if model is not None:
            try: del model
            except: pass

def call_ai_refine(text, api_key, endpoint, model):
    if not api_key or not text: return None
    try:
        resp = requests.post(endpoint, json={
            "model": model,
            "messages": [
                {"role": "system", "content": "Eres un asistente que extrae solo los numeros hablados en audios de reCAPTCHA de Google. Responde SOLO con los numeros que identificas, separados por espacio. Si el audio no tiene numeros claros, responde 'NADA'."},
                {"role": "user", "content": f"Transcripcion de audio captcha: \"{text}\". Extrae solo los numeros hablados."}
            ],
            "max_tokens": 1024,
            "stream": False
        }, headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }, timeout=30)
        if resp.ok:
            ai_text = resp.json()["choices"][0]["message"]["content"].strip()
            if ai_text and ai_text != "NADA":
                print(f"AI refine: \"{text[:40]}\" -> \"{ai_text}\"", file=sys.stderr)
                return ai_text
    except Exception as e:
        pass
    return None

def extract_numbers(text):
    nums = re.sub(r'[^0-9\s]', '', text).strip()
    if nums: return nums
    # Intentar extraer numeros escritos en palabras
    word_map = {"cero": "0", "uno": "1", "dos": "2", "tres": "3", "cuatro": "4", "cinco": "5",
                "seis": "6", "siete": "7", "ocho": "8", "nueve": "9", "diez": "10",
                "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
                "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10"}
    lower = text.lower()
    found = []
    for word, digit in word_map.items():
        if word in lower:
            found.append(digit)
    if found: return " ".join(found)
    return text

def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("--help", "-h", "help"):
        print(__doc__)
        sys.exit(0)

    audio_source = sys.argv[1]
    audio_path = download_audio(audio_source)
    if not audio_path: sys.exit(1)
    wav_path = convert_to_wav(audio_path)

    transcribed = None
    method_used = ""

    # 1) Groq Whisper-large-v3 (cloud, best accuracy)
    print("Groq Whisper...", file=sys.stderr)
    transcribed = transcribe_groq(wav_path)
    if transcribed: method_used = "groq"

    # 2) Google STT es-ES
    if not transcribed or not re.search(r'[0-9]', transcribed):
        print("Google ES...", file=sys.stderr)
        transcribed = transcribe_google(wav_path, "es-ES")
        method_used = "google_es"

    # 3) Google STT en-US (fallback)
    if not transcribed or not re.search(r'[0-9]', transcribed):
        print("Google EN...", file=sys.stderr)
        en = transcribe_google(wav_path, "en-US")
        if en and (re.search(r'[0-9]', en) or not transcribed):
            transcribed = en
            method_used = "google_en"

    # 4) faster-whisper auto
    if not transcribed or not re.search(r'[0-9]', transcribed):
        print("Whisper auto...", file=sys.stderr)
        w, m = transcribe_whisper(wav_path)
        if w:
            transcribed = w
            method_used = m

    # 5) faster-whisper con espanol forzado
    if not transcribed or not re.search(r'[0-9]', transcribed):
        print("Whisper ES...", file=sys.stderr)
        w, m = transcribe_whisper(wav_path, "es")
        if w:
            transcribed = w
            method_used = m

    if not transcribed:
        print('ERROR: No se pudo transcribir', file=sys.stderr)
        sys.exit(1)

    print(f"Transcripcion cruda: \"{transcribed[:100]}\"", file=sys.stderr)

    numbers = extract_numbers(transcribed)

    # AI refine si no hay numeros
    if not numbers or not re.search(r'[0-9]', numbers):
        for api_key, endpoint, model in [
            (USER_API_KEY, FREEMODEL_URL, "gpt-5.5"),
            (USER_API_KEY, FREEMODEL_URL, "gpt-5.4"),
        ]:
            ref = call_ai_refine(transcribed, api_key, endpoint, model)
            if ref:
                numbers = ref
                method_used = "ai_refined"
                break

    if not numbers:
        numbers = transcribed

    result = {
        "transcripcion": transcribed.strip(),
        "numeros": numbers.strip(),
        "metodo": method_used
    }
    print(json.dumps(result, ensure_ascii=False))

    for f in [audio_path, wav_path]:
        if f and f != audio_source and os.path.exists(f):
            try: os.unlink(f)
            except: pass

if __name__ == "__main__":
    main()
