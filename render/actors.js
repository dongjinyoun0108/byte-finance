// Signature moves: every coin pose has its own entrance + action, plus props/particles that belong to it
// (steam for coffee, exhaust for the rocket, dust for kangaroo hops...). Pure functions of time t, like
// runtime.js, so video frames are deterministic and seek(999, true) gives the resting still.
(function () {
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const E = {
    out: (p) => 1 - Math.pow(1 - p, 3),
    out2: (p) => 1 - (1 - p) * (1 - p),
    in2: (p) => p * p,
    expo: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    spring: (p, s = 9, d = 5.5) => (p >= 1 ? 1 : 1 - Math.exp(-d * p) * Math.cos(s * p)),
  };
  const win = (u, a, b) => clamp((u - a) / (b - a));
  const bump = (u, a, b) => { const q = win(u, a, b); return q > 0 && q < 1 ? Math.sin(q * Math.PI) : 0; };
  const S = (o = {}) => Object.assign({ x: 0, y: 0, r: 0, sx: 1, sy: 1, o: 1, frame: 0 }, o);
  // shared entrance: springs up out of the pedestal
  const popIn = (u, d = 0.5) => {
    const q = win(u, 0, d); const e = E.spring(q, 10, 6);
    return { y: (1 - e) * 140, sx: 0.55 + 0.45 * e, sy: 0.55 + 0.45 * e, o: clamp(q * 5) };
  };
  const add = (a, b) => S({ x: (a.x || 0) + (b.x || 0), y: (a.y || 0) + (b.y || 0), r: (a.r || 0) + (b.r || 0),
    sx: (a.sx ?? 1) * (b.sx ?? 1), sy: (a.sy ?? 1) * (b.sy ?? 1), o: (a.o ?? 1) * (b.o ?? 1), frame: a.frame || b.frame || 0 });

  function strike(u, t0) { // bat/racket swing about the feet: wind up, whip through, recover
    const wind = E.inOut(win(u, t0, t0 + 0.25)) * 14;
    const hit = E.out(win(u, t0 + 0.25, t0 + 0.37)) * -36;
    const back = E.spring(win(u, t0 + 0.37, t0 + 0.95), 8, 5) * 22;
    return wind + hit + back;
  }

  // ---------------------------------------------------------------- moves (u = seconds since the move started)
  const ACT = {
    coffee: { dur: 2.6, fn(u, live) {
      const s0 = live ? 0.35 : 0.55; const v = u - s0;
      const k = E.inOut(win(v, 0, 0.3)) * (1 - E.inOut(win(v, 1.3, 1.6)));
      const gulp = v > 0.4 && v < 1.25 ? Math.sin((v - 0.4) * 13) * 3 * k : 0;
      const ahh = bump(v, 1.6, 1.95);
      const m = S({ r: -6 * k, y: -14 * k + gulp, sx: 1 + 0.045 * ahh, sy: 1 - 0.06 * ahh, frame: clamp((v - 0.22) / 0.07) * (1 - clamp((v - 1.36) / 0.07)) });
      return live ? m : add(popIn(u), m);
    } },
    rocket: { dur: 1.8, fn(u) {
      // curved fly-in from bottom left along a bezier, nose follows the path, overshoot then thrust down to hover
      const q = E.out2(win(u, 0, 1.05));
      const P = [[-1150, 900], [-560, 380], [-170, -40], [0, -190]];
      const b = (i) => { const m = 1 - q; return m * m * m * P[0][i] + 3 * m * m * q * P[1][i] + 3 * m * q * q * P[2][i] + q * q * q * P[3][i]; };
      const db = (i) => { const m = 1 - q; return 3 * m * m * (P[1][i] - P[0][i]) + 6 * m * q * (P[2][i] - P[1][i]) + 3 * q * q * (P[3][i] - P[2][i]); };
      const bank = Math.max(-28, Math.min(28, (Math.atan2(db(1), db(0)) * 180) / Math.PI + 38));
      const settle = E.spring(win(u, 0.95, 1.8), 7, 4.5);
      const rumble = Math.sin(u * 53) * 2.2 + Math.sin(u * 31) * 1.4;
      return S({ x: b(0) + rumble, y: lerp(b(1), -36, settle), r: bank * (1 - E.out(win(u, 0.9, 1.4))), o: 1 });
    } },
    kangaroo: { dur: 1.45, fn(u) {
      const hops = [[0, 0.36, 620, 400, 240], [0.44, 0.78, 400, 170, 185], [0.86, 1.16, 170, 0, 125]];
      let x = 0, y = 0, r = 0, sq = 0;
      for (const [a, b, x0, x1, h] of hops) {
        if (u < a) { x = x0; break; }
        if (u <= b) { const q = (u - a) / (b - a); x = lerp(x0, x1, q); y = -Math.sin(q * Math.PI) * h; r = 10 * Math.cos(q * Math.PI); break; }
        x = x1; sq = bump(u, b, b + 0.12);
      }
      if (u > 1.16) sq = bump(u, 1.16, 1.4);
      return S({ x, y, r, sx: 1 + 0.09 * sq, sy: 1 - 0.13 * sq });
    } },
    surfing: { dur: 1.6, fn(u) {
      const e = E.expo(win(u, 0, 1.35));
      const carve = 1 - e;
      return S({ x: -1150 * (1 - e), y: Math.sin(u * 7.5) * 34 * carve - 30 * carve, r: Math.cos(u * 7.5) * 11 * carve });
    } },
    bbq: { dur: 2.2, fn(u) {
      return add(popIn(u), { r: -5 * bump(u, 0.6, 0.85), y: -6 * bump(u, 0.6, 0.85) });
    } },
    cricket: { dur: 1.8, fn(u) { return add(popIn(u), { r: strike(u, 0.55) }); } },
    padel: { dur: 1.8, fn(u) { return add(popIn(u), { r: -strike(u, 0.55) * 0.8 }); } },
    umbrella: { dur: 2.1, origin: '50% 12%', fn(u) {
      // floats down Mary Poppins style, swinging under the umbrella
      const e = E.out(win(u, 0, 1.8)); const sway = 1 - e;
      const land = bump(u, 1.75, 2.05);
      return S({ y: -1200 * (1 - e), x: Math.sin(u * 3.6) * 80 * sway, r: -Math.sin(u * 3.6 + 0.5) * 13 * sway, sx: 1 + 0.03 * land, sy: 1 - 0.04 * land });
    } },
    thinking: { dur: 1.6, fn(u) {
      const tilt = E.inOut(win(u, 0.55, 1.05));
      return add(popIn(u), { r: -5 * tilt, y: -4 * bump(u, 1.1, 1.3) });
    } },
    trading_desk: { dur: 1.0, fn(u) {
      const q = win(u, 0, 0.8); const e = E.spring(q, 8, 5.5);
      return S({ y: (1 - e) * 420, o: clamp(q * 4) });
    } },
    run_club: { dur: 1.35, fn(u) {
      const e = E.out(win(u, 0, 1.05)); const sp = 1 - e;
      const skid = bump(u, 1.0, 1.3);
      return S({ x: -1150 * (1 - e), y: -Math.abs(Math.sin(u * Math.PI * 6.5)) * 34 * sp, r: 8 * sp - 4 * skid, sx: 1 + 0.05 * skid, sy: 1 - 0.07 * skid });
    } },
    cbd_strut: { dur: 1.5, fn(u) {
      const e = E.out(win(u, 0, 1.35)); const w = 1 - e;
      return S({ x: 950 * w, y: -Math.abs(Math.sin(u * Math.PI * 4.4)) * 24 * w, r: Math.sin(u * Math.PI * 4.4) * 4.5 * w - 3 * bump(u, 1.3, 1.5) });
    } },
    performative: { dur: 2.0, fn(u) {
      const e = E.out(win(u, 0, 1.3)); const w = 1 - e;
      return S({ x: 900 * w, y: -Math.abs(Math.sin(u * Math.PI * 3.6)) * 18 * w, r: Math.sin(u * Math.PI * 3.6) * 7 * w - 7 * bump(u, 1.35, 1.75) });
    } },
    quarter_zip: { dur: 1.9, fn(u) {
      const e = E.spring(win(u, 0, 0.85), 8, 5);
      const pose = bump(u, 0.95, 1.25);
      return S({ x: -950 * (1 - e), r: (1 - e) * -10, sx: 1 + 0.06 * pose, sy: 1 + 0.06 * pose });
    } },
    wipeout: { dur: 1.7, fn(u) {
      const e = E.out(win(u, 0, 1.4)); const w = 1 - e;
      return S({ x: 950 * w, r: 420 * w, y: -Math.abs(Math.sin(e * Math.PI * 2.5)) * 170 * w });
    } },
    celebrating: { dur: 1.45, fn(u) {
      let y;
      if (u < 0.55) y = lerp(760, -270, E.out(u / 0.55));
      else if (u < 0.95) y = lerp(-270, 0, E.in2((u - 0.55) / 0.4));
      else y = 0;
      const sq = bump(u, 0.95, 1.3);
      return S({ y, sx: 1 + 0.1 * sq, sy: 1 - 0.14 * sq, r: u < 0.95 ? Math.sin(u * 9) * 6 : 0 });
    } },
    shocked: { dur: 1.3, fn(u) {
      const q = win(u, 0, 0.35); const e = E.spring(q, 13, 6);
      const shake = u > 0.32 && u < 1.15 ? Math.sin(u * 72) * 15 * (1 - win(u, 0.32, 1.15)) : 0;
      return S({ sx: 0.3 + 0.7 * e, sy: 0.3 + 0.7 * e, o: clamp(q * 6), x: shake, y: (1 - e) * 60 });
    } },
    worried: { dur: 2.0, fn(u) {
      let x;
      if (u < 0.5) x = lerp(950, 250, E.out(u / 0.5));
      else if (u < 0.85) x = 250 + Math.sin(u * 60) * 3;
      else if (u < 1.05) x = lerp(250, 380, E.out((u - 0.85) / 0.2));
      else x = lerp(380, 0, E.inOut(win(u, 1.05, 1.85)));
      return S({ x, r: u < 1.85 ? Math.sin(u * 11) * 2.5 : 0 });
    } },
    finger_gun: { dur: 1.7, fn(u) {
      const e = E.spring(win(u, 0, 0.7), 8, 5);
      const kick = bump(u, 0.85, 1.02) + bump(u, 1.2, 1.37);
      return S({ x: -950 * (1 - e) - 12 * kick, r: -8 * kick });
    } },
    newspaper: { dur: 1.6, fn(u) {
      const q = win(u, 0, 0.75); const e = E.spring(q, 8, 5.5);
      const rustle = bump(u, 0.8, 1.35);
      return S({ y: (1 - e) * 420 + 7 * bump(u, 1.35, 1.6), o: clamp(q * 4), sx: 1 + Math.sin(u * 58) * 0.03 * rustle });
    } },
  };

  // ---------------------------------------------------------------- particle shapes
  const star = (c) => `<svg viewBox="0 0 64 64" width="100%" height="100%"><path d="M32 2 C35 22 42 29 62 32 C42 35 35 42 32 62 C29 42 22 35 2 32 C22 29 29 22 32 2Z" fill="${c}"/></svg>`;
  const SHAPES = {
    puff: (c) => `<div style="width:100%;height:100%;border-radius:50%;background:radial-gradient(circle at 40% 38%, ${c} 0%, ${c} 52%, transparent 72%)"></div>`,
    disc: (c) => `<div style="width:100%;height:100%;border-radius:50%;background:${c}"></div>`,
    bar: (c) => `<div style="width:100%;height:100%;border-radius:99px;background:${c}"></div>`,
    rect: (c) => `<div style="width:100%;height:100%;border-radius:3px;background:${c}"></div>`,
    star,
    drop: (c) => `<svg viewBox="0 0 40 56" width="100%" height="100%"><path d="M20 2 C26 16 38 26 38 37 A18 18 0 0 1 2 37 C2 26 14 16 20 2Z" fill="${c}"/><ellipse cx="14" cy="36" rx="4" ry="7" fill="#fff" opacity=".7"/></svg>`,
    sausage: () => `<svg viewBox="0 0 120 44" width="100%" height="100%"><rect x="2" y="4" width="116" height="36" rx="18" fill="#8E3B1E"/><rect x="14" y="10" width="76" height="8" rx="4" fill="#C2653D" opacity=".8"/><path d="M38 6 l-6 32 M64 6 l-6 32" stroke="#5E2410" stroke-width="4" opacity=".55"/></svg>`,
    ball: (c) => `<svg viewBox="0 0 40 40" width="100%" height="100%"><circle cx="20" cy="20" r="18" fill="${c}"/><path d="M8 9 C16 16 16 24 8 31 M32 9 C24 16 24 24 32 31" stroke="rgba(255,255,255,.75)" stroke-width="2.4" fill="none"/></svg>`,
    candle: (c) => `<svg viewBox="0 0 24 80" width="100%" height="100%"><rect x="10.5" y="0" width="3" height="80" rx="1.5" fill="${c}"/><rect x="2" y="16" width="20" height="46" rx="4" fill="${c}"/></svg>`,
    bubble: () => `<div style="width:100%;height:100%;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-family:Bricolage,sans-serif;font-weight:800;color:#17181C;font-size:62%;line-height:1">$</div>`,
    text: (c, txt) => `<div style="font-family:Bricolage,sans-serif;font-weight:800;font-stretch:85%;color:${c};font-size:100%;line-height:1;white-space:nowrap;letter-spacing:-.02em">${txt}</div>`,
    flash: () => `<div style="width:100%;height:100%;border-radius:50%;background:radial-gradient(circle, #fff 0%, #fff 22%, rgba(255,255,255,.5) 40%, transparent 70%)"></div>`,
    wave: (c) => `<svg viewBox="0 0 900 260" width="100%" height="100%"><path d="M0 260 L0 150 C120 90 220 40 360 30 C520 18 640 70 700 150 C650 120 590 110 560 130 C640 160 720 210 900 220 L900 260Z" fill="${c}"/><path d="M360 30 C520 18 640 70 700 150 C650 120 590 110 560 130" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round"/><path d="M0 170 C150 120 260 90 380 92" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="8" stroke-linecap="round"/></svg>`,
  };

  // seeded random so every render is identical
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  // ---------------------------------------------------------------- effects per pose
  // c: { W, local(fx, fy, t, still), at, rnd, add(spec), ink, deep, shadowTop }
  // spec.upd(t, still) -> { x, y, s?, r?, o } in page coords (centre of particle), or null to hide
  const FX = {
    coffee(c) { // steam curls up from the cup; it stays on the still
      for (let i = 0; i < 9; i++) {
        const ph = i / 9, side = (i % 3) - 1;
        c.add({ shape: 'puff', color: '#FFFFFF', w: 0.07 * c.W, z: 6, upd(t, still) {
          const a = still ? (ph * 1.0) % 1 : ((t * 0.55 + ph) % 1);
          const p = c.local(0.17 + side * 0.012, 0.36, t, still);
          return { x: p.x + Math.sin(a * 6 + i) * 18 + side * 10, y: p.y - a * 0.28 * c.W, s: 0.5 + a * 1.3, o: Math.sin(a * Math.PI) * 0.75 * c.appear(t, still) };
        } });
      }
      for (let i = 0; i < 3; i++) c.pop(1.75 + i * 0.08, 0.62 + i * 0.13, -0.04 - (i % 2) * 0.06, 0.05 * c.W, '#FFFFFF');
    },
    rocket(c) { // exhaust trail sampled from the nozzle at spawn time, then a gentle idle burn
      for (let i = 0; i < 90; i++) {
        const t0 = c.at + (i < 60 ? i * 0.03 : 1.8 + (i - 60) * 0.085);
        const r1 = c.rnd(), r2 = c.rnd();
        const col = i % 4 === 0 ? '#F7B267' : i % 4 === 1 ? '#FFE7C2' : '#FFFFFF';
        c.add({ shape: 'puff', color: col, w: 0.09 * c.W, z: 4, upd(t, still) {
          if (still) return null;
          const age = t - t0; const life = 0.75;
          if (age < 0 || age > life) return null;
          const p0 = c.local(0.27, 0.9, t0, false);
          const q = age / life;
          return { x: p0.x - 120 * q - r1 * 50 * q, y: p0.y + 90 * q + r2 * 40 * q, s: 0.4 + q * 2.1, o: (1 - q) * 0.9 };
        } });
      }
    },
    kangaroo(c) { [0.36, 0.78, 1.16].forEach((t) => c.dust(t, 0.48, 0.92, 7)); },
    surfing(c) {
      c.add({ shape: 'wave', color: '#9CD3E4', w: 1.5 * c.W, h: 0.43 * c.W, z: 4, upd(t, still) {
        if (still) return null;
        const u = t - c.at;
        const p = c.local(0.5, 0.95, t, false);
        const sink = E.inOut(win(u, 1.0, 1.6));
        return { x: p.x - 0.25 * c.W, y: p.y + 0.12 * c.W + sink * 0.5 * c.W, o: 1 - sink };
      } });
      for (let i = 0; i < 40; i++) {
        const t0 = c.at + i * 0.03, a = c.rnd(), b = c.rnd();
        c.add({ shape: 'drop', color: '#FFFFFF', w: 0.03 * c.W, h: 0.042 * c.W, z: 6, upd(t, still) {
          const age = t - t0; if (still || age < 0 || age > 0.6) return null;
          const p0 = c.local(0.2, 0.9, t0, false);
          return { x: p0.x - (80 + a * 140) * age * 2, y: p0.y - (300 + b * 250) * age + 900 * age * age, o: 1 - age / 0.6, r: -40 };
        } });
      }
    },
    bbq(c) {
      // smoke from the grill (also on the still), then the snag flip
      for (let i = 0; i < 8; i++) {
        const ph = i / 8;
        c.add({ shape: 'puff', color: '#FFFFFF', w: 0.1 * c.W, z: 6, upd(t, still) {
          const a = still ? (ph * 0.9 + 0.1) % 1 : ((t * 0.5 + ph) % 1);
          const p = c.local(0.24 + (i % 2) * 0.06, 0.52, t, still);
          return { x: p.x + a * 50 + Math.sin(a * 5 + i) * 14, y: p.y - a * 0.4 * c.W, s: 0.5 + a * 1.6, o: Math.sin(a * Math.PI) * 0.6 * c.appear(t, still) };
        } });
      }
      const t0 = c.at + 0.66, T = 0.75;
      c.add({ shape: 'sausage', w: 0.13 * c.W, h: 0.048 * c.W, z: 6, upd(t, still) {
        if (still) return null;
        const q = (t - t0) / T; if (q < 0 || q > 1) return null;
        const p = c.local(0.27, 0.52, t0, false);
        return { x: p.x + 30 * q, y: p.y - Math.sin(q * Math.PI) * 0.34 * c.W, r: -q * 540, o: q > 0.94 ? (1 - q) / 0.06 : 1 };
      } });
      for (let i = 0; i < 6; i++) c.spark(0.66 + i * 0.04, 0.27, 0.54, 22, '#F2A541', c.rnd() * 6.28);
    },
    cricket(c) { c.hitBall(0.72, 0.16, '#B8242B', 0.55 + 0.33); },
    padel(c) { c.hitBall(0.68, 0.33, '#D9EA4E', 0.55 + 0.33); },
    umbrella(c) {
      for (let i = 0; i < 26; i++) {
        const fx = -0.25 + c.rnd() * 1.5, ph = c.rnd();
        c.add({ shape: 'bar', color: 'rgba(23,24,28,.22)', w: 5, h: 0.09 * c.W, z: 4, upd(t, still) {
          const a = still ? ph : ((t * 1.3 + ph) % 1);
          return { x: c.L + fx * c.W - a * 40, y: c.T - 0.5 * c.W + a * 1.4 * c.W, r: 12, o: clamp((t - c.at + 1) * 2) * (still ? 0.8 : 1) };
        } });
      }
    },
    thinking(c) {
      const spots = [[0.86, 0.08, 0.035, 0.7], [0.84, -0.03, 0.05, 0.85], [0.7, -0.16, 0.2, 1.0]];
      spots.forEach(([fx, fy, sz, t1], i) => c.add({ shape: i === 2 ? 'bubble' : 'disc', color: '#FFFFFF', w: sz * c.W, z: 6, upd(t, still) {
        const e = still ? 1 : E.spring(win(t - c.at, t1, t1 + 0.4), 11, 5.5);
        const p = c.local(fx, fy, t, still);
        return { x: p.x, y: p.y + (still ? 0 : Math.sin(t * 2.4 + i) * 5), s: Math.max(0, e), o: e > 0 ? 1 : 0 };
      } }));
    },
    trading_desk(c) {
      const xs = [0.18, 0.5, 0.82];
      for (let i = 0; i < 10; i++) {
        const t0 = 0.75 + i * 0.32, up = c.rnd() > 0.3, fx = xs[i % 3], h = 0.6 + c.rnd() * 0.7;
        c.add({ shape: 'candle', color: up ? '#2E9E5B' : '#D2504A', w: 0.055 * c.W, h: 0.17 * c.W * h, z: 6, upd(t, still) {
          if (still) { if (i > 2) return null; const p = c.local(fx, 0.2, t, true); return { x: p.x, y: p.y - i * 8, o: 1 }; }
          const age = t - c.at - t0; if (age < 0 || age > 1.1) return null;
          const p = c.local(fx, 0.28, t, false);
          const e = E.spring(clamp(age / 0.35), 11, 6);
          return { x: p.x, y: p.y - age * 110, s: e, o: 1 - clamp((age - 0.6) / 0.5) };
        } });
      }
    },
    run_club(c) { c.speedLines(1.05); c.dust(1.0, 0.45, 0.95, 6); },
    cbd_strut(c) { c.speedLines(1.3, true); c.pop(1.35, 0.95, 0.05, 0.07 * c.W, '#17181C'); c.pop(1.45, 1.03, 0.2, 0.045 * c.W, '#FFFFFF'); },
    performative(c) {
      c.speedLines(1.3, true);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; c.pop(1.4 + i * 0.05, 0.18 + Math.cos(a) * 0.14, 0.4 + Math.sin(a) * 0.14, (0.03 + (i % 2) * 0.025) * c.W, i % 2 ? '#FFFFFF' : '#7DB46C'); }
    },
    quarter_zip(c) {
      [[0.95, -0.15, 0.2], [1.1, 1.15, 0.1], [1.25, 0.05, 0.6], [1.45, 1.05, 0.5], [1.7, -0.05, 0.05]].forEach(([t1, fx, fy]) => c.add({ shape: 'flash', w: 0.42 * c.W, z: 6, upd(t, still) {
        if (still) return null; const q = (t - c.at - t1) / 0.32; if (q < 0 || q > 1) return null;
        return { x: c.L + fx * c.W, y: c.T + fy * c.W, s: 0.4 + q * 0.8, o: 1 - q };
      } }));
    },
    wipeout(c) { c.dust(1.35, 0.5, 0.92, 8); },
    celebrating(c) {
      const cols = ['#17181C', '#FFFFFF', '#E9B21A', c.deep, '#F3A6A0', '#8FD1A8'];
      for (let i = 0; i < 42; i++) {
        const ang = -Math.PI / 2 + (c.rnd() - 0.5) * 2.6, sp = 500 + c.rnd() * 650, spin = (c.rnd() - 0.5) * 1400, col = cols[i % cols.length], ws = c.rnd();
        c.add({ shape: 'rect', color: col, w: 14 + ws * 8, h: 22 + ws * 10, z: 6, upd(t, still) {
          if (still && i % 3) return null; const age = still ? 0.22 : t - c.at - 0.5; if (age < 0 || age > 2.6) return null;
          const p0 = c.local(0.5, 0.2, c.at + 0.5, false);
          return { x: p0.x + Math.cos(ang) * sp * age + Math.sin(age * 7 + i) * 20, y: p0.y + Math.sin(ang) * sp * age + 900 * age * age, r: spin * age, o: 1 - clamp((age - 2.0) / 0.6) };
        } });
      }
    },
    shocked(c) {
      [[0.02, 0.02, -16, 0.38], [0.9, 0.0, 14, 0.48]].forEach(([fx, fy, rot, t1]) => c.add({ shape: 'text', html: '!', color: '#17181C', w: 0.17 * c.W, z: 6, upd(t, still) {
        const e = still ? 1 : E.spring(win(t - c.at, t1, t1 + 0.4), 13, 5.5);
        const p = c.local(fx, fy, t, still);
        return { x: p.x, y: p.y, s: Math.max(0, e), r: rot, o: e > 0 ? 1 : 0 };
      } }));
    },
    worried(c) {
      [0.95, 2.4].forEach((t1, k) => c.add({ shape: 'drop', color: '#8EC9F0', w: 0.05 * c.W, h: 0.07 * c.W, z: 6, upd(t, still) {
        if (still) { if (k) return null; const p = c.local(0.8, 0.24, t, true); return { x: p.x, y: p.y, o: 1 }; }
        const age = t - c.at - t1; if (age < 0 || age > 1.3) return null;
        const p = c.local(0.8, 0.22, t, false);
        return { x: p.x, y: p.y + E.in2(clamp((age - 0.4) / 0.9)) * 0.14 * c.W, s: E.spring(clamp(age / 0.3), 10, 6), o: 1 - clamp((age - 1.0) / 0.3) };
      } }));
    },
    finger_gun(c) {
      [0.85, 1.2].forEach((t1, k) => {
        c.add({ shape: 'star', color: '#FFFFFF', w: 0.09 * c.W, z: 6, upd(t, still) {
          if (still) return k ? null : { ...c.local(1.0, 0.44, t, true), s: 0.8, o: 1 };
          const age = t - c.at - t1; if (age < 0 || age > 0.6) return null;
          const p = c.local(0.9, 0.47, c.at + t1, false);
          return { x: p.x + E.out(age / 0.6) * 260, y: p.y - age * 40, s: 0.5 + (1 - age / 0.6) * 0.6, r: age * 300, o: 1 - age / 0.6 };
        } });
      });
      c.add({ shape: 'text', html: 'pew', color: '#17181C', w: 0.1 * c.W, z: 6, upd(t, still) {
        if (still) return null; const age = t - c.at - 0.85; if (age < 0 || age > 0.9) return null;
        const p = c.local(0.9, 0.36, c.at + 0.85, false);
        return { x: p.x + 40, y: p.y - age * 70, s: E.spring(clamp(age / 0.25), 12, 6), r: -10, o: 1 - clamp((age - 0.6) / 0.3) };
      } });
    },
    newspaper(c) {
      [[0.13, 0.42, -150], [0.13, 0.58, 160], [0.9, 0.45, -30], [0.9, 0.6, 30]].forEach(([fx, fy, ang], i) => c.add({ shape: 'bar', color: '#17181C', w: 0.06 * c.W, h: 7, z: 6, upd(t, still) {
        if (still) return null; const q = (t - c.at - 0.85 - (i % 2) * 0.08) / 0.4; if (q < 0 || q > 1) return null;
        const p = c.local(fx, fy, t, false); const a = (ang * Math.PI) / 180;
        return { x: p.x + Math.cos(a) * 40 * q, y: p.y + Math.sin(a) * 40 * q, r: ang, o: Math.sin(q * Math.PI) };
      } }));
    },
  };

  // ---------------------------------------------------------------- wiring
  const actors = [];
  function init() {
    for (const el of document.querySelectorAll('[data-act]')) {
      const kind = el.dataset.act; const act = ACT[kind] || ACT.thinking;
      const L = parseFloat(el.style.left), T = parseFloat(el.style.top), W = parseFloat(el.style.width);
      const at = parseFloat(el.dataset.at || 0), live = el.dataset.live === '1';
      const origin = act.origin || '50% 90%';
      el.style.transformOrigin = origin;
      const [ox, oy] = origin.split(' ').map((s) => parseFloat(s) / 100);
      const frames = el.querySelectorAll('img');
      const state = (t, still) => {
        if (still) return S(Object.assign(act.fn(act.dur + 5, live), { frame: 0 }));
        const u = Math.max(0, t - at); const s = act.fn(u, live);
        const k = clamp(u - act.dur);
        if (k > 0) { s.y += Math.sin((u - act.dur) * 2.1) * 9 * k; s.r += Math.sin((u - act.dur) * 1.6) * 1.6 * k; }
        return s;
      };
      const local = (fx, fy, t, still) => {
        const s = state(t, still);
        const Ox = L + ox * W, Oy = T + oy * W;
        const dx = (fx - ox) * W * s.sx, dy = (fy - oy) * W * s.sy;
        const a = (s.r * Math.PI) / 180;
        return { x: Ox + s.x + dx * Math.cos(a) - dy * Math.sin(a), y: Oy + s.y + dx * Math.sin(a) + dy * Math.cos(a) };
      };
      const parts = [];
      const c = { W, L, T, at, local, appear: (t, still, d = 0.35) => (still || live ? 1 : clamp((t - at - d) * 3)), rnd: rng(kind.length * 977 + 13), deep: el.dataset.deep || '#2D4E86',
        add(spec) {
          const d = document.createElement('div');
          const w = spec.w, h = spec.h ?? spec.w;
          d.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;z-index:${spec.z || 6};pointer-events:none;will-change:transform,opacity;${spec.shape === 'text' ? `font-size:${w}px;width:auto;height:auto;` : spec.shape === 'bubble' ? `font-size:${w}px;` : ''}`;
          d.innerHTML = SHAPES[spec.shape](spec.color, spec.html);
          el.parentNode.appendChild(d);
          parts.push({ d, spec, w, h });
        },
        pop(t1, fx, fy, size, color) { // a sparkle that pops and fades near the coin
          c.add({ shape: 'star', color, w: size, z: 6, upd(t, still) {
            if (still) return null; const age = t - at - t1; if (age < 0 || age > 0.9) return null;
            const p = local(fx, fy, t, false);
            return { x: p.x, y: p.y, s: E.spring(clamp(age / 0.35), 12, 5), r: age * 120, o: 1 - clamp((age - 0.6) / 0.3) };
          } });
        },
        spark(t1, fx, fy, size, color, ang) {
          c.add({ shape: 'disc', color, w: size * 0.5, z: 6, upd(t, still) {
            if (still) return null; const age = t - at - t1; if (age < 0 || age > 0.45) return null;
            const p = local(fx, fy, at + t1, false);
            return { x: p.x + Math.cos(ang) * 150 * age, y: p.y - 220 * age + 600 * age * age, o: 1 - age / 0.45 };
          } });
        },
        dust(t1, fx, fy, n) { // puffs kicked out sideways on landing
          for (let i = 0; i < n; i++) {
            const dir = i % 2 ? 1 : -1, sp = 120 + c.rnd() * 160, lift = 30 + c.rnd() * 60;
            c.add({ shape: 'puff', color: '#FFFFFF', w: 0.08 * W, z: 4, upd(t, still) {
              if (still) return null; const age = t - at - t1; if (age < 0 || age > 0.7) return null;
              const p = local(fx, fy, at + t1, false); const q = age / 0.7;
              return { x: p.x + dir * sp * E.out(q), y: p.y - lift * E.out(q), s: 0.5 + q * 1.4, o: (1 - q) * 0.9 };
            } });
          }
        },
        speedLines(until, fromRight) { // horizontal lines trailing the walker/runner
          for (let i = 0; i < 5; i++) {
            const fy = 0.3 + i * 0.12, len = 0.22 + c.rnd() * 0.15;
            c.add({ shape: 'bar', color: 'rgba(23,24,28,.35)', w: len * W, h: 7, z: 4, upd(t, still) {
              if (still) return null; const u = t - at; if (u < 0.05 || u > until) return null;
              const p = local(fromRight ? 1.05 + len / 2 : -0.05 - len / 2, fy, t, false);
              return { x: p.x + Math.sin(u * 30 + i) * 12, y: p.y, o: (1 - u / until) * 0.9 };
            } });
          }
        },
        hitBall(fx, fy, color, t1) { // ball rockets off the bat with a short trail + impact burst
          for (let g = 0; g < 5; g++) {
            c.add({ shape: 'ball', color, w: 0.07 * W * (1 - g * 0.12), z: 6, upd(t, still) {
              if (still) return null; const age = t - at - t1 - g * 0.03; if (age < 0 || age > 0.65) return null;
              const p = local(fx, fy, at + t1, false); const q = E.out2(age / 0.65);
              return { x: p.x + q * 700, y: p.y - q * 520, r: age * 900, o: g ? 0.5 - g * 0.09 : 1 };
            } });
          }
          for (let i = 0; i < 7; i++) {
            const a = -Math.PI * 0.9 + (i / 6) * Math.PI * 1.1;
            c.add({ shape: 'bar', color: '#17181C', w: 0.07 * W, h: 8, z: 6, upd(t, still) {
              if (still) return null; const q = (t - at - t1) / 0.32; if (q < 0 || q > 1) return null;
              const p = local(fx, fy, at + t1, false);
              return { x: p.x + Math.cos(a) * (40 + 70 * q), y: p.y + Math.sin(a) * (40 + 70 * q), r: (a * 180) / Math.PI, s: 1 - q * 0.5, o: 1 - q };
            } });
          }
        },
      };
      (FX[kind] || (() => {}))(c);
      const shadow = document.querySelector(`[data-shadow-for="${el.id}"]`);
      actors.push({ el, frames, state, parts, shadow });
    }
  }

  window.__actorSeek = function (t, still) {
    if (!actors.length && document.querySelector('[data-act]')) init();
    for (const a of actors) {
      const s = a.state(t, still);
      a.el.style.transform = `translate(${s.x}px, ${s.y}px) rotate(${s.r}deg) scale(${s.sx}, ${s.sy})`;
      a.el.style.opacity = s.o;
      if (a.frames.length > 1) { const f = s.frame || 0; a.frames[0].style.opacity = 1 - f; a.frames[1].style.opacity = f; }
      if (a.shadow) {
        const alt = Math.max(0, -s.y), sc = 1 - Math.min(1, alt / 600) * 0.65;
        const hx = clamp(1 - Math.abs(s.x) / 420);
        a.shadow.style.transform = `translateX(${s.x * 0.9}px) scale(${sc * s.sx})`;
        a.shadow.style.opacity = hx * (0.35 + 0.65 * sc) * Math.min(1, s.o * 1.5);
      }
      for (const p of a.parts) {
        const r = p.spec.upd(t, still);
        if (!r) { p.d.style.opacity = 0; continue; }
        const w = p.d.offsetWidth || p.w, h = p.d.offsetHeight || p.h;
        p.d.style.transform = `translate(${r.x - w / 2}px, ${r.y - h / 2}px) rotate(${r.r || 0}deg) scale(${r.s ?? 1})`;
        p.d.style.opacity = r.o ?? 1;
      }
    }
  };
})();
