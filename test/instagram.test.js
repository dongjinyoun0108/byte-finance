import test from 'node:test';
import assert from 'node:assert/strict';
import { instagram } from '../src/instagram.js';

test('rate limit: waits and retries instead of failing', async () => {
  let n = 0;
  const fetchImpl = async () => {
    n++;
    const body = n === 1 ? { error: { message: 'Application request limit reached' } } : { id: 'M1' };
    return { ok: n !== 1, json: async () => body };
  };
  const ig = instagram({ userId: 'U', token: 'T', fetchImpl, pollMs: 1, limitWaitMs: 1 });
  assert.equal(await ig.publish('C1'), 'M1');
  assert.equal(n, 2);
});

test('other API errors still fail straight away', async () => {
  const fetchImpl = async () => ({ ok: false, json: async () => ({ error: { message: 'Invalid parameter' } }) });
  const ig = instagram({ userId: 'U', token: 'T', fetchImpl, pollMs: 1, limitWaitMs: 1 });
  await assert.rejects(ig.publish('C1'), /Invalid parameter/);
});

test('publish error but the post is live: returns it instead of failing', async () => {
  const now = new Date().toISOString();
  const fetchImpl = async (url) => {
    if (String(url).includes('media_publish')) return { ok: false, json: async () => ({ error: { message: 'Fatal' } }) };
    return { ok: true, json: async () => ({ data: [{ id: 'LIVE', timestamp: now, media_type: 'CAROUSEL_ALBUM', caption: 'Hello\nrest' }] }) };
  };
  const ig = instagram({ userId: 'U', token: 'T', fetchImpl, pollMs: 1, limitWaitMs: 1 });
  assert.equal(await ig.publish('C1', { caption: 'Hello\nother', type: 'CAROUSEL_ALBUM' }), 'LIVE');
});

test('findPosted ignores other types and older posts', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ data: [
    { id: 'R', timestamp: new Date().toISOString(), media_type: 'VIDEO', caption: 'Hello' },
    { id: 'OLD', timestamp: '2020-01-01T00:00:00Z', media_type: 'CAROUSEL_ALBUM', caption: 'Hello' },
  ] }) });
  const ig = instagram({ userId: 'U', token: 'T', fetchImpl, pollMs: 1 });
  assert.equal(await ig.findPosted({ caption: 'Hello', type: 'CAROUSEL_ALBUM', since: Date.now() - 3600e3 }), null);
  assert.equal((await ig.findPosted({ caption: 'Hello', type: 'VIDEO', since: Date.now() - 3600e3 })).id, 'R');
});
