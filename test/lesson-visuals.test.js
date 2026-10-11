import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALL_TOPICS } from '../src/explainers.js';
import { validateVisual } from '../reels/lesson/scripts/validate.mjs';

test('every lesson has a valid Reel diagram in content/lesson-visuals.json', () => {
  const V = JSON.parse(readFileSync(new URL('../content/lesson-visuals.json', import.meta.url), 'utf8'));
  const problems = ALL_TOPICS.flatMap((t) => validateVisual(t, V[t.id]));
  assert.deepEqual(problems, []);
});
