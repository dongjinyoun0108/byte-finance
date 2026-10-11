// One-time Canva login. Opens Canva's consent page, catches the redirect on 127.0.0.1:3001,
// swaps the code for tokens and stores the refresh token in Supabase (app_secrets).
// In the Canva developer portal, set the redirect URL to: http://127.0.0.1:3001/oauth/callback
import http from 'node:http';
import crypto from 'node:crypto';
import { supabaseStore } from '../src/store.js';

const CLIENT_ID = process.env.CANVA_CLIENT_ID;
const CLIENT_SECRET = process.env.CANVA_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) { console.error('Set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET in .env first.'); process.exit(1); }

const REDIRECT = 'http://127.0.0.1:3001/oauth/callback';
const SCOPES = 'design:content:read design:content:write design:meta:read brandtemplate:meta:read brandtemplate:content:read asset:read';
const verifier = crypto.randomBytes(64).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
const state = crypto.randomBytes(16).toString('hex');

const authUrl = `https://www.canva.com/api/oauth/authorize?${new URLSearchParams({
  code_challenge: challenge, code_challenge_method: 's256', scope: SCOPES, response_type: 'code',
  client_id: CLIENT_ID, state, redirect_uri: REDIRECT,
})}`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  if (url.pathname !== '/oauth/callback') { res.end(); return; }
  try {
    if (url.searchParams.get('state') !== state) throw new Error('state mismatch');
    const code = url.searchParams.get('code');
    if (!code) throw new Error(url.searchParams.get('error') || 'no code');
    const r = await fetch('https://api.canva.com/rest/v1/oauth/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: REDIRECT }),
    });
    const json = await r.json();
    if (!r.ok || !json.refresh_token) throw new Error(JSON.stringify(json));
    await supabaseStore().setSecret('canva_refresh_token', json.refresh_token);
    res.end('Canva connected. You can close this tab.');
    console.log('✅ Canva connected; refresh token saved to Supabase.');
  } catch (e) {
    res.end(`Something went wrong: ${e.message}`);
    console.error('❌', e.message);
  } finally {
    server.close();
  }
});
server.listen(3001, '127.0.0.1', () => console.log(`Open this link and click Allow:\n\n${authUrl}\n`));
