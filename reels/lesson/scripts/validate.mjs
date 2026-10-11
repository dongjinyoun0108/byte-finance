// Checks a lesson's diagram spec (content/lesson-visuals.json) before it can ever reach a render.
// Returns a list of problems; empty means good to go.
export function validateVisual(topic, V) {
  const out = [];
  if (!V) return [`${topic.id}: no diagram in content/lesson-visuals.json`];
  if (V.type === 'growth') {
    for (const k of ['start', 'rate', 'years']) if (typeof V[k] !== 'number') out.push(`${topic.id}: growth needs numeric ${k}`);
    return out;
  }
  if (V.type !== 'flow') return [`${topic.id}: type must be "flow" or "growth"`];
  const N = V.nodes || {}, ids = Object.keys(N);
  if (ids.length < 2) out.push(`${topic.id}: needs at least 2 nodes`);
  const rect = (n) => { const bar = n.kind === 'bar', w = n.w || (bar ? 800 : 300), h = bar ? 160 : n.sub ? 150 : 110; return [n.x - w / 2, n.y - h / 2, w, h]; };
  for (const [id, n] of Object.entries(N)) {
    const [l, t, w, h] = rect(n);
    if (l < -20 || l + w > 1020 || t < -40 || t + h > 840) out.push(`${topic.id}: node ${id} sits outside the 1000x800 canvas`);
    if (!n.label || n.label.length > 26) out.push(`${topic.id}: node ${id} label must be 1-26 characters`);
    if (n.sub && n.sub.length > 34) out.push(`${topic.id}: node ${id} sub must be at most 34 characters`);
    if (n.kind === 'bar') for (const s of n.slices || []) if (!(s.pct > 0)) out.push(`${topic.id}: bar ${id} slice needs pct > 0`);
  }
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const [a1, b1, c1, d1] = rect(N[ids[i]]), [a2, b2, c2, d2] = rect(N[ids[j]]), pad = 16;
    if (a1 < a2 + c2 + pad && a2 < a1 + c1 + pad && b1 < b2 + d2 + pad && b2 < b1 + d1 + pad) out.push(`${topic.id}: nodes ${ids[i]} and ${ids[j]} overlap`);
  }
  const E = new Set();
  for (const e of V.edges || []) {
    if (!N[e.from] || !N[e.to]) out.push(`${topic.id}: edge ${e.id} joins unknown nodes`);
    if (e.label && e.label.length > 24) out.push(`${topic.id}: edge ${e.id} label must be at most 24 characters`);
    E.add(e.id);
  }
  if (!Array.isArray(V.steps) || V.steps.length !== 4) out.push(`${topic.id}: needs exactly 4 steps`);
  (V.steps || []).forEach((st, i) => {
    for (const id of st.show || []) if (!N[id] && !E.has(id)) out.push(`${topic.id}: step ${i + 1} shows unknown ${id}`);
    for (const id of st.flow || []) if (!E.has(id)) out.push(`${topic.id}: step ${i + 1} flows along unknown edge ${id}`);
    for (const id of [...(st.focus || []), ...(st.highlight || []), ...(st.wobble || [])]) if (!N[id]) out.push(`${topic.id}: step ${i + 1} refers to unknown node ${id}`);
    if (st.badge && !N[st.badge]) out.push(`${topic.id}: step ${i + 1} badge on unknown node ${st.badge}`);
    if (topic.steps[i]?.figure && !st.badge) out.push(`${topic.id}: step ${i + 1} has a figure but no badge node to show it on`);
  });
  // a step's figure badge must not cover a box that's on screen by then (same placement maths as flow.mjs)
  const seen = new Set();
  (V.steps || []).forEach((st, i) => {
    (st.show || []).forEach((id) => N[id] && seen.add(id));
    const f = topic.steps[i];
    if (!st.badge || !f?.figure || !N[st.badge]) return;
    const [l, t, w, h] = rect(N[st.badge]);
    const side = st.badgeSide || (t + h + 150 < 800 ? 'below' : 'above');
    const x = side === 'right' ? l + w + 24 : side === 'left' ? l - 24 : l + w / 2;
    const y = side === 'below' ? t + h + 18 : side === 'above' ? t - 18 : N[st.badge].y - 62;
    const bw = Math.max(String(f.figure).length * 44, String(f.figureLabel || '').length * 12.5) + 56, bh = 128;
    const bl = side === 'right' ? x : side === 'left' ? x - bw : x - bw / 2, bt = side === 'above' ? y - bh : y;
    for (const id of seen) {
      if (id === st.badge) continue;
      const [a2, b2, c2, d2] = rect(N[id]);
      if (bl < a2 + c2 && a2 < bl + bw && bt < b2 + d2 && b2 < bt + bh) out.push(`${topic.id}: step ${i + 1} badge covers node ${id} (try badgeSide)`);
    }
  });
  // every node and edge must appear in some step
  const shown = new Set((V.steps || []).flatMap((s) => s.show || []));
  for (const id of [...ids, ...E]) if (!shown.has(id)) out.push(`${topic.id}: ${id} is never shown`);
  return out;
}
