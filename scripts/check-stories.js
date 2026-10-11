// Validates posts/DATE/stories.json with the same guardrails the posting job uses.
//   node scripts/check-stories.js posts/2026-10-12/stories.json
// Exit code 0 = every non-null slot passes. Prints the problems otherwise.
import { readFile } from 'node:fs/promises';
import { acceptDraft } from '../src/writer.js';
import { SLOTS, MOODS } from '../src/config.js';

const file = process.argv[2];
const draft = JSON.parse(await readFile(file, 'utf8'));
if (!Array.isArray(draft.items) || !draft.items.length) { console.error('stories.json needs an "items" array of sources'); process.exit(1); }
const { stories, problems } = acceptDraft({ draft, items: draft.items });
console.log(JSON.stringify({ accepted: Object.keys(stories), problems }, null, 1));
if (Object.keys(problems).length) {
  console.log('\nRules: tags', Object.fromEntries(Object.entries(SLOTS).map(([k, v]) => [k, v.tags])), 'moods', MOODS);
  process.exit(1);
}
