"""Byte Finance music options: three more original, royalty-free beds, all 112 BPM / 16 bars (34.3s)
so the Reel's beat-locked cuts land on any of them.

    python3 scripts/compose-music.py   ->  render/assets/audio/music/{ticker,market-open,sunday-paper}.wav

  ticker        nu-disco / future-funk: octave disco bass, filtered saw stabs, bright pluck hook, riser into bar 9
  sunday-paper  half-time lo-fi hip-hop: dusty Rhodes 7ths, swung hats, round bass, vinyl crackle
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 44100
BPM = 112
BEAT = 60 / BPM
BAR = BEAT * 4
S16 = BEAT / 4
BARS = 16
N = int(BAR * BARS * SR)
OUT = os.path.join(os.path.dirname(__file__), '..', 'render', 'assets', 'audio', 'music')
os.makedirs(OUT, exist_ok=True)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), x)


def place(buf, sig, t, gain=1.0):
    i = int(round(t * SR))
    if i >= len(buf) or i < 0:
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def adsr(n, a=0.005, d=0.2, s=0.6, r=0.05):
    e = np.full(n, s, dtype=float)
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na = max(1, min(na, n)); e[:na] = np.linspace(0, 1, na)
    nd = max(1, min(nd, n - na)); e[na:na + nd] = np.linspace(1, s, nd)
    nr = max(1, min(nr, n)); e[-nr:] *= np.linspace(1, 0, nr)
    return e


def saw(f, t, rng, voices=5, spread=0.012):
    out = np.zeros_like(t)
    for v in range(voices):
        det = 1 + spread * (v - (voices - 1) / 2) / max(1, (voices - 1) / 2)
        ph = rng.random()
        out += 2 * ((f * det * t + ph) % 1) - 1
    return out / voices


def lp_sweep(x, f0, f1):
    """Crude time-varying low-pass: crossfade between a few fixed filters."""
    n = len(x)
    cuts = np.geomspace(f0, f1, 6)
    bank = [filt(x, 'lowpass', min(c, SR / 2 - 100)) for c in cuts]
    pos = np.linspace(0, len(cuts) - 1, n)
    out = np.zeros(n)
    for k in range(len(cuts)):
        w = np.clip(1 - np.abs(pos - k), 0, 1)
        out += bank[k] * w
    return out


def reverb(x, decay=1.6, mix=0.25, seed=1, tone=6000):
    rng = np.random.default_rng(seed)
    n = int(decay * 1.5 * SR)
    t = np.arange(n) / SR
    irs = []
    for s in range(2):
        ir = rng.standard_normal(n) * np.exp(-t / (decay / 6.9))
        ir = filt(ir, 'lowpass', tone)
        ir[: int(0.012 * SR)] = 0  # pre-delay
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    wet = [fftconvolve(x, ir)[: len(x)] for ir in irs]
    return np.stack([x * (1 - mix) + wet[0] * mix, x * (1 - mix) + wet[1] * mix], 1)


def pump(depth=0.6, release=0.12, every=BEAT):
    p = np.ones(N)
    pt = np.arange(int(every * SR)) / SR
    shape = 1 - depth * np.exp(-pt / release)
    for i in range(int(N / (every * SR)) + 1):
        a = int(i * every * SR)
        m = max(0, min(len(shape), N - a))
        p[a:a + m] = shape[:m]
    return p


def master(stereo, drive=1.3, target_rms=0.13):
    x = stereo - stereo.mean(0)
    x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * target_rms
    x = np.tanh(x * drive) / np.tanh(drive)
    peak = np.max(np.abs(x))
    if peak > 0.94:
        x *= 0.94 / peak
    # 30ms fade-in, 1.2s fade-out so the tail never clicks
    fi, fo = int(0.03 * SR), int(1.2 * SR)
    x[:fi] *= np.linspace(0, 1, fi)[:, None]
    x[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5
    return x


def write(name, stereo):
    wavfile.write(os.path.join(OUT, f'{name}.wav'), SR, (np.clip(stereo, -1, 1) * 32767).astype(np.int16))
    rms = 20 * np.log10(np.sqrt(np.mean(stereo ** 2)))
    print(f'{name}: {len(stereo) / SR:.2f}s, rms {rms:.1f} dBFS')


# ------------------------------------------------------------------ drums (shared)
def kick(rng, punch=90, tail=0.24, base=48):
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = base + punch * np.exp(-t / 0.03)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tail)
    click = filt(rng.standard_normal(n), 'highpass', 2500) * np.exp(-t / 0.003) * 0.3
    return np.tanh(1.6 * (s + click)) * 0.95


def snare(rng, tone=190, body=0.12, noise_d=0.16):
    n = int(0.4 * SR); t = np.arange(n) / SR
    b = np.sin(2 * np.pi * tone * t) * np.exp(-t / 0.05) * 0.5
    nz = filt(rng.standard_normal(n), 'bandpass', [1200, 8000]) * np.exp(-t / noise_d) * 0.55
    return (b + nz) * 0.8


def clap(rng):
    n = int(0.35 * SR); t = np.arange(n) / SR
    nz = filt(rng.standard_normal(n), 'bandpass', [900, 3000])
    e = np.zeros(n)
    for k, off in enumerate((0, 0.009, 0.019, 0.028)):
        i = int(off * SR); e[i:] += np.exp(-t[: n - i] / (0.006 if k < 3 else 0.14))
    return nz * e * 0.4


def hat(rng, open_=False, dark=False):
    n = int((0.28 if open_ else 0.06) * SR); t = np.arange(n) / SR
    s = filt(rng.standard_normal(n), 'highpass', 6000 if dark else 8000)
    if dark:
        s = filt(s, 'lowpass', 9000)
    return s * np.exp(-t / (0.09 if open_ else 0.014)) * (0.2 if open_ else 0.16)


def riser(rng, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    nz = rng.standard_normal(n)
    out = lp_sweep(filt(nz, 'highpass', 300), 400, 12000) * (t / dur) ** 2
    return out * 0.3


def crash(rng):
    n = int(2.2 * SR); t = np.arange(n) / SR
    return filt(rng.standard_normal(n), 'highpass', 4000) * np.exp(-t / 0.6) * 0.22


# ================================================================== 1. TICKER (nu-disco)
def ticker():
    rng = np.random.default_rng(11)
    # A minor / C major: Am9 - Fmaj7 - C/E - G6  (vi IV I V, bright and moving)
    prog = [(45, [64, 67, 71, 72, 76]), (41, [64, 65, 69, 72, 76]), (40, [64, 67, 72, 76, 79]), (43, [62, 67, 71, 74, 76])]
    drums, bassb, stabs, lead, fx = (np.zeros(N) for _ in range(5))
    K, CL = kick(rng, punch=110, tail=0.2), clap(rng)
    for bar in range(BARS):
        t0 = bar * BAR
        root, chord = prog[bar % 4]
        intro = bar < 1
        for b in range(4):
            if not intro:
                place(drums, K, t0 + b * BEAT)
            if b in (1, 3) and not intro:
                place(drums, CL, t0 + b * BEAT)
            place(drums, hat(rng, open_=True), t0 + b * BEAT + BEAT / 2, 0.9)
        for s in range(16):
            place(drums, hat(rng), t0 + s * S16 + (S16 * 0.08 if s % 2 else 0), 0.55 if s % 4 else 0.35)
        # disco octave bass: 8ths bouncing root/octave
        for e in range(8):
            m = root + (12 if e % 2 else 0)
            if e == 7:
                m = root + 10
            n = int(BEAT / 2 * 0.85 * SR); t = np.arange(n) / SR
            tone = np.tanh(2.2 * (np.sin(2 * np.pi * hz(m - 12) * t) + 0.4 * saw(hz(m - 12), t, rng, 1)))
            place(bassb, tone * adsr(n, 0.003, 0.08, 0.7, 0.02) * 0.6, t0 + e * BEAT / 2)
        # saw stabs on the offbeats (classic filtered disco chord)
        for hit in (BEAT * 0.5, BEAT * 1.5, BEAT * 2.25, BEAT * 3.5):
            n = int(0.22 * SR); t = np.arange(n) / SR
            ch = sum(saw(hz(m), t, rng, 3, 0.008) for m in chord) / len(chord)
            ch = filt(ch, 'lowpass', 2600) * adsr(n, 0.002, 0.12, 0.25, 0.04)
            place(stabs, ch * 0.9, t0 + hit)
        # pluck hook from bar 2; answers every other bar
        if bar >= 2:
            phrase = [(0, 76), (2, 79), (4, 81), (7, 79), (8, 76), (10, 74), (12, 76)] if bar % 2 == 0 else [(0, 72), (3, 74), (6, 76), (10, 79), (12, 81), (14, 84)]
            for step, m in phrase:
                n = int(0.3 * SR); t = np.arange(n) / SR
                p = saw(hz(m), t, rng, 2, 0.004) * np.exp(-t / 0.09) + 0.5 * np.sin(2 * np.pi * hz(m) * t) * np.exp(-t / 0.18)
                place(lead, filt(p, 'lowpass', 5000) * 0.5, t0 + step * S16)
    place(fx, riser(rng, BAR * 2), BAR * 7)   # builds through story 2 ...
    place(fx, crash(rng), BAR * 9)            # ... and crashes on the cut into story 3 (beat 36)
    pm = pump(0.6, 0.1)
    bassb = filt(bassb, 'lowpass', 1100) * pm
    stabs = stabs * pm
    st = reverb(stabs, 1.2, 0.22, 2)
    ld = reverb(lead * (0.7 + 0.3 * pm), 1.6, 0.3, 3)
    dr = np.stack([drums, drums], 1)
    mix = dr * 0.85 + np.stack([bassb, bassb], 1) * 0.8 + st * 0.55 + ld * 0.5 + np.stack([fx, fx[::-1] * 0 + fx], 1) * 0.6
    return master(mix, 1.4)


# ================================================================== 2. MARKET OPEN (news intro energy)
def market_open():
    rng = np.random.default_rng(23)
    # D minor: Dm - Bb - F - C (i VI III VII), urgent but positive
    prog = [(38, [62, 65, 69]), (34, [62, 65, 70]), (41, [60, 65, 69]), (36, [60, 64, 67])]
    drums, sub, arp, pad, hits, fx = (np.zeros(N) for _ in range(6))
    K = kick(rng, punch=70, tail=0.3, base=44)
    SN = snare(rng, 210, noise_d=0.1)
    for bar in range(BARS):
        t0 = bar * BAR
        root, chord = prog[bar % 4]
        # drums: kick on 1 and 3 (+ 4-and pickup), snare on 2 & 4 from bar 2, 16th ticks like a clock
        for b, v in ((0, 1), (2, 1), (3.5, 0.6)):
            place(drums, K, t0 + b * BEAT, v)
        if bar >= 2:
            for b in (1, 3):
                place(drums, SN, t0 + b * BEAT, 0.8)
        for s in range(16):
            place(drums, hat(rng, dark=True), t0 + s * S16, 0.6 if s % 4 == 0 else 0.32)
        # low cinematic hit on every 2nd bar
        if bar % 2 == 0:
            n = int(1.2 * SR); t = np.arange(n) / SR
            boom = np.sin(2 * np.pi * (38 + 30 * np.exp(-t / 0.08)) * t) * np.exp(-t / 0.45)
            boom += filt(rng.standard_normal(n), 'lowpass', 900) * np.exp(-t / 0.15) * 0.4
            place(hits, boom * 0.7, t0)
        # sub pulse on 8ths
        for e in range(8):
            n = int(BEAT / 2 * 0.9 * SR); t = np.arange(n) / SR
            place(sub, np.sin(2 * np.pi * hz(root - 12) * t) * adsr(n, 0.004, 0.1, 0.8, 0.03) * 0.55, t0 + e * BEAT / 2)
        # 16th arpeggio across the chord (up-down), brightness opens over the whole track
        notes = chord + [chord[0] + 12, chord[1] + 12] + [chord[2], chord[1]]
        for s in range(16):
            m = notes[s % len(notes)] + 12
            n = int(S16 * 1.6 * SR); t = np.arange(n) / SR
            tone = saw(hz(m), t, rng, 2, 0.006) * 0.6 + 0.4 * np.sign(np.sin(2 * np.pi * hz(m) * t)) * 0.5
            place(arp, tone * np.exp(-t / 0.07) * (1 if s % 4 == 0 else 0.7) * 0.35, t0 + s * S16)
        # string pad
        n = int(BAR * SR); t = np.arange(n) / SR
        p = sum(saw(hz(m), t, rng, 5, 0.01) for m in chord + [chord[0] - 12]) / 4
        place(pad, filt(p, 'lowpass', 1800) * adsr(n, 0.25, 0.4, 0.8, 0.3) * 0.45, t0)
    arp = lp_sweep(arp, 900, 9000)
    place(fx, riser(rng, BAR * 2), BAR * 7)   # builds through story 2 ...
    place(fx, crash(rng), BAR * 9)            # ... and crashes on the cut into story 3 (beat 36)
    pm = pump(0.35, 0.12, BEAT * 2)
    mix = (np.stack([drums, drums], 1) * 0.8 + np.stack([sub, sub], 1) * 0.75 + np.stack([hits, hits], 1) * 0.8
           + reverb(arp * pm, 1.4, 0.3, 4) * 0.55 + reverb(pad * pm, 2.4, 0.4, 5) * 0.6 + np.stack([fx, fx], 1) * 0.5)
    return master(mix, 1.35)


# ================================================================== 3. SUNDAY PAPER (lo-fi hip-hop, half-time)
def sunday_paper():
    rng = np.random.default_rng(31)
    # Eb major 7ths: Ebmaj7 - Cm9 - Fm9 - Bb13 (warm ii-V turnaround)
    prog = [(39, [55, 58, 62, 67]), (36, [55, 58, 62, 63]), (41, [56, 60, 63, 67]), (34, [56, 60, 62, 67])]
    drums, keys, bassb, bell = (np.zeros(N) for _ in range(4))
    K = kick(rng, punch=60, tail=0.28, base=50)
    SN = snare(rng, 180, noise_d=0.2)
    swing = S16 * 0.32
    for bar in range(BARS):
        t0 = bar * BAR
        root, chord = prog[bar % 4]
        # half-time: kick on 1 and the 'and' of 2 (+ ghost), snare on 3
        for b, v in ((0, 1), (1.5, 0.8), (3.75, 0.45)):
            place(drums, K, t0 + b * BEAT, v)
        place(drums, SN, t0 + 2 * BEAT, 0.9)
        for e in range(8):  # swung 8th hats
            place(drums, hat(rng, dark=True), t0 + e * BEAT / 2 + (swing if e % 2 else 0), 0.75 if e % 2 == 0 else 0.45)
        # dusty Rhodes: chord on 1, a softer re-hit on 3-and, with tape wobble
        for hit, vel, ln in ((0, 1, BEAT * 2.4), (BEAT * 2.5 + swing, 0.6, BEAT * 1.4)):
            n = int((ln + 0.6) * SR); t = np.arange(n) / SR
            wob = 1 + 0.0025 * np.sin(2 * np.pi * 0.7 * (t + bar))
            c = np.zeros(n)
            for i, m in enumerate(chord):
                f = hz(m) * wob
                mod = np.sin(2 * np.pi * np.cumsum(f) / SR) * 1.2 * np.exp(-t / 0.4)
                c += np.sin(2 * np.pi * np.cumsum(f) / SR + mod) * (0.9 if i else 1)
            place(keys, c * adsr(n, 0.006, 0.6, 0.55, 0.4) * vel * 0.22, t0 + hit + 0.01)
        # round bass: root, fifth, approach note
        for off, m, ln in ((0, root, BEAT * 1.4), (BEAT * 1.5, root + 7, BEAT * 0.9), (BEAT * 3 + swing, root + 10, BEAT * 0.8)):
            n = int(ln * SR); t = np.arange(n) / SR
            place(bassb, np.tanh(1.3 * np.sin(2 * np.pi * hz(m - 12) * t)) * adsr(n, 0.01, 0.3, 0.7, 0.06) * 0.6, t0 + off)
        # sparse bell motif every 2 bars from bar 4
        if bar >= 4 and bar % 2 == 0:
            for step, m in ((0, 79), (6, 77), (10, 75), (14, 74)):
                n = int(1.0 * SR); t = np.arange(n) / SR
                b = np.sin(2 * np.pi * hz(m) * t) * np.exp(-t / 0.5) + 0.3 * np.sin(2 * np.pi * hz(m) * 3.01 * t) * np.exp(-t / 0.15)
                place(bell, b * 0.25, t0 + step * S16 + (swing if step % 2 else 0))
    drums = filt(drums, 'lowpass', 9000)
    keys = filt(keys, 'lowpass', 3800)
    crackle = np.zeros(N)
    pops = rng.random(N) < 0.00025
    crackle[pops] = rng.standard_normal(pops.sum()) * 0.5
    crackle = filt(crackle, 'highpass', 1500) + filt(rng.standard_normal(N), 'bandpass', [2000, 7000]) * 0.006
    mix = (np.stack([drums, drums], 1) * 0.85 + reverb(keys, 1.8, 0.28, 6) * 0.75 + np.stack([bassb, bassb], 1) * 0.75
           + reverb(bell, 2.2, 0.4, 7) * 0.5 + np.stack([crackle, crackle], 1) * 0.5)
    return master(mix, 1.2, 0.13)


if __name__ == '__main__':
    write('ticker', ticker())
    write('sunday-paper', sunday_paper())
