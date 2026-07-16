"""
local_transcribe.py - Transcriber LOCAL para CAPTCHA audio
Método 1: faster-whisper (local, CPU, sin costo)
Método 2: Google STT (gratis)
Especializado para audio distorsionado de reCAPTCHA (números hablados)
"""
import sys, os, json, re, subprocess

def find_ffmpeg():
    import shutil
    ff = shutil.which("ffmpeg")
    if ff: return ff
    for cand in [
        r"C:\Users\ADMIN\AppData\Local\Microsoft\WinGet\Links\ffmpeg.EXE",
        r"C:\ffmpeg\bin\ffmpeg.exe",
    ]:
        if os.path.exists(cand): return cand
    return "ffmpeg"

def clean_audio(input_path):
    """Limpia audio CAPTCHA: amplifica, quita ruido, normaliza"""
    ffmpeg = find_ffmpeg()
    clean_path = input_path + ".clean.wav"
    try:
        subprocess.run([
            ffmpeg, "-y", "-i", input_path,
            "-af", "highpass=f=100,lowpass=f=4000,afftdn=nf=-30,volume=3.0,aresample=16000,dynaudnorm=g=5:f=250",
            "-ac", "1", "-ar", "16000", clean_path
        ], capture_output=True, timeout=15, check=True)
        return clean_path
    except:
        return None

def extract_numbers_from_text(text):
    """Extrae números del texto transscrito, incluyendo palabras numéricas"""
    # Primero intentar dígitos directos
    nums = re.sub(r'[^0-9\s]', '', text).strip()
    if nums and re.search(r'[0-9]', nums):
        return nums

    # Mapa de palabras a dígitos (inglés + español + variaciones comunes de Whisper)
    word_map = {
        # English
        "zero":"0","oh":"0","o":"0","one":"1","won":"1","won":"1",
        "two":"2","to":"2","too":"2","twos":"2",
        "three":"3","tree":"3","free":"3","threes":"3",
        "four":"4","for":"4","fore":"4","fours":"4",
        "five":"5","fives":"5",
        "six":"6","sax":"6","sixes":"6",
        "seven":"7","sevens":"7",
        "eight":"8","ate":"8","eights":"8",
        "nine":"9","niner":"9","nines":"9","nein":"9",
        "ten":"10",
        # Español
        "cero":"0","uno":"1","dos":"2","tres":"3","cuatro":"4",
        "cinco":"5","seis":"6","siete":"7","ocho":"8","nueve":"9","diez":"10",
        # Whisper a menudo confunde estos sonidos
        "later":"8","latest":"8","lately":"8",
        "visits":"6","visit":"6","business":"6",
        "thanks":"3","thank":"3","think":"3","thick":"3",
        "easy":"1","is":"1","his":"1",
        "effective":"3","effect":"3",
        "listen":"5","lesson":"5",
        "play":"8","say":"8","stay":"8",
        "enter":"3","inter":"3",
        "hear":"3","here":"3",
        "what":"8","want":"8",
        "robot":"2","note":"6","code":"0","hold":"0","old":"0",
    }

    lower = text.lower()
    found = []
    for word, digit in word_map.items():
        if re.search(r'\b' + re.escape(word) + r'\b', lower):
            found.append(digit)

    return " ".join(found) if found else ""

def transcribe_whisper(audio_path):
    """Método 1: faster-whisper local con parámetros optimizados para CAPTCHA"""
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel("base", device="cpu", compute_type="int8")

        # Intentar múltiples configuraciones para CAPTCHA
        configs = [
            # Config 1: Sin VAD, beam_size alto, inglés
            dict(beam_size=5, language="en", vad_filter=False,
                 condition_on_previous_text=False, without_timestamps=True),
            # Config 2: Con VAD suave
            dict(beam_size=5, language="en", vad_filter=True,
                 vad_parameters=dict(min_silence_duration_ms=200, speech_pad_ms=400),
                 condition_on_previous_text=False),
        ]

        best_text = ""
        for cfg in configs:
            try:
                segments, info = model.transcribe(audio_path, **cfg)
                text = " ".join([s.text.strip() for s in segments]).strip()
                if text and len(text) > len(best_text):
                    best_text = text
                nums = extract_numbers_from_text(text)
                if nums:
                    return text, nums, info.language
            except Exception:
                continue

        return best_text, extract_numbers_from_text(best_text), "en"
    except Exception as e:
        return None, None, str(e)

def transcribe_google(wav_path):
    """Método 2: Google STT gratis"""
    try:
        import speech_recognition as sr
        r = sr.Recognizer()
        r.energy_threshold = 200
        r.dynamic_energy_threshold = False
        with sr.AudioFile(wav_path) as s:
            audio = r.record(s)
        for lang in ["en-US", "en-GB", "es-CO"]:
            try:
                text = r.recognize_google(audio, language=lang)
                if text:
                    nums = extract_numbers_from_text(text)
                    return text, nums, lang
            except:
                continue
    except:
        pass
    return None, None, None

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "no file"}))
        sys.exit(0)

    audio_path = sys.argv[1]
    if not os.path.exists(audio_path):
        print(json.dumps({"error": "file not found"}))
        sys.exit(0)

    # 1) Limpiar audio
    clean_path = clean_audio(audio_path)
    work_path = clean_path if clean_path and os.path.exists(clean_path) else audio_path

    # 2) Método PRIMARIO: faster-whisper local
    text, numbers, lang = transcribe_whisper(work_path)
    metodo = "whisper_local"

    # 3) Fallback: Google STT
    if not numbers:
        g_text, g_numbers, g_lang = transcribe_google(work_path)
        if g_numbers:
            text, numbers, lang = g_text, g_numbers, g_lang
            metodo = f"google_{g_lang}"

    # Limpiar temporal
    if clean_path and os.path.exists(clean_path):
        try: os.unlink(clean_path)
        except: pass

    if not numbers:
        print(json.dumps({
            "texto": (text or "")[:200],
            "numeros": "",
            "metodo": metodo,
            "raw_text": (text or "")[:200]
        }))
        sys.exit(0)

    print(json.dumps({
        "texto": (text or "")[:200],
        "numeros": numbers,
        "metodo": metodo
    }))

if __name__ == "__main__":
    main()
