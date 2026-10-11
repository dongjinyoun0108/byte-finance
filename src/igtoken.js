// Instagram long-lived tokens last 60 days. The token you paste into the IG_ACCESS_TOKEN secret is the
// seed; the job refreshes it weekly and keeps the newest one in state/ig-token.enc, encrypted with a key
// derived from the seed secret (so the public repo only ever holds ciphertext).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const FILE = 'state/ig-token.enc';
const keyFrom = (seed) => createHash('sha256').update(`byte-finance:${seed}`).digest();

export function encrypt(obj, seed) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', keyFrom(seed), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString('base64');
}

export function decrypt(text, seed) {
  const buf = Buffer.from(text.trim(), 'base64');
  const d = createDecipheriv('aes-256-gcm', keyFrom(seed), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8'));
}

/** Returns { token, changed } — changed=true when state/ig-token.enc was rewritten (commit it). */
export async function currentToken({ seed = process.env.IG_ACCESS_TOKEN, now = new Date(), fetchImpl = fetch, maxAgeDays = 7 } = {}) {
  if (!seed) throw new Error('IG_ACCESS_TOKEN secret is not set');
  let state = { token: seed, refreshedAt: null };
  try { state = decrypt(await readFile(FILE, 'utf8'), seed); } catch { /* first run, or the seed secret was replaced */ }
  const age = state.refreshedAt ? now - Date.parse(state.refreshedAt) : Infinity;
  if (age < maxAgeDays * 86400e3) return { token: state.token, changed: false };
  try {
    const res = await fetchImpl(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(state.token)}`);
    const json = await res.json();
    if (!res.ok || !json.access_token) throw new Error(json.error?.message || `HTTP ${res.status}`);
    state = { token: json.access_token, refreshedAt: now.toISOString() };
    await mkdir('state', { recursive: true });
    await writeFile(FILE, encrypt(state, seed));
    return { token: state.token, changed: true };
  } catch (e) {
    console.warn(`token refresh skipped: ${e.message}`); // current token is still valid for weeks
    return { token: state.token, changed: false };
  }
}

/** The Instagram professional account id for this token. */
export async function instagramUserId(token, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(`https://graph.instagram.com/v23.0/me?fields=user_id,username&access_token=${encodeURIComponent(token)}`);
  const json = await res.json();
  if (!res.ok || !json.user_id) throw new Error(`Instagram /me failed: ${json.error?.message || res.status}`);
  return { userId: json.user_id, username: json.username };
}
