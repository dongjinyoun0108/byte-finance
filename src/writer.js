// Picks the day's three stories and writes the slide text with Claude.
// Every story goes through guardrails.checkStory; failures get one fix-up round, then are dropped.

import { SLOTS, MOODS } from './config.js';
import { checkStory } from './guardrails.js';

const SLOT_KEYS = ['aus', 'us', 'biz'];

export const SYSTEM = `You are the writer for "Byte Finance", an Australian finance-news Instagram carousel read at 7:30am.
Tone: like the Australian Financial Review's front page, but in plain English a busy person gets in 3 seconds. Punchy, neutral, no hype.

You get today's candidate headlines (each with an id) and the overnight market board. For each of three slots, pick the single biggest, most widely relevant story that fits the slot, or null if nothing fits:
${SLOT_KEYS.map((k) => `- "${k}": ${SLOTS[k].label}. tag must be one of ${JSON.stringify(SLOTS[k].tags)}.`).join('\n')}
Never use the same candidate twice. Prefer hard news (decisions, data, results, deals) over opinion, previews, listicles or promotional pieces.

Rules you must follow:
- Use ONLY facts stated in the chosen candidate's title and summary. Never add numbers, dates, causes, quotes or context that are not there.
- Write everything in your own words. Never copy a phrase of 6+ words from the source.
- Report, don't advise. Never tell readers what to do with money. Never predict what happens next.
- Banned words: buy, sell, should, must, recommend, advice, invest, investing, opportunity, forecast, predict, bargain, "will rise/fall".
- headline: short, Title Case, states what happened. Per-slot fit: ${SLOT_KEYS.map((k) => `${k} ≤ ${SLOTS[k].lines} lines of ${SLOTS[k].cpl} characters, no word longer than ${SLOTS[k].cpl} letters`).join('; ')}.
- body: one sentence on what happened (aus ≤ ${SLOTS.aus.body}, us ≤ ${SLOTS.us.body}, biz ≤ ${SLOTS.biz.body} characters).
- why: one sentence on why it matters to Australians, factual, no prediction (aus ≤ ${SLOTS.aus.why}, us ≤ ${SLOTS.us.why}, biz ≤ ${SLOTS.biz.why} characters).
- figure: the single most important number from the source, formatted short (e.g. "3.60%", "$4.1b", "+62%"), max 7 characters, or null if the source has no key number. figure_label: what that number is, max 30 characters (e.g. "Cash rate, unchanged").
- mood: the mascot's reaction, one of ${JSON.stringify(MOODS)} (celebrating = great news, shocked = surprising, worried = bad news, newspaper = neutral update, coffee = calm/steady, finger_gun = confident upbeat).
- Plain text only: no emoji, no links, no @mentions, no hashtags.
Return ONLY JSON: {"aus": {"item_id","tag","headline","body","why","figure","figure_label","mood"} | null, "us": {...} | null, "biz": {...} | null}`;

export async function callClaude(messages, { apiKey = process.env.ANTHROPIC_API_KEY, model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001', fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 1500, temperature: 0.4, system: SYSTEM, messages }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.content.map((c) => c.text || '').join('');
}

/** Free fallback when there is no Anthropic key: GitHub Models (uses the workflow's GITHUB_TOKEN). */
export async function callGithubModels(messages, { token = process.env.GITHUB_TOKEN, model = process.env.GH_MODEL || 'openai/gpt-4.1', fetchImpl = fetch } = {}) {
  if (!token) throw new Error('GITHUB_TOKEN missing');
  const res = await fetchImpl('https://models.github.ai/inference/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({ model, temperature: 0.4, max_tokens: 1500, messages: [{ role: 'system', content: SYSTEM }, ...messages] }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`GitHub Models ${res.status}: ${raw.slice(0, 300)}`);
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error(`GitHub Models returned non-JSON (${res.status} ${res.headers.get('content-type')}): ${raw.slice(0, 200)}`); }
  return data.choices?.[0]?.message?.content || '';
}

/** Claude when ANTHROPIC_API_KEY is set, otherwise the free GitHub Models fallback. */
export const callWriter = (messages, opts) => (process.env.ANTHROPIC_API_KEY ? callClaude(messages, opts) : callGithubModels(messages, opts));

export function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('no JSON in reply');
  return JSON.parse(text.slice(start, end + 1));
}

function brief(items, board) {
  return JSON.stringify({
    candidates: items.map(({ id, source, region, title, summary, published }) => ({ id, source, region, title, summary, published })),
    board: board.rows.map((r) => ({ market: r.label, value: r.value, change: r.change })),
  }, null, 1);
}

/**
 * Returns { stories: { aus?, us?, biz? }, log }. Each story has the item attached.
 * Never throws for writing problems; worst case is no stories.
 */
export async function writeStories({ items, board, claude = callClaude, maxRounds = 2 }) {
  const log = [];
  if (!items.length) return { stories: {}, log: ['no news items'] };
  const byId = new Map(items.map((it) => [it.id, it]));
  const extraNumbers = board.rows.flatMap((r) => [r.changePct, r.price, Math.abs(r.changePct)]);
  const accepted = {};
  const messages = [{ role: 'user', content: `Today's material:\n${brief(items, board)}` }];

  for (let round = 1; round <= maxRounds; round++) {
    let reply;
    let draft;
    try {
      reply = await claude(messages);
      draft = extractJson(reply);
    } catch (e) {
      log.push({ round, error: String(e.message || e) });
      break;
    }
    const problems = {};
    for (const k of SLOT_KEYS) {
      if (accepted[k]) continue;
      const s = draft[k];
      if (s == null) continue;
      const used = Object.entries(accepted).find(([, v]) => v.item_id === s.item_id);
      const errors = used ? [`item ${s.item_id} is already used for ${used[0]}; pick a different one`] : checkStory(s, { item: byId.get(s.item_id), slot: SLOTS[k], moods: MOODS, extraNumbers });
      if (errors.length) problems[k] = errors;
      else accepted[k] = { ...s, item: byId.get(s.item_id) };
    }
    log.push({ round, accepted: Object.keys(accepted), problems });
    if (!Object.keys(problems).length) break;
    messages.push({ role: 'assistant', content: reply });
    messages.push({
      role: 'user',
      content: `These slots failed the automatic checks:\n${Object.entries(problems).map(([k, e]) => `- ${k}: ${e.join('; ')}`).join('\n')}\nRewrite ONLY those slots (or choose a different candidate, or null). Return the same JSON shape with the other slots set to null.`,
    });
  }
  return { stories: accepted, log };
}
