// Persistence. Supabase in production; an in-memory version for tests and dry runs.
import { createClient } from '@supabase/supabase-js';

export function supabaseStore({ url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, bucket = process.env.SUPABASE_BUCKET || 'cards' } = {}) {
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const db = createClient(url, key, { auth: { persistSession: false } });
  return {
    async alreadyPosted(key) {
      const { data, error } = await db.from('posts').select('key').eq('key', key).maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async recordPost(row) {
      const { error } = await db.from('posts').insert(row);
      if (error) throw error;
    },
    async logRun(row) {
      await db.from('runs').insert(row); // best effort
    },
    async uploadImage(path, bytes) {
      const { error } = await db.storage.from(bucket).upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
      return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    },
    async getSecret(name) {
      const { data, error } = await db.from('app_secrets').select('value').eq('name', name).maybeSingle();
      if (error) throw error;
      return data?.value || null;
    },
    async setSecret(name, value) {
      const { error } = await db.from('app_secrets').upsert({ name, value, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
  };
}

export function memoryStore(seed = {}) {
  const posts = new Map();
  const secrets = new Map(Object.entries(seed.secrets || {}));
  const runs = [];
  const files = new Map();
  return {
    posts, runs, files, secrets,
    async alreadyPosted(key) { return posts.has(key); },
    async recordPost(row) { posts.set(row.key, row); },
    async logRun(row) { runs.push(row); },
    async uploadImage(path, bytes) { files.set(path, bytes); return `https://example.test/${path}`; },
    async getSecret(name) { return secrets.get(name) || null; },
    async setSecret(name, value) { secrets.set(name, value); },
  };
}
