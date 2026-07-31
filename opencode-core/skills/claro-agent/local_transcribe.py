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

FFMPEG = find_ffmpeg()

def clean_audio(input_path):
    clean_path = input_path + ".clean.wav"
    for attempt in range(3):
        try:
            filters = [
                "highpass=f=100,lowpass=f=4000,afftdn=nf=-30,volume=3.0,aresample=16000,dynaudnorm=g=5:f=250",
                "highpass=f=80,lowpass=f=3500,afftdn=nf=-20,volume=4.0,aresample=16000",
                "highpass=f=120,lowpass=f=3000,volume=5.0,aresample=16000,compand=0|0:1|1:-90/-60|-60/-40|-40/-30|-20/-20:6:0:0:0",
            ]
            subprocess.run([
                FFMPEG, "-y", "-i", input_path,
                "-af", filters[attempt],
                "-ac", "1", "-ar", "16000", clean_path
            ], capture_output=True, timeout=15, check=True)
            if os.path.exists(clean_path) and os.path.getsize(clean_path) > 1000:
                return clean_path
        except:
            continue
    try:
        subprocess.run([
            FFMPEG, "-y", "-i", input_path,
            "-ac", "1", "-ar", "16000", clean_path
        ], capture_output=True, timeout=10, check=True)
        return clean_path
    except:
        return None

def extract_numbers_from_text(text):
    nums = re.sub(r'[^0-9\s]', '', text).strip()
    if nums and re.search(r'[0-9]', nums):
        return nums
    # Convertir palabras numéricas SOLO si el texto es casi todo una secuencia
    # de números dictados (ej. "five two eight"). Evita falsos positivos con
    # palabras comunes ("for", "to", "ate") dentro de frases normales.
    word_map = {
        "zero":"0","oh":"0","one":"1","won":"1",
        "two":"2","to":"2","too":"2",
        "three":"3","tree":"3","free":"3",
        "four":"4","for":"4","fore":"4",
        "five":"5",
        "six":"6","sixes":"6",
        "seven":"7","sevens":"7",
        "eight":"8","ate":"8","eights":"8",
        "nine":"9","niner":"9","nein":"9",
        "ten":"10",
        "cero":"0","uno":"1","dos":"2","tres":"3","cuatro":"4",
        "cinco":"5","seis":"6","siete":"7","ocho":"8","nueve":"9","diez":"10",
    }
    lower = text.lower()
    words = re.findall(r"[a-z]+", lower)
    if not words:
        return ""
    number_words = [w for w in words if w in word_map]
    ratio = len(number_words) / len(words)
    if ratio < 0.6:
        return ""
    return " ".join(word_map[w] for w in words if w in word_map)

def transcribe_whisper(audio_path, model_size="base"):
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        configs = [
            dict(beam_size=5, language="en", vad_filter=False,
                 condition_on_previous_text=False, without_timestamps=True),
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

    clean_path = clean_audio(audio_path)
    work_path = clean_path if clean_path and os.path.exists(clean_path) else audio_path

    results = []
    modelos = ["medium", "small", "base"]

    text, numbers, lang = None, None, None

    for model_size in modelos:
        text, numbers, lang = transcribe_whisper(work_path, model_size)
        if numbers:
            print(json.dumps({
                "texto": (text or "")[:200],
                "numeros": numbers,
                "metodo": f"whisper_{model_size}"
            }))
            sys.exit(0)
        if text:
            results.append((text, numbers, f"whisper_{model_size}"))

    g_text, g_numbers, g_lang = transcribe_google(work_path)
    if g_numbers:
        print(json.dumps({
            "texto": (g_text or "")[:200],
            "numeros": g_numbers,
            "metodo": f"google_{g_lang}"
        }))
        sys.exit(0)
    if g_text:
        results.append((g_text, g_numbers, f"google_{g_lang}"))

    if clean_path and os.path.exists(clean_path):
        try: os.unlink(clean_path)
        except: pass

    if results:
        text, numbers, metodo = results[0]
        print(json.dumps({
            "texto": (text or "")[:200],
            "numeros": numbers or "",
            "metodo": metodo,
            "raw_text": (text or "")[:200]
        }))
    else:
        print(json.dumps({
            "texto": "",
            "numeros": "",
            "metodo": "none",
        }))

if __name__ == "__main__":
    main()
