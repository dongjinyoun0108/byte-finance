// Weekend "Money explained" carousel: cover + 4 steps + outro, from the fixed topic bank in explainers.js.
import { pickTopic, WEEKEND_BASE_HASHTAGS } from './explainers.js';
import { DISCLAIMER, MAX_HASHTAGS } from './config.js';
import { sydney, coverDate } from './time.js';
import { explainerCover, storySlide, outroSlide, FIELDS } from '../render/slides.js';

const SLOTS = ['aus', 'us', 'biz', 'aus']; // colour fields for the four steps
const STEP_POSES = ['thinking', 'newspaper', 'coffee', 'finger_gun'];
const HOOKS = ['Weekend money lesson ☕', 'Your 60-second money lesson 🪙', 'Money explained, no jargon ☕', 'Learn this once, use it forever 📌'];
const CTAS = ['Save this for later 📌 and send it to a mate who always asks.', 'Save this so you have it handy 📌', 'Send this to someone who’s always asking 👀', 'Which topic should we explain next? Tell us below 👇'];

export function prepareWeekend({ now = new Date() } = {}) {
  const day = sydney(now);
  const topic = pickTopic(day.dateKey);
  const i = topic.id.length; // small, stable variety per topic
  const title = topic.title.replace(/\n/g, ' ');
  const slides = [{ name: '1-cover', html: explainerCover({ title: topic.title, steps: topic.steps, pose: topic.pose, date: coverDate(now) }) }];
  topic.steps.forEach((s, k) => {
    slides.push({
      name: `${k + 2}-step`,
      html: storySlide({
        slot: SLOTS[k], n: k + 1, of: topic.steps.length, tag: 'Money explained', headline: s.head, body: s.body, why: '',
        pose: k === 0 && topic.pose === STEP_POSES[0] ? 'coffee' : STEP_POSES[k] === topic.pose ? 'thinking' : STEP_POSES[k],
        figure: s.figure || '', figureLabel: s.figureLabel || '', text: ['word', 'line', 'popword', 'word'][k],
      }),
    });
  });
  slides.push({
    name: `${slides.length + 1}-outro`,
    html: outroSlide({ pose: 'cbd_strut', handle: '@byte.finance.au', disclaimer: DISCLAIMER, headline: 'Save this\nfor later', ribbon: 'Weekday market news at 7:30am  ✦  Byte Finance  ✦', cta: 'Follow @byte.finance.au' }),
  });

  const tags = [...WEEKEND_BASE_HASHTAGS, ...topic.tags].filter((t, k, a) => a.indexOf(t) === k).slice(0, MAX_HASHTAGS);
  const caption = [
    HOOKS[i % HOOKS.length],
    `Money explained: ${title}`,
    '',
    ...topic.steps.map((s, k) => `${k + 1}. ${s.head}`),
    '',
    CTAS[i % CTAS.length],
    'Weekday mornings: Aussie market news at 7:30am. Follow @byte.finance.au',
    '',
    DISCLAIMER,
    '',
    tags.join(' '),
  ].join('\n');
  const alts = [
    `Money explained: ${title}. Four things to know: ${topic.steps.map((s) => s.head).join('; ')}.`,
    ...topic.steps.map((s, k) => `Step ${k + 1}: ${s.head}. ${s.figure ? `${s.figure}, ${s.figureLabel}. ` : ''}${s.body}`),
    'Save this for later. Follow @byte.finance.au for Aussie market news every weekday at 7:30am.',
  ];
  return { key: day.dateKey, topic: topic.id, slides, caption, alts, bg: FIELDS.cover.bg };
}
