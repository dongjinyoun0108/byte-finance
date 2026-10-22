// Instagram content publishing via the official Graph API (Business or Creator account).
// Carousel: one container per image (is_carousel_item), then a CAROUSEL container, then media_publish.

export function instagram({
  userId = process.env.IG_USER_ID,
  token = process.env.IG_ACCESS_TOKEN,
  version = process.env.IG_GRAPH_VERSION || 'v23.0',
  // Default: "Instagram API with Instagram Login" (no Facebook Page needed).
  host = process.env.IG_GRAPH_HOST || 'graph.instagram.com',
  fetchImpl = fetch,
  pollMs = 5000,
  limitWaitMs = 10 * 60e3, // Instagram's app rate limit is a rolling hour: back off and retry instead of failing
} = {}) {
  if (!userId || !token) throw new Error('IG_USER_ID and IG_ACCESS_TOKEN are required');
  const base = `https://${host}/${version}`;

  async function call(path, params, method = 'POST', attempt = 0) {
    const body = new URLSearchParams({ ...params, access_token: token });
    const res = method === 'GET'
      ? await fetchImpl(`${base}/${path}?${body}`)
      : await fetchImpl(`${base}/${path}`, { method, body });
    const json = await res.json();
    if (!res.ok || json.error) {
      const msg = json.error?.message || String(res.status);
      if (/request limit|rate limit|too many calls/i.test(msg) && attempt < 4) {
        console.warn(`Instagram rate limit (${msg}); waiting ${Math.round(limitWaitMs / 60e3)} min before retrying`);
        await new Promise((r) => setTimeout(r, limitWaitMs));
        return call(path, params, method, attempt + 1);
      }
      throw new Error(`Instagram API: ${msg}`);
    }
    return json;
  }

  async function waitReady(id, tries = 30, debug) {
    for (let i = 0; i < tries; i++) {
      const { status_code, status } = await call(id, { fields: 'status_code,status' }, 'GET');
      if (debug && (i === 0 || status_code !== 'IN_PROGRESS')) debug(`container ${id}: ${status_code}${status ? ` (${status})` : ''}`);
      if (status_code === 'FINISHED') return;
      if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`Instagram container ${id} ${status_code}${status ? `: ${status}` : ''}`);
      await new Promise((r) => setTimeout(r, pollMs));
    }
    throw new Error(`Instagram container ${id} not ready in time`);
  }

  return {
    /** A Story (9:16 image). Returns the media id. */
    async publishStory({ imageUrl }) {
      const { id } = await call(`${userId}/media`, { image_url: imageUrl, media_type: 'STORIES' });
      await waitReady(id);
      return (await call(`${userId}/media_publish`, { creation_id: id })).id;
    },
    /**
     * Reel, step 1: create the container and upload the MP4 straight from disk (resumable upload, so the
     * video never needs public hosting), then wait for Instagram to finish processing it. Returns the
     * container id; call publish(id) when it should go live. Falls back to videoUrl if given.
     */
    async prepareReel({ video, videoUrl, caption, thumbOffsetMs = 2700, shareToFeed = false, debug = () => {} }) {
      const base = { media_type: 'REELS', caption, share_to_feed: String(shareToFeed), thumb_offset: String(thumbOffsetMs) };
      let id;
      if (videoUrl) { // the Instagram-login API takes Reels by URL only (no resumable upload)
        id = (await call(`${userId}/media`, { ...base, video_url: videoUrl })).id;
        debug(`container ${id} from ${videoUrl}`);
        await waitReady(id, 60, debug);
        return id;
      }
      try {
        if (!video) throw new Error('no local video');
        const c = await call(`${userId}/media`, { ...base, upload_type: 'resumable' });
        id = c.id;
        debug(`container ${id}, upload uri ${c.uri ? c.uri.replace(/access_token=[^&]+/, 'access_token=…') : '(none returned)'}`);
        const res = await fetchImpl(c.uri || `https://rupload.facebook.com/ig-api-upload/${version}/${id}`, {
          method: 'POST',
          headers: { Authorization: `OAuth ${token}`, offset: '0', file_size: String(video.length), 'Content-Type': 'application/octet-stream' },
          body: video,
        });
        const text = await res.text();
        debug(`upload HTTP ${res.status}: ${text.slice(0, 500)}`);
        let j = {}; try { j = JSON.parse(text); } catch { /* not JSON */ }
        if (!res.ok || j.success === false || j.error) throw new Error(`upload failed (HTTP ${res.status}): ${j.error?.message || j.debug_info?.message || text.slice(0, 300)}`);
      } catch (e) {
        if (!videoUrl) throw e;
        debug(`resumable upload failed (${e.message}); trying video_url`);
        id = (await call(`${userId}/media`, { ...base, video_url: videoUrl })).id;
      }
      await waitReady(id, 60, debug); // video processing: allow ~5 minutes at the default 5s poll
      return id;
    },
    async publish(creationId) {
      return (await call(`${userId}/media_publish`, { creation_id: creationId })).id;
    },
    async publishCarousel({ imageUrls, caption, altTexts = [] }) {
      if (imageUrls.length < 2 || imageUrls.length > 10) throw new Error('A carousel needs 2-10 images');
      const children = [];
      let useAlt = altTexts.length > 0;
      for (const [i, url] of imageUrls.entries()) {
        const params = { image_url: url, is_carousel_item: 'true' };
        if (useAlt && altTexts[i]) params.alt_text = altTexts[i].slice(0, 1000);
        try {
          children.push((await call(`${userId}/media`, params)).id);
        } catch (e) {
          if (!params.alt_text) throw e;
          useAlt = false; // alt text not accepted here: carry on without it
          delete params.alt_text;
          children.push((await call(`${userId}/media`, params)).id);
        }
      }
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
