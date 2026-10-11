// Manual run from your laptop.
//   npm run dry-run            fetch data + write stories, print the slides and caption. Posts nothing.
//   npm run preview            same, plus fills Canva and saves the JPGs into ./preview. Posts nothing.
//   node --env-file=.env scripts/run-once.js --post   post right now (ignores the 7:25am window).
import { mkdir, writeFile } from 'node:fs/promises';
import { runMorning } from '../src/morning.js';
import { supabaseStore, memoryStore } from '../src/store.js';
import { instagram, instagramToken } from '../src/instagram.js';

const args = new Set(process.argv.slice(2));
const post = args.has('--post');
const canva = args.has('--canva');
const dryRun = !post && !canva;

const store = post || canva ? supabaseStore() : memoryStore();
const result = await runMorning({
  force: true,
  dryRun,
  renderOnly: canva && !post,
  deps: { store, ig: post ? instagram({ token: await instagramToken({ store }) }) : null },
});

const { data, caption, exportUrls, ...rest } = result;
console.log(JSON.stringify(rest, null, 2));
if (data) {
  console.log('\n--- Slide text ---');
  for (const [k, v] of Object.entries(data)) if (v.type === 'text') console.log(`${k.padEnd(16)} ${v.text.replace(/\n/g, ' / ')}`);
}
console.log('\n--- Caption ---\n' + (caption || '(none)'));

if (exportUrls) {
  await mkdir('preview', { recursive: true });
  for (const [i, url] of exportUrls.entries()) {
    const res = await fetch(url);
    await writeFile(`preview/slide-${i + 1}.jpg`, Buffer.from(await res.arrayBuffer()));
  }
  console.log(`\nSaved ${exportUrls.length} slides to ./preview (Canva design ${result.designId}).`);
}
