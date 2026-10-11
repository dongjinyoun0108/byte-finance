// Instagram content publishing via the official Graph API (Business or Creator account).
// Carousel: one container per image (is_carousel_item), then a CAROUSEL container, then media_publish.

export function instagram({
  userId = process.env.IG_USER_ID,
  token = process.env.IG_ACCESS_TOKEN,
  version = process.env.IG_GRAPH_VERSION || 'v23.0',
  // Default: "Instagram API with Instagram Login" (no Facebook Page needed).
  host = process.env.IG_GRAPH_HOST || 'graph.instagram.com',
  fetchImpl = fetch,
  pollMs = 2000,
} = {}) {
  if (!userId || !token) throw new Error('IG_USER_ID and IG_ACCESS_TOKEN are required');
  const base = `https://${host}/${version}`;

  async function call(path, params, method = 'POST') {
    const body = new URLSearchParams({ ...params, access_token: token });
    const res = method === 'GET'
      ? await fetchImpl(`${base}/${path}?${body}`)
      : await fetchImpl(`${base}/${path}`, { method, body });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(`Instagram API: ${json.error?.message || res.status}`);
    return json;
  }

  async function waitReady(id) {
    for (let i = 0; i < 30; i++) {
      const { status_code } = await call(id, { fields: 'status_code' }, 'GET');
      if (status_code === 'FINISHED') return;
      if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`Instagram container ${id} ${status_code}`);
      await new Promise((r) => setTimeout(r, pollMs));
    }
    throw new Error(`Instagram container ${id} not ready in time`);
  }

  return {
    async publishCarousel({ imageUrls, caption }) {
      if (imageUrls.length < 2 || imageUrls.length > 10) throw new Error('A carousel needs 2-10 images');
      const children = [];
      for (const url of imageUrls) children.push((await call(`${userId}/media`, { image_url: url, is_carousel_item: 'true' })).id);
      for (const id of children) await waitReady(id);
      const { id: parent } = await call(`${userId}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption });
      await waitReady(parent);
      return (await call(`${userId}/media_publish`, { creation_id: parent })).id;
    },
  };
}

/**
 * Long-lived Instagram tokens last 60 days. The current one is kept in Supabase (app_secrets) and
 * refreshed whenever it is more than 7 days old, so it never lapses while the bot runs daily.
 * The first run seeds it from IG_ACCESS_TOKEN.
 */
export async function instagramToken({ store, now = new Date(), fetchImpl = fetch, maxAgeDays = 7 }) {
  let token = (await store.getSecret('ig_access_token')) || process.env.IG_ACCESS_TOKEN;
  if (!token) throw new Error('No Instagram token. Set IG_ACCESS_TOKEN once.');
  if ((process.env.IG_GRAPH_HOST || 'graph.instagram.com') !== 'graph.instagram.com') return token;
  const last = Date.parse((await store.getSecret('ig_token_refreshed_at')) || 0) || 0;
  if (now.getTime() - last < maxAgeDays * 86400e3) return token;
  try {
    const res = await fetchImpl(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
    const json = await res.json();
    if (res.ok && json.access_token) {
      token = json.access_token;
      await store.setSecret('ig_access_token', token);
      await store.setSecret('ig_token_refreshed_at', now.toISOString());
    }
  } catch {
    // Keep the current token; it is still valid for weeks.
  }
  return token;
}
