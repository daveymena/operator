try:
    from faster_whisper import WhisperModel
    print("faster-whisper OK")
except ImportError as e:
    print("IMPORT ERROR:", e)
