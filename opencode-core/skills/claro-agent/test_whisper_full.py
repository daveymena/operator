"""
Test: genera un tono simple y transcribe con whisper
"""
import json, sys, os, struct, wave, tempfile

def generate_test_wav():
    """Genera un WAV con un tono de 440Hz por 1 segundo"""
    sample_rate = 16000
    duration = 1
    num_samples = sample_rate * duration
    wav_path = os.path.join(tempfile.gettempdir(), "test_tone.wav")
    
    with wave.open(wav_path, 'w') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sample_rate)
        for i in range(num_samples):
            import math
            val = int(32767 * math.sin(2 * math.pi * 440 * i / sample_rate))
            f.writeframes(struct.pack('<h', val))
    
    return wav_path

if __name__ == "__main__":
    wav_path = generate_test_wav()
    print(f"Generated: {wav_path} ({os.path.getsize(wav_path)} bytes)")
    
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel("base", device="cpu", compute_type="int8")
        segments, info = model.transcribe(wav_path, beam_size=5, language="en", vad_filter=True)
        text = " ".join([s.text.strip() for s in segments])
        print(json.dumps({"texto": text, "language": info.language, "ok": True}))
    except Exception as e:
        print(json.dumps({"error": str(e), "ok": False}))
    
    # Cleanup
    os.unlink(wav_path)
