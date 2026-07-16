"""Ultra-fast Google STT for reCAPTCHA audio. Converts MP3->WAV then transcribes."""
import sys, json, re, os, subprocess, tempfile, shutil

try:
    import speech_recognition as sr
except ImportError:
    print(json.dumps({"error": "no speech_recognition"}))
    sys.exit(0)

def find_ffmpeg():
    ff = shutil.which("ffmpeg")
    if ff: return ff
    for cand in [
        r"C:\Users\ADMIN\AppData\Local\Microsoft\WinGet\Links\ffmpeg.EXE",
        r"C:\ffmpeg\bin\ffmpeg.exe",
    ]:
        if os.path.exists(cand): return cand
    return "ffmpeg"

def to_wav(mp3_path):
    wav_path = mp3_path + ".stt.wav"
    ffmpeg = find_ffmpeg()
    try:
        subprocess.run(
            [ffmpeg, "-y", "-i", mp3_path, "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", wav_path],
            capture_output=True, timeout=15, check=True
        )
        return wav_path
    except Exception:
        return None

def extract_numbers(text):
    nums = re.sub(r'[^0-9\s]', '', text).strip()
    if nums and re.search(r'[0-9]', nums): return nums
    word_map = {"zero":"0","oh":"0","o":"0","one":"1","won":"1","two":"2","to":"2","too":"2",
                "three":"3","tree":"3","free":"3","four":"4","for":"4","fore":"4",
                "five":"5","fiv":"5","six":"6","sick":"6","seven":"7","sell":"8","ate":"8","eight":"8",
                "nine":"9","niner":"9","ten":"10",
                "cero":"0","uno":"1","dos":"2","tres":"3","cuatro":"4","cinco":"5",
                "seis":"6","siete":"7","ocho":"8","nueve":"9","diez":"10"}
    lower = text.lower()
    found = []
    for word, digit in word_map.items():
        if re.search(r'\b' + re.escape(word) + r'\b', lower):
            found.append(digit)
    return " ".join(found) if found else text

if len(sys.argv) < 2:
    print(json.dumps({"error": "no file arg"}))
    sys.exit(0)

audio_path = sys.argv[1]
if not os.path.exists(audio_path):
    print(json.dumps({"error": "file not found"}))
    sys.exit(0)

# Convert to WAV if needed
ext = os.path.splitext(audio_path)[1].lower()
wav_path = audio_path
cleanup = False
if ext != ".wav":
    wav_path = to_wav(audio_path)
    if not wav_path or not os.path.exists(wav_path):
        print(json.dumps({"error": "ffmpeg conversion failed"}))
        sys.exit(0)
    cleanup = True

recognizer = sr.Recognizer()
recognizer.energy_threshold = 300
recognizer.dynamic_energy_threshold = False

try:
    with sr.AudioFile(wav_path) as source:
        audio = recognizer.record(source)
except Exception as e:
    print(json.dumps({"error": "read failed: " + str(e)[:60]}))
    if cleanup and os.path.exists(wav_path): os.unlink(wav_path)
    sys.exit(0)

# Try multiple languages
for lang in ["en-US", "en-GB", "es-CO", "es-ES"]:
    try:
        text = recognizer.recognize_google(audio, language=lang)
        nums = extract_numbers(text)
        if nums and re.search(r'[0-9]', nums):
            print(json.dumps({"numeros": nums, "raw": text[:100], "lang": lang}))
            if cleanup and os.path.exists(wav_path): os.unlink(wav_path)
            sys.exit(0)
    except sr.UnknownValueError:
        continue
    except sr.RequestError:
        continue

print(json.dumps({"error": "no_numbers"}))
if cleanup and os.path.exists(wav_path): os.unlink(wav_path)
