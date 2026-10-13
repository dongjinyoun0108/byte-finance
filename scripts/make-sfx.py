# Trims, fades and levels the chosen ElevenLabs takes (render/assets/audio/sfx-raw) into render/assets/audio/sfx/*.wav.
# Run from render/assets/audio:  python3 ../../../scripts/make-sfx.py
import subprocess, numpy as np, wave, os
SR = 48000
picks = {  # name: (take, start, dur, fade_in, fade_out, peak_dbfs)
  'whoosh': ('whoosh4.mp3', 0.12, 0.62, 0.02, 0.18, -4),
  'pop':    ('pop4.mp3',    0.06, 0.30, 0.003, 0.12, -4),
  'coin':   ('coin2.mp3',   0.03, 0.45, 0.003, 0.20, -5),
  'tick':   ('tick3.mp3',   0.00, 1.00, 0.005, 0.25, -6),
  'chime':  ('chime2.mp3',  0.00, 0.90, 0.003, 0.40, -4),
  'draw':   ('draw4.mp3',   0.05, 0.55, 0.06, 0.20, -6),
  'slide':  ('slide2.mp3',  0.00, 0.70, 0.03, 0.15, -5),
}
os.makedirs('sfx', exist_ok=True)
for name, (src, st, dur, fi, fo, pk) in picks.items():
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', 'sfx-raw/' + src, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).reshape(-1, 2).copy()
    x = x[int(st * SR):int((st + dur) * SR)]
    x -= x.mean(0)
    n = len(x); t = np.arange(n) / SR
    g = np.minimum(1, t / fi) * np.clip((n / SR - t) / fo, 0, 1)
    x *= g[:, None] ** 1.5
    x *= 10 ** (pk / 20) / np.abs(x).max()
    with wave.open(f'sfx/{name}.wav', 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype('<i2').tobytes())
    print(name, f'{n / SR:.2f}s')
