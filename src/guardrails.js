// Automated checks that replace human review. A story that fails is never published:
// the writer gets one more try with the errors, then the slide is dropped from that day's carousel.

// Advice, prediction and hype language aimed at the reader. Fail closed.
const BANNED = [
  /\bbuy(ing|s)?\b/i,
  /\bsell(ing|s)?\b(?!-off)/i,
  /\bshould(n'?t)?\b/i,
  /\bmust\b/i,
  /\bought to\b/i,
  /\brecommend/i,
  /\badvi[cs]e/i,
  /\b(good|great|best|right) time\b/i,
  /\btime to\b/i,
  /\binvest(ing)?\b/i,
  /\byou(r)? (portfolio|money|super)\b/i,
  /\bguarantee/i,
  /\brisk[- ]free\b/i,
  /\bwill (rise|fall|cut|hike|drop|climb|soar|plunge|crash|go up|go down|keep|rebound|recover)/i,
  /\b(predict|forecast|tip)(s|ed|ing)?\b/i,
  /\bopportunit/i,
  /\bdon'?t miss\b/i,
  /\bact now\b/i,
  /\bget rich\b/i,
  /\bpassive income\b/i,
  /\bto the moon\b/i,
  /\bundervalued|overvalued\b/i,
  /\bbargain\b/i,
];

export function bannedHits(text) {
  return BANNED.map((re) => re.exec(text)?.[0]).filter(Boolean);
}

/** Numbers in text: 6,512.40 -> 6512.40, 1.5% -> 1.5, $US2.3bn -> 2.3. Hashtags ignored. */
// Index names contain numbers that aren't claims ("ASX 200", "S&P 500").
const INDEX_NAMES = /\b(?:S&P\/)?ASX ?200\b|\bS&P ?500\b|\bNasdaq ?100\b|\bFTSE ?100\b|\bNikkei ?225\b|\bStoxx ?600\b|\bASX ?300\b/gi;

export function numberTokens(text) {
  const clean = text.replace(INDEX_NAMES, ' ').replace(/#[\w-]+/g, ' ').replace(/(\d),(?=\d{3}\b)/g, '$1');
  return [...clean.matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]);
}

/** Every number a story may use: anything in its source text, plus the board figures. */
export function allowedNumbers(sourceTexts, extra = []) {
  const set = new Set();
  const add = (raw) => {
    const v = Math.abs(Number(raw));
    if (!Number.isFinite(v)) return;
    set.add(String(v));
    for (let d = 0; d <= 2; d++) { set.add(v.toFixed(d)); set.add(String(parseFloat(v.toFixed(d)))); }
  };
  for (const t of sourceTexts) numberTokens(t || '').forEach(add);
  extra.forEach(add);
  return set;
}

const words = (t) => t.toLowerCase().replace(/[^a-z0-9$% ]+/g, ' ').split(/\s+/).filter(Boolean);

/** Longest run of consecutive words shared with the source (copy check). */
export function longestSharedRun(text, source) {
  const a = words(text), b = words(source);
  if (!a.length || !b.length) return 0;
  let best = 0;
  const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : 0;
      if (prev[j] > best) best = prev[j];
      diag = tmp;
    }
  }
  return best;
}

/** Greedy word wrap, to check a headline fits its box. */
export function wrapLines(text, cpl) {
  const lines = [];
  let line = '';
  for (const w of text.trim().split(/\s+/)) {
    if (!line) line = w;
    else if (line.length + 1 + w.length <= cpl) line += ` ${w}`;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

const PLAIN = /^[\x20-\x7E‘’“”–—]*$/; // the display fonts don't have emoji or exotic glyphs

/**
 * Check one story for one slot.
 * story: { item_id, tag, headline, body, why, mood }
 * item: the news item it was written from. slot: SLOTS[x]. extraNumbers: board figures.
 */
export function checkStory(story, { item, slot, moods, extraNumbers = [] }) {
  const errors = [];
  if (!story || typeof story !== 'object') return ['not an object'];
  if (!item) errors.push(`unknown item_id "${story.item_id}"`);
  for (const f of ['headline', 'body', 'why']) {
    if (typeof story[f] !== 'string' || !story[f].trim()) errors.push(`missing ${f}`);
  }
  if (errors.length) return errors;
  const { headline, body, why } = story;

  if (!slot.tags.includes(story.tag)) errors.push(`tag must be one of: ${slot.tags.join(', ')}`);
  if (!moods.includes(story.mood)) errors.push(`mood must be one of: ${moods.join(', ')}`);

  const longest = Math.max(...headline.split(/\s+/).map((w) => w.length));
  if (longest > slot.cpl) errors.push(`headline word too long (max ${slot.cpl} letters per word)`);
  const lines = wrapLines(headline, slot.cpl);
  if (lines.length > slot.lines) errors.push(`headline too long: must fit ${slot.lines} lines of ${slot.cpl} characters`);
  if (body.length > slot.body) errors.push(`body over ${slot.body} characters`);
  if (why.length > slot.why) errors.push(`why over ${slot.why} characters`);
  for (const [k, v] of Object.entries({ headline, body, why })) {
    if (!PLAIN.test(v)) errors.push(`${k} has unsupported characters (no emoji)`);
  }

  const figure = story.figure ?? '', figureLabel = story.figure_label ?? '';
  if (figure && (typeof figure !== 'string' || figure.length > 7 || !/\d/.test(figure))) errors.push('figure must be a short number like "3.60%" or "$4.1b" (max 7 characters), or null');
  if (figure && (!figureLabel || figureLabel.length > 30)) errors.push('figure_label is required with a figure and must be at most 30 characters');
  if (!PLAIN.test(`${figure}${figureLabel}`)) errors.push('figure has unsupported characters');
  const all = `${headline}\n${body}\n${why}\n${figure}\n${figureLabel}`;
  for (const hit of bannedHits(all)) errors.push(`banned wording: "${hit}"`);
  if (/https?:\/\/|www\.|\.com\b/i.test(all)) errors.push('links not allowed');
  if (/@\w/.test(all)) errors.push('mentions not allowed');

  const allowed = allowedNumbers([item.title, item.summary], extraNumbers);
  for (const tok of numberTokens(all)) {
    if (!allowed.has(tok) && !allowed.has(String(parseFloat(tok)))) errors.push(`number not in source: ${tok}`);
  }
  const source = `${item.title} ${item.summary || ''}`;
  for (const [k, v] of Object.entries({ headline, body, why })) {
    if (longestSharedRun(v, source) >= 6) errors.push(`${k} copies the source wording; rephrase in your own words`);
  }
  return errors;
}
