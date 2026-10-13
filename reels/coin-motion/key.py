# Keys the magenta background out of an AI clip and packs the frames into one transparent sprite sheet.
#   python3 key.py raw/coffee.mp4 coffee 12      -> sprites/coffee.png + sprites/coffee.json
import sys, json, subprocess, os, numpy as np
from scipy import ndimage
from PIL import Image
src, name, fps = sys.argv[1], sys.argv[2], int(sys.argv[3])
DESPECKLE = '--despeckle' in sys.argv  # drop AI sparkles: keep only the character's own blob(s)
W, H = 720, 1280
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-vf', f'fps={fps}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32)
out = []
for f in frames:
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    bgness = np.minimum(r, b) - g                       # magenta: R and B high, G low
    a = 1 - np.clip((bgness - 60) / (150 - 60), 0, 1)   # soft matte
    if DESPECKLE:
        lab, n = ndimage.label(a > 0.3)
        if n:
            sizes = ndimage.sum(np.ones_like(a), lab, range(1, n + 1))
            keep = np.isin(lab, 1 + np.where(sizes >= max(1500, sizes.max() * 0.04))[0])
            keep = ndimage.binary_dilation(keep, iterations=3)
            a = a * keep
    edge = a < 0.995
    b2 = np.where(edge, np.minimum(b, g + 18), b)       # kill magenta spill on edges
    r2 = np.where(edge, np.minimum(r, np.maximum(g + 90, r * 0.92)), r)
    rgba = np.dstack([r2, g, b2, a * 255]).clip(0, 255).astype(np.uint8)
    out.append(rgba)
alpha = np.stack([o[..., 3] for o in out]).max(0)
ys, xs = np.where(alpha > 10)
pad = 8
x0, x1, y0, y1 = max(xs.min() - pad, 0), min(xs.max() + pad, W), max(ys.min() - pad, 0), min(ys.max() + pad, H)
cw, ch = x1 - x0, y1 - y0
scale = min(1, 420 / cw)
fw, fh = int(cw * scale), int(ch * scale)
cols = 10
rows = -(-len(out) // cols)
sheet = Image.new('RGBA', (cols * fw, rows * fh), (0, 0, 0, 0))
for i, o in enumerate(out):
    im = Image.fromarray(o).crop((x0, y0, x1, y1)).resize((fw, fh), Image.LANCZOS)
    sheet.paste(im, ((i % cols) * fw, (i // cols) * fh))
os.makedirs('sprites', exist_ok=True)
sheet.save(f'sprites/{name}.png', optimize=True)
# feet: lowest opaque row of frame 0, as a fraction of frame height
f0 = out[0][y0:y1, x0:x1, 3]
feet = (np.where(f0.max(1) > 40)[0].max()) / ch
json.dump({'frames': len(out), 'fps': fps, 'cols': cols, 'fw': fw, 'fh': fh, 'feet': round(float(feet), 3)}, open(f'sprites/{name}.json', 'w'))
print(name, len(out), 'frames', fw, 'x', fh, 'sheet', sheet.size, 'feet', round(float(feet), 3))
