import { TZ } from './config.js';

const WEEKDAYS = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Calendar parts of `now` in Sydney time. */
export function sydney(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-AU', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      hourCycle: 'h23', weekday: 'short', timeZoneName: 'short',
    }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  const tz = /AEDT|\+11/.test(parts.timeZoneName) ? 'AEDT' : 'AEST';
  const hh = Number(parts.hour), mm = Number(parts.minute);
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAYS[parts.weekday.slice(0, 3)],
    hh, mm, hhmm: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, tz,
  };
}

/** "Tue 6 October" — fits the cover date pill. */
export function coverDate(now = new Date()) {
  const f = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'long' });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "7:25am AEDT" */
export function clockLabel(now = new Date()) {
  const s = sydney(now);
  const h12 = ((s.hh + 11) % 12) + 1;
  return `${h12}:${String(s.mm).padStart(2, '0')}${s.hh < 12 ? 'am' : 'pm'} ${s.tz}`;
}

export function inWindow(now, { from, to, weekdays }) {
  const s = sydney(now);
  return weekdays.includes(s.weekday) && s.hhmm >= from && s.hhmm <= to;
}
