import test from 'node:test';
import assert from 'node:assert/strict';
import { TOPICS, ALL_TOPICS, weekendIndex, pickTopic } from '../src/explainers.js';
import { bannedHits } from '../src/guardrails.js';
import { prepareWeekend } from '../src/weekend.js';

test('weekend topics: no advice/prediction wording, 4 steps, 2 tags each, unique ids', () => {
  assert.equal(new Set(ALL_TOPICS.map((t) => t.id)).size, ALL_TOPICS.length, 'duplicate topic id');
  for (const t of ALL_TOPICS) {
    assert.ok(t.id && t.title && t.pose, `${t.id} missing id/title/pose`);
    assert.ok(t.title.split('\n').every((l) => l.length <= 24), `${t.id} title line over 24 characters`);
    for (const s of t.steps) assert.ok(s.head.length <= 26 && s.body.length <= 130, `${t.id} step too long: ${s.head}`);
    for (const g of t.tags) assert.match(g, /^#[A-Za-z0-9]+$/, `${t.id} bad hashtag`);
    assert.equal(t.steps.length, 4, t.id);
    assert.equal(t.tags.length, 2, t.id);
    const text = [t.title, ...t.steps.flatMap((s) => [s.head, s.body, s.figure || '', s.figureLabel || ''])].join('\n');
    assert.deepEqual(bannedHits(text), [], t.id);
    for (const s of t.steps) assert.ok(!s.figure || s.figure.length <= 8, `${t.id} figure too long`);
  }
});

test('weekend rotation: Sat and Sun get consecutive topics, no repeats for 6 weeks', () => {
  assert.equal(weekendIndex('2026-10-11'), 0);
  assert.equal(weekendIndex('2026-10-17'), 1);
  assert.equal(weekendIndex('2026-10-18'), 2);
  assert.equal(weekendIndex('2026-10-24'), 3);
  const seen = new Set();
  for (let w = 0; w < 6; w++) for (const d of [0, 1]) {
    const key = new Date(Date.parse('2026-10-11T00:00:00Z') + (w * 7 + d * 6) * 86400e3).toISOString().slice(0, 10);
    seen.add(pickTopic(key, TOPICS).id);
  }
  assert.equal(seen.size, 12);
});

test('weekend post: 6 slides, caption with disclaimer and max 5 hashtags', () => {
  const p = prepareWeekend({ now: new Date('2026-10-16T22:00:00Z') }); // Sat 17 Oct, 9am Sydney
  assert.equal(p.slides.length, 6);
  assert.match(p.caption, /General information only/);
  const tags = p.caption.trim().split('\n').pop().split(' ');
  assert.ok(tags.length <= 5 && tags.every((t) => t.startsWith('#')));
  assert.equal(p.alts.length, 6);
});
