// Fetches the morning news feeds and commits them as posts/<folder>/feed.json for the scheduled Claude writer.
// (The writer can't read the feeds itself: its web-fetch tool needs a person to approve each site.)
//   node scripts/fetch-feeds.js [--folder=YYYY-MM-DD]     default: today's Sydney date
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { FEEDS } from '../src/config.js';
import { fetchNews } from '../src/sources/news.js';
import { sydney } from '../src/time.js';

const folder = (process.argv.find((a) => a.startsWith('--folder=')) || '').slice(9) || sydney(new Date()).dateKey;
if (!/^[\w-]+$/.test(folder)) throw new Error(`bad folder name ${folder}`);
const { items, errors } = await fetchNews(FEEDS, { now: new Date() });
const dir = `posts/${folder}`;
await mkdir(dir, { recursive: true });
await writeFile(`${dir}/feed.json`, JSON.stringify({ fetchedAt: new Date().toISOString(), items, errors }, null, 1));
console.log(`${items.length} items, ${errors.length} feed errors -> ${dir}/feed.json`);
if (errors.length) console.log(JSON.stringify(errors, null, 1));

if (process.env.GITHUB_ACTIONS) {
  const git = (...a) => execFileSync('git', a, { stdio: 'inherit' });
  git('add', `${dir}/feed.json`);
  git('-c', 'user.name=byte-finance-bot', '-c', 'user.email=bot@users.noreply.github.com', 'commit', '-m', `Feed for ${folder}`);
  for (let i = 0; i < 3; i++) {
    try { git('pull', '--rebase', '--autostash', 'origin', 'main'); git('push', 'origin', 'HEAD:main'); break; } catch (e) { if (i === 2) throw e; }
  }
}
