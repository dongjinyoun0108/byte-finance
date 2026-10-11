// Canva Connect API: OAuth token refresh, brand-template autofill, JPG export.
// Canva refresh tokens are single-use: each refresh returns a new one, which we save *before* using
// the access token, so a crash can never strand us with a spent token.

const API = 'https://api.canva.com/rest/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function getAccessToken({ store, fetchImpl = fetch, clientId = process.env.CANVA_CLIENT_ID, clientSecret = process.env.CANVA_CLIENT_SECRET }) {
  if (!clientId || !clientSecret) throw new Error('CANVA_CLIENT_ID and CANVA_CLIENT_SECRET are required');
  const refresh = await store.getSecret('canva_refresh_token');
  if (!refresh) throw new Error('No Canva refresh token stored. Run: npm run canva-auth');
  const res = await fetchImpl(`${API}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(`Canva token refresh failed (${res.status}): ${json.error_description || json.message || json.error || 'unknown'}. Re-run: npm run canva-auth`);
  if (json.refresh_token) await store.setSecret('canva_refresh_token', json.refresh_token);
  return json.access_token;
}

async function api(path, { token, fetchImpl, method = 'GET', body }) {
  const res = await fetchImpl(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Canva ${method} ${path} ${res.status}: ${json.message || json.code || 'error'}`);
  return json;
}

async function poll(path, { token, fetchImpl, timeoutMs = 90_000, intervalMs = 2000 }) {
  const start = Date.now();
  for (;;) {
    const { job } = await api(path, { token, fetchImpl });
    if (job.status === 'success') return job;
    if (job.status === 'failed') throw new Error(`Canva job failed: ${job.error?.code || ''} ${job.error?.message || ''}`.trim());
    if (Date.now() - start > timeoutMs) throw new Error(`Canva job ${path} timed out`);
    await sleep(intervalMs);
  }
}

/** Fill the brand template and return the new design id. */
export async function autofill({ token, templateId, data, title, fetchImpl = fetch, intervalMs }) {
  const { job } = await api('/autofills', { token, fetchImpl, method: 'POST', body: { brand_template_id: templateId, title, data } });
  const done = job.status === 'success' ? job : await poll(`/autofills/${job.id}`, { token, fetchImpl, intervalMs });
  return done.result.design.id;
}

/** Export the given pages as JPGs; returns one download URL per page (valid 24h). */
export async function exportJpgs({ token, designId, pages, fetchImpl = fetch, intervalMs }) {
  const { job } = await api('/exports', {
    token, fetchImpl, method: 'POST',
    body: { design_id: designId, format: { type: 'jpg', quality: 92, pages, width: 1080, height: 1440 } },
  });
  const done = job.status === 'success' ? job : await poll(`/exports/${job.id}`, { token, fetchImpl, intervalMs });
  if (!done.urls || done.urls.length !== pages.length) throw new Error(`Canva export returned ${done.urls?.length || 0} images for ${pages.length} pages`);
  return done.urls;
}
