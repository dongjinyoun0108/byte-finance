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
