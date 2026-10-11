// Vercel function. Called at 7:25am Sydney time by the Supabase scheduler (see sql/002_schedule.sql).
// Auth: "Authorization: Bearer $CRON_SECRET". Anything else is rejected.
import { runMorning } from '../src/morning.js';
import { supabaseStore } from '../src/store.js';
import { instagram, instagramToken } from '../src/instagram.js';
import { alert, alertFor } from '../src/alert.js';

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'unauthorised' });

  const job = req.query?.job || 'morning';
  if (job !== 'morning') return res.status(400).json({ error: `unknown job ${job}` });

  let result;
  const store = supabaseStore();
  try {
    result = await runMorning({ deps: { store, ig: instagram({ token: await instagramToken({ store }) }) } });
  } catch (e) {
    console.error(e);
    result = { status: 'error', error: String(e.message || e) };
  }
  const { caption, data, ...summary } = result;
  console.log(JSON.stringify(summary));
  if (!['outside-window', 'already-posted', 'paused'].includes(result.status)) {
    await store.logRun({ job, status: result.status, detail: summary }).catch(() => {});
    const msg = alertFor(result);
    if (msg) await alert(msg);
  }
  return res.status(result.status === 'error' ? 500 : 200).json(summary);
}
