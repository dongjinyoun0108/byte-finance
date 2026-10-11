"""Byte Finance theme: an original, royalty-free 112 BPM lo-fi house loop in F major,
plus two sound effects (coin toss whoosh, coin landing chime). Fully synthesised, so it's ours to use forever.

    python3 scripts/compose-theme.py   ->  render/assets/audio/{theme.wav, whoosh.wav, ding.wav}
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
BPM = 112
BEAT = 60 / BPM
BAR = BEAT * 4
BARS = 16
N = int(BAR * BARS * SR)
rng = np.random.default_rng(7)
OUT = os.path.join(os.path.dirname(__file__), '..', 'render', 'assets', 'audio')
os.makedirs(OUT, exist_ok=True)


def hz(note):  # MIDI note -> Hz
    return 440.0 * 2 ** ((note - 69) / 12)


def filt(x, kind, f, order=2):
    sos = butter(order, f, btype=kind, fs=SR, output='sos')
    return sosfilt(sos, x)


def place(buf, sig, t):
    i = int(t * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i]


def env(n, a=0.005, d=1.0):
    t = np.arange(n) / SR
    e = np.exp(-t / d)
    na = max(1, int(a * SR))
    e[:na] *= np.linspace(0, 1, na)
    return e


# ---------------------------------------------------------------- instruments
def epiano(freq, dur, vel=1.0):
    """FM electric piano (Rhodes-ish), slightly detuned pair for warmth."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for det in (-0.0018, 0.0018):
        f = freq * (1 + det)
        idx = 1.6 * np.exp(-t / 0.35)
        mod = np.sin(2 * np.pi * f * t) * idx
        out += np.sin(2 * np.pi * f * t + mod)
        out += 0.18 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.3)  # tine
    return out * env(n, 0.004, 1.1) * vel * 0.5


def bass(freq, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * 2 * freq * t)
    s = np.tanh(1.6 * s)
    e = env(n, 0.006, dur * 0.9)
    e[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    return s * e * 0.55


def kick():
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    f = 46 + 90 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / 0.22)
    click = filt(rng.standard_normal(n), 'highpass', 3000) * np.exp(-t / 0.004) * 0.25
    return np.tanh(1.4 * (s + click)) * 0.95


def clap():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    noise = filt(rng.standard_normal(n), 'bandpass', [900, 2600])
    e = np.zeros(n)
    for k, off in enumerate((0, 0.011, 0.022)):
        i = int(off * SR)
        e[i:] += np.exp(-(t[: n - i]) / (0.008 if k < 2 else 0.11))
    return noise * e * 0.35


def hat(open_=False):
    n = int((0.22 if open_ else 0.05) * SR)
    t = np.arange(n) / SR
    s = filt(rng.standard_normal(n), 'highpass', 7500)
    return s * np.exp(-t / (0.07 if open_ else 0.012)) * (0.16 if open_ else 0.13)


def marimba(freq, vel=1.0):
    """Bright mallet pluck: the 'coin' hook."""
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.28)
    s += 0.35 * np.sin(2 * np.pi * 4 * freq * t) * np.exp(-t / 0.05)
    s += 0.12 * np.sin(2 * np.pi * 10 * freq * t) * np.exp(-t / 0.012)
    return s * env(n, 0.002, 10) * vel * 0.42


# ---------------------------------------------------------------- arrangement (F major)
# Fmaj9, Dm9, Bbmaj9, C11 (voicings around middle C)
CHORDS = [
    (41, [57, 60, 64, 67, 69]),   # F:  A C E G A
    (38, [57, 60, 64, 65, 69]),   # Dm: A C E F A
    (34, [57, 60, 62, 65, 69]),   # Bb: A C D F A
    (36, [58, 60, 62, 65, 67]),   # C11: Bb C D F G
]
# hook: 2-bar pentatonic phrase in 16ths (step index, midi note, velocity)
HOOK_A = [(0, 81, 1), (3, 77, 0.7), (6, 79, 0.8), (8, 81, 0.9), (10, 84, 1), (14, 81, 0.6),
          (16, 79, 0.9), (19, 77, 0.7), (22, 76, 0.7), (24, 77, 0.9), (28, 72, 0.6)]
HOOK_B = [(0, 81, 1), (3, 77, 0.7), (6, 79, 0.8), (8, 84, 1), (11, 86, 0.8), (14, 84, 0.7),
          (16, 81, 0.9), (20, 79, 0.7), (24, 77, 1), (27, 79, 0.6), (30, 81, 0.5)]

drums = np.zeros(N)
keys = np.zeros(N)
low = np.zeros(N)
lead = np.zeros(N)
K, C = kick(), clap()
S16 = BEAT / 4

for bar in range(BARS):
    t0 = bar * BAR
    root, voicing = CHORDS[bar % 4]
    # drums: four on the floor from bar 0, clap on 2 & 4, hats on offbeats; open hat every 2 beats
    for b in range(4):
        place(drums, K, t0 + b * BEAT)
        place(drums, hat(open_=(b % 2 == 1)), t0 + b * BEAT + BEAT / 2)
        if b in (1, 3):
            place(drums, C, t0 + b * BEAT)
    for s in range(16):  # shaker 16ths, quiet, with swing
        swing = S16 * 0.18 if s % 2 else 0
        place(drums, hat() * (0.45 if s % 4 else 0.25), t0 + s * S16 + swing)
    # keys: chord on 1 and the 'and' of 2 (syncopated house stab)
    for hit, vel, length in ((0, 1.0, BEAT * 1.4), (BEAT * 1.5, 0.75, BEAT * 1.2), (BEAT * 3, 0.55, BEAT)):
        for i, m in enumerate(voicing):
            place(keys, epiano(hz(m), length + 0.4, vel) * (0.85 if i else 1), t0 + hit + i * 0.006)
    # bass: root on 1, octave pop on 2-and, root on 3-and
    for off, m, ln in ((0, root, BEAT * 1.3), (BEAT * 1.5, root + 12, BEAT * 0.4), (BEAT * 2.5, root, BEAT * 1.2), (BEAT * 3.5, root + 7, BEAT * 0.45)):
        place(low, bass(hz(m), ln), t0 + off)
    # hook from bar 2 on, alternating phrases
    if bar >= 2 and bar % 2 == 0:
        phrase = HOOK_A if (bar // 2) % 2 else HOOK_B
        for step, m, vel in phrase:
            place(lead, marimba(hz(m), vel), t0 + step * S16)

# sidechain pump on keys/bass/lead from the kick
pump = np.ones(N)
pt = np.arange(int(BEAT * SR)) / SR
shape = 1 - 0.55 * np.exp(-pt / 0.11)
for i in range(int(BARS * 4)):
    a = int(i * BEAT * SR)
    pump[a:a + len(shape)] = shape[: max(0, min(len(shape), N - a))]

keys = filt(keys, 'lowpass', 5200) * pump
low = filt(low, 'lowpass', 900) * pump
lead = lead * (0.6 + 0.4 * pump)

# simple stereo: keys slightly wide, lead with a short ping-pong echo
def echo(x, d, fb=0.35):
    y = x.copy()
    k = int(d * SR)
    for r in range(1, 4):
        y[k * r:] += x[: -k * r] * fb ** r
    return y

lead_l = echo(lead, BEAT * 0.75, 0.3)
lead_r = echo(np.concatenate([np.zeros(int(BEAT * 0.375 * SR)), lead])[:N], BEAT * 0.75, 0.3)
L = drums * 0.9 + keys * 0.55 + low * 0.8 + lead_l * 0.6
R = drums * 0.9 + np.concatenate([np.zeros(int(0.012 * SR)), keys])[:N] * 0.55 + low * 0.8 + lead_r * 0.6
noise = filt(rng.standard_normal(N), 'bandpass', [1500, 6000]) * 0.004  # vinyl air
mix = np.stack([L + noise, R + noise], axis=1)
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.35) / np.tanh(1.35) * 0.89
wavfile.write(os.path.join(OUT, 'theme.wav'), SR, (mix * 32767).astype(np.int16))

# ---------------------------------------------------------------- sound effects
n = int(0.7 * SR); t = np.arange(n) / SR
w = filt(rng.standard_normal(n), 'bandpass', [400, 4000]) * np.sin(np.pi * t / t[-1]) ** 2
sweep = np.sin(2 * np.pi * np.cumsum(300 + 900 * t / t[-1]) / SR) * 0.08 * np.sin(np.pi * t / t[-1])
whoosh = np.tanh((w * 0.5 + sweep) * 1.5) * 0.7
wavfile.write(os.path.join(OUT, 'whoosh.wav'), SR, (np.stack([whoosh, whoosh], 1) * 32767).astype(np.int16))

n = int(1.4 * SR); t = np.arange(n) / SR
ding = np.zeros(n)
for f, a, d in ((2093, 1, 0.9), (2093 * 2.76, 0.5, 0.35), (2093 * 5.4, 0.25, 0.12), (1567, 0.45, 0.7)):
    ding += a * np.sin(2 * np.pi * f * t) * np.exp(-t / d)
ding += filt(rng.standard_normal(n), 'highpass', 6000) * np.exp(-t / 0.01) * 0.3  # metal tick
ding = ding / np.max(np.abs(ding)) * 0.6
wavfile.write(os.path.join(OUT, 'ding.wav'), SR, (np.stack([ding, ding], 1) * 32767).astype(np.int16))
print(f'theme {BARS} bars @ {BPM} BPM = {N / SR:.2f}s, bar = {BAR:.4f}s')
