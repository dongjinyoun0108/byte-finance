// Runs inside the slide page. Every animation is a pure function of time t (seconds), so the
// renderer can step frame by frame for video, and seek(999, true) gives the finished still.
(function () {
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const ease = {
    out: (p) => 1 - Math.pow(1 - p, 3),
    expo: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    inOutQuint: (p) => (p < 0.5 ? 16 * p ** 5 : 1 - Math.pow(-2 * p + 2, 5) / 2),
    // damped spring: overshoots then settles (stiff=frequency, damp=decay)
    spring: (p, stiff = 9, damp = 5.5) => (p >= 1 ? 1 : 1 - Math.exp(-damp * p) * Math.cos(stiff * p)),
  };
  const D = (el, k, d) => (el.dataset[k] !== undefined ? parseFloat(el.dataset[k]) : d);
  const prog = (el, t, defDur = 0.7) => clamp((t - D(el, 'at', 0)) / D(el, 'dur', defDur));
  const fmt = (v, el) => {
    const d = parseInt(el.dataset.decimals || 0, 10);
    const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    return (el.dataset.prefix || '') + (v < 0 ? '−' : el.dataset.sign ? '+' : '') + s + (el.dataset.suffix || '');
  };
  const total = parseFloat(document.body.dataset.duration || 5);

  // Headline treatments (one per slide)
  function textMove(kind, el, p) {
    if (kind === 'char') { // typewriter-ish: each letter pops in
      el.style.opacity = p > 0 ? 1 : 0;
      el.style.transform = `translateY(${(1 - ease.spring(p, 12, 7)) * 30}px)`;
    } else if (kind === 'line') { // line slides up out of a mask
      el.style.transform = `translateY(${(1 - ease.expo(p)) * 110}%)`;
    } else if (kind === 'popword') { // word pops with a twist
      const e = ease.spring(p, 11, 5);
      el.style.opacity = clamp(p * 4);
      el.style.transform = `scale(${Math.max(0, e)}) rotate(${(1 - e) * -20}deg)`;
    } else if (kind === 'wave') { // letters ride a wave in
      const e = ease.spring(p, 9, 5);
      el.style.opacity = clamp(p * 3);
      el.style.transform = `translateY(${(1 - e) * -80}px) rotate(${(1 - e) * 25}deg)`;
    }
  }

  function seek(t, still) {
    // slow cinematic push-in on the whole stage
    const stage = document.querySelector('.stage');
    if (stage) stage.style.transform = still ? 'none' : `scale(${1 + 0.035 * ease.inOut(clamp(t / (total + 1.5)))})`;

    for (const el of document.querySelectorAll('[data-in]')) {
      const kind = el.dataset.in;
      const p = prog(el, t);
      if (kind === 'fade') {
        el.style.opacity = ease.out(p);
      } else if (kind === 'wipe') {
        // full-bleed colour panel that sweeps across and off (left to right)
        const x = -100 + 200 * ease.inOutQuint(p);
        el.style.transform = `translateX(${x}%) skewX(-8deg)`;
        el.style.visibility = p > 0 && p < 1 ? 'visible' : 'hidden';
      } else if (kind === 'word') {
        // blur-to-sharp rise, slight tilt, spring settle
        const e = ease.spring(p, 8, 6);
        const o = ease.out(clamp(p * 2.2));
        el.style.opacity = o;
        el.style.filter = `blur(${(1 - o) * 14}px)`;
        el.style.transform = `translateY(${(1 - e) * 70}px) rotate(${(1 - e) * 5}deg)`;
      } else if (kind === 'glide') {
        // rows: in from the right, blurred, decelerating
        const e = ease.expo(p);
        el.style.opacity = clamp(p * 2);
        el.style.filter = `blur(${(1 - e) * 10}px)`;
        el.style.transform = `translateX(${(1 - e) * 140}px)`;
      } else if (kind === 'pop') {
        const e = ease.spring(p, 11, 6);
        el.style.opacity = clamp(p * 4);
        el.style.transform = `scale(${0.4 + 0.6 * e}) rotate(${(1 - e) * D(el, 'rot', 0)}deg)`;
      } else if (kind === 'plinth') {
        // pedestal rises from below with a soft spring
        const e = ease.spring(p, 7, 6);
        el.style.transform = `translateY(${(1 - e) * 420}px)`;
      } else if (kind === 'punch') {
        // quick scale punch (synced to the coin landing)
        const q = clamp((t - D(el, 'at', 0)) / D(el, 'dur', 0.5));
        const s = q > 0 && q < 1 ? Math.sin(q * Math.PI) * D(el, 'amt', 0.14) * (1 - q * 0.3) : 0;
        el.style.transformOrigin = el.dataset.origin || '0% 50%';
        el.style.transform = `scale(${1 + s}) rotate(${s * -12}deg)`;
      } else if (kind === 'slam') {
        // big figure lands from oversized and blurred
        const e = ease.spring(p, 10, 7);
        el.style.opacity = clamp(p * 4);
        el.style.filter = `blur(${(1 - clamp(p * 2.5)) * 16}px)`;
        el.style.transformOrigin = '0% 60%';
        el.style.transform = `scale(${1 + (1 - e) * 0.9})`;
      } else if (kind === 'zoomIn') {
        // whole slide arrives slightly zoomed and soft, snaps crisp
        const e = ease.expo(p);
        el.style.filter = `blur(${(1 - e) * 10}px)`;
        el.style.transform = `scale(${1 + (1 - e) * 0.12})`;
      } else if (kind === 'twinkle') {
        const ph = D(el, 'phase', 0);
        const appear = ease.spring(p, 12, 6);
        const tw = still ? 1 : 0.75 + 0.25 * Math.sin(t * 4.2 + ph);
        el.style.opacity = clamp(p * 3) * (still ? 1 : 0.6 + 0.4 * Math.sin(t * 3.1 + ph));
        el.style.transform = `scale(${appear * tw}) rotate(${still ? 0 : t * 40 + ph * 30}deg)`;
      } else if (kind === 'char' || kind === 'line' || kind === 'popword' || kind === 'wave') {
        textMove(kind, el, p);
      } else if (kind === 'marquee') {
        // continuous horizontal scroll; the still uses a fixed resting offset
        const speed = D(el, 'speed', 90);
        const w = el.scrollWidth / 2;
        const off = still ? D(el, 'rest', 0) : (t * speed) % w;
        el.style.transform = `translateX(${-off - D(el, 'rest', 0)}px)`;
        el.style.opacity = clamp((t - D(el, 'at', 0)) / 0.4) || (still ? 1 : 0);
      } else if (kind === 'band') {
        // ribbon slides in across the coin
        const e = ease.expo(p);
        el.style.transform = `translateX(${(1 - e) * -110}%) rotate(${D(el, 'rot', 0)}deg)`;
      }
    }
    if (window.__actorSeek) window.__actorSeek(t, still);
    for (const el of document.querySelectorAll('[data-count]')) {
      const p = ease.expo(prog(el, t, 1.3));
      const target = parseFloat(el.dataset.count);
      const start = parseFloat(el.dataset.from ?? 0);
      el.textContent = fmt(start + (target - start) * p, el);
    }
    for (const el of document.querySelectorAll('[data-draw]')) {
      const len = el.getTotalLength();
      el.style.strokeDasharray = `${len}`;
      el.style.strokeDashoffset = `${len * (1 - ease.inOut(prog(el, t, 1.4)))}`;
    }
    for (const el of document.querySelectorAll('[data-follow]')) {
      const path = document.getElementById(el.dataset.follow);
      const p = ease.inOut(prog(path, t, 1.4));
      const pt = path.getPointAtLength(path.getTotalLength() * p);
      el.setAttribute('cx', pt.x); el.setAttribute('cy', pt.y);
      el.style.opacity = p > 0.02 ? 1 : 0;
    }
  }
  window.__seek = seek;
  window.__duration = total;
  seek(new URLSearchParams(location.search).has('anim') ? 0 : 999, !new URLSearchParams(location.search).has('anim'));
})();
