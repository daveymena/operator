import speech_recognition as sr, subprocess, os, sys

mp3 = r"C:\Users\ADMIN\Downloads\Hello-World\claro_agente_final\_captcha_1782818127647.mp3"
wav = r"C:\Users\ADMIN\Downloads\Hello-World\claro_agente_final\_test_debug.wav"
ffmpeg = r"C:\Users\ADMIN\AppData\Local\Microsoft\WinGet\Links\ffmpeg.EXE"

subprocess.run([ffmpeg, '-y', '-i', mp3, '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', wav], capture_output=True, timeout=15)
print(f"WAV: {os.path.exists(wav)} {os.path.getsize(wav) if os.path.exists(wav) else 0} bytes")

r = sr.Recognizer()
r.energy_threshold = 300
r.dynamic_energy_threshold = False
with sr.AudioFile(wav) as s:
    a = r.record(s)

for lang in ["en-US", "es-CO", "es-ES"]:
    try:
        t = r.recognize_google(a, language=lang)
        print(f"  [{lang}] {t}")
    except sr.UnknownValueError:
        print(f"  [{lang}] UnknownValue")
    except sr.RequestError as e:
        print(f"  [{lang}] RequestError: {e}")

os.unlink(wav)
