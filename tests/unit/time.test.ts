import { describe, expect, it } from 'vitest';
import { CITIES, CITY_BY_ID } from '../../src/lib/cities';
import { buildModel } from '../../src/lib/model';
import { defaultPrefs } from '../../src/lib/prefs';
import { diffLabel, fmtClock, localDayWindow, monthDay, parseDateInput, parseTimeInput, resolveWall, utcLabel, weekdayShort, zonedParts } from '../../src/lib/time';

const city = (name: string) => CITIES.find(c => c.name === name)!;
const wall = (y: number, mo: number, d: number, h: number, mi: number) => ({ y, mo, d, h, mi });
const at = (ms: number, name: string) => { const p = zonedParts(ms, city(name).tz); return `${p.y}-${p.mo}-${p.d} ${p.h}:${String(p.mi).padStart(2, '0')}`; };
const ok = (tz: string, w: ReturnType<typeof wall>) => { const r = resolveWall(tz, w); if (r.kind !== 'ok') throw new Error(r.kind); return r.utc; };

describe('required conversions', () => {
  it('Oct 7 2026 7:53 AM Istanbul → Tokyo Oct 7 1:53 PM, San Francisco Oct 6 9:53 PM', () => {
    const utc = ok('Europe/Istanbul', wall(2026, 10, 7, 7, 53));
    expect(at(utc, 'Tokyo')).toBe('2026-10-7 13:53');
    expect(at(utc, 'San Francisco')).toBe('2026-10-6 21:53');
    expect(new Date(utc).toISOString()).toBe('2026-10-07T04:53:00.000Z');
  });
  it('Oct 7 2026 5:30 PM New York → Istanbul Oct 8 12:30 AM', () => {
    const utc = ok('America/New_York', wall(2026, 10, 7, 17, 30));
    expect(at(utc, 'Istanbul')).toBe('2026-10-8 0:30');
    const t = fmtClock(0, 30, true);
    expect(`${t.main} ${t.suffix}`).toBe('12:30 AM');
  });
  it('Kathmandu is +2h 45m from Istanbul on both dates', () => {
    for (const utc of [ok('Europe/Istanbul', wall(2026, 10, 7, 7, 53)), ok('America/New_York', wall(2026, 10, 7, 17, 30))]) {
      const m = buildModel(utc, defaultPrefs());
      const k = m.map.find(v => v.city.name === 'Kathmandu')!;
      expect(k.diff).toBe(165);
      expect(diffLabel(k.diff)).toBe('+2h 45m');
    }
  });
  it('New York Nov 1 2026 1:30 AM is ambiguous: both occurrences offered with offsets', () => {
    const r = resolveWall('America/New_York', wall(2026, 11, 1, 1, 30));
    expect(r.kind).toBe('ambiguous');
    if (r.kind !== 'ambiguous') return;
    expect(r.options.map(o => utcLabel(o.offsetMin))).toEqual(['UTC−4', 'UTC−5']);
    expect(r.options.map(o => new Date(o.utc).toISOString())).toEqual(['2026-11-01T05:30:00.000Z', '2026-11-01T06:30:00.000Z']);
  });
  it('New York Mar 8 2026 2:30 AM does not exist: rejected with the skipped range', () => {
    const r = resolveWall('America/New_York', wall(2026, 3, 8, 2, 30));
    expect(r.kind).toBe('gap');
    if (r.kind !== 'gap') return;
    expect([r.gapStart.h, r.gapStart.mi, r.gapEnd.h, r.gapEnd.mi]).toEqual([2, 0, 3, 0]);
    expect(new Date(r.transitionUtc).toISOString()).toBe('2026-03-08T07:00:00.000Z');
  });
});

describe('zone rules', () => {
  it('edges of the New York gap and overlap resolve normally', () => {
    expect(resolveWall('America/New_York', wall(2026, 3, 8, 1, 59)).kind).toBe('ok');
    expect(resolveWall('America/New_York', wall(2026, 3, 8, 2, 0)).kind).toBe('gap');
    expect(resolveWall('America/New_York', wall(2026, 3, 8, 2, 59)).kind).toBe('gap');
    expect(resolveWall('America/New_York', wall(2026, 3, 8, 3, 0)).kind).toBe('ok');
    expect(resolveWall('America/New_York', wall(2026, 11, 1, 0, 59)).kind).toBe('ok');
    expect(resolveWall('America/New_York', wall(2026, 11, 1, 1, 0)).kind).toBe('ambiguous');
    expect(resolveWall('America/New_York', wall(2026, 11, 1, 1, 59)).kind).toBe('ambiguous');
    expect(resolveWall('America/New_York', wall(2026, 11, 1, 2, 0)).kind).toBe('ok');
  });
  it('30-minute gap (Lord Howe) and European rules', () => {
    const lh = resolveWall('Australia/Lord_Howe', wall(2026, 10, 4, 2, 15));
    expect(lh.kind).toBe('gap');
    if (lh.kind === 'gap') expect([lh.gapStart.h, lh.gapStart.mi, lh.gapEnd.h, lh.gapEnd.mi]).toEqual([2, 0, 2, 30]);
    expect(resolveWall('Europe/Berlin', wall(2026, 3, 29, 2, 30)).kind).toBe('gap');
    expect(resolveWall('Europe/Berlin', wall(2026, 10, 25, 2, 30)).kind).toBe('ambiguous');
    // Istanbul has had no DST since 2016.
    expect(resolveWall('Europe/Istanbul', wall(2026, 3, 29, 3, 30)).kind).toBe('ok');
  });
  it('half- and quarter-hour offsets', () => {
    const utc = Date.UTC(2026, 9, 7, 4, 53);
    expect(zonedParts(utc, 'Asia/Kolkata').offsetMin).toBe(330);
    expect(zonedParts(utc, 'Asia/Kathmandu').offsetMin).toBe(345);
    expect(zonedParts(utc, 'Australia/Eucla').offsetMin).toBe(525);
    expect(zonedParts(utc, 'America/St_Johns').offsetMin).toBe(-150);
    expect(zonedParts(utc, 'Pacific/Chatham').offsetMin).toBe(825);
    expect(utcLabel(345)).toBe('UTC+5:45');
    expect(utcLabel(-150)).toBe('UTC−2:30');
    expect(diffLabel(150)).toBe('+2h 30m');
    expect(diffLabel(-600)).toBe('−10h');
  });
  it('date-specific DST: New York is UTC−5 in January and UTC−4 in July; Kyiv alias works', () => {
    expect(zonedParts(Date.UTC(2026, 0, 15, 12), 'America/New_York').offsetMin).toBe(-300);
    expect(zonedParts(Date.UTC(2026, 6, 15, 12), 'America/New_York').offsetMin).toBe(-240);
    expect(zonedParts(Date.UTC(2026, 6, 15, 12), 'Europe/Kiev').offsetMin).toBe(180);
    // Southern hemisphere runs the other way.
    expect(zonedParts(Date.UTC(2026, 0, 15, 12), 'Australia/Sydney').offsetMin).toBe(660);
    expect(zonedParts(Date.UTC(2026, 6, 15, 12), 'Australia/Sydney').offsetMin).toBe(600);
  });
  it('date line: Kiritimati (+14) and Honolulu (−10) share a clock time one day apart', () => {
    const utc = Date.UTC(2026, 9, 7, 10, 0);
    const k = zonedParts(utc, 'Pacific/Kiritimati'), h = zonedParts(utc, 'Pacific/Honolulu');
    expect([k.h, h.h]).toEqual([0, 0]);
    expect(k.epochDay - h.epochDay).toBe(1);
    expect([k.d, h.d]).toEqual([8, 7]);
  });
  it('23-hour and 25-hour local dates', () => {
    const len = (y: number, mo: number, d: number) => { const [a, b] = localDayWindow('America/New_York', y, mo, d); return (b - a) / 3600000; };
    expect(len(2026, 3, 8)).toBe(23);
    expect(len(2026, 11, 1)).toBe(25);
    expect(len(2026, 10, 7)).toBe(24);
  });
  it('every bundled city has a zone the runtime can resolve', () => {
    const zones = new Set(CITIES.map(c => c.tz));
    for (const tz of zones) expect(Number.isFinite(zonedParts(Date.UTC(2026, 9, 7), tz).offsetMin), tz).toBe(true);
    expect(zones.size).toBeGreaterThan(300);
  });
});

describe('model', () => {
  const utc = ok('Europe/Istanbul', wall(2026, 10, 7, 7, 53));
  const m = buildModel(utc, defaultPrefs());
  it('ruler is ten cities + GMT sorted west → east by actual offset', () => {
    expect(m.ruler.map(v => v.city.name)).toEqual(['San Francisco', 'Chicago', 'New York', 'GMT', 'London', 'Berlin', 'Istanbul', 'Dubai', 'Mumbai', 'Singapore', 'Tokyo']);
    const offs = m.ruler.map(v => v.p.offsetMin);
    expect([...offs].sort((a, b) => a - b)).toEqual(offs);
  });
  it('sort follows DST: in January GMT and London tie and New York sits 8h behind Istanbul', () => {
    const jan = buildModel(Date.UTC(2026, 0, 15, 12), defaultPrefs());
    expect(jan.ruler.map(v => v.city.name).slice(3, 5)).toEqual(['GMT', 'London']);
    expect(jan.byId.get(CITIES.find(c => c.name === 'New York')!.id)!.diff).toBe(-480);
    expect(m.byId.get(CITIES.find(c => c.name === 'New York')!.id)!.diff).toBe(-420);
  });
  it('differences and date badges are relative to home', () => {
    const by = (n: string) => m.map.find(v => v.city.name === n)!;
    expect(by('San Francisco').dayDelta).toBe(-1);
    expect(by('Tokyo').dayDelta).toBe(0);
    expect(by('Istanbul').isHome).toBe(true);
    const tokyoHome = buildModel(utc, { ...defaultPrefs(), home: city('Tokyo').id });
    expect(tokyoHome.byId.get(city('Istanbul').id)!.diff).toBe(-360);
    expect(tokyoHome.byId.get(city('San Francisco').id)!.diff).toBe(-960);
  });
  it('weekday/date labels come from the real calendar (Oct 7 2026 is a Wednesday)', () => {
    const p = zonedParts(utc, 'Europe/Istanbul');
    expect(`${weekdayShort(p)}, ${monthDay(p)}`).toBe('Wed, Oct 7');
    const sf = zonedParts(utc, 'America/Los_Angeles');
    expect(`${weekdayShort(sf)}, ${monthDay(sf)}`).toBe('Tue, Oct 6');
  });
  it('always-labelled cities are drawn and labelled but stay off the ruler; DST-correct', () => {
    const by = (n: string) => m.map.find(v => v.city.name === n)!;
    for (const n of ['Santiago', 'San Juan', 'Montréal', 'Rio de Janeiro', 'Madrid', 'Beirut', 'Tehran', 'Ho Chi Minh City', 'Shanghai', 'Tripoli', 'Freetown', 'Yaoundé', 'Bogotá', 'Panama City', 'La Paz', 'Caracas']) {
      expect(by(n), n).toBeDefined();
      expect([by(n).labelled, by(n).ruler], n).toEqual([true, false]);
    }
    expect(m.ruler.some(v => v.city.name === 'Madrid')).toBe(false);
    expect(by('Istanbul').labelled).toBe(true);
    expect(by('Nairobi').labelled).toBe(false);
    expect(by('Santiago').p.offsetMin).toBe(-180); // Chile summer time in October
    expect(by('Beirut').p.offsetMin).toBe(180);    // Lebanon summer time until late October
    expect(by('Tehran').p.offsetMin).toBe(210);    // UTC+3:30, no DST since 2022
    expect(by('Ho Chi Minh City').p.offsetMin).toBe(420);
    expect(by('Caracas').p.offsetMin).toBe(-240);
    expect(by('La Paz').p.offsetMin).toBe(-240);
    expect(by('Yaoundé').p.offsetMin).toBe(60);
    expect(buildModel(Date.UTC(2026, 0, 15, 12), defaultPrefs()).byId.get(by('Beirut').city.id)!.p.offsetMin).toBe(120);
  });
  it('dataset: stable unique ids, valid coordinates, 63 handoff map cities + always-labelled cities outside that set', () => {
    expect(CITY_BY_ID.size).toBe(CITIES.length);
    expect(CITIES.filter(c => c.map).length).toBe(63);
    for (const c of CITIES) { expect(c.id).toMatch(/^gn\d+$/); expect(Math.abs(c.lat) <= 90 && Math.abs(c.lon) <= 180).toBe(true); }
    expect(m.map.length).toBe(63 + 21); // all but Santiago, Caracas, Seattle and Toronto are outside the handoff map set, so they add dots
  });
});

describe('editor input parsing', () => {
  it('dates', () => {
    expect(parseDateInput('2026-10-07')).toMatchObject({ ok: true, y: 2026, mo: 10, d: 7 });
    expect(parseDateInput('2026-02-30').ok).toBe(false);
    expect(parseDateInput('2028-02-29').ok).toBe(true);
    expect(parseDateInput('2026-13-01').ok).toBe(false);
    expect(parseDateInput('10/07/2026').ok).toBe(false);
    expect(parseDateInput('').ok).toBe(false);
  });
  it('12-hour times', () => {
    expect(parseTimeInput('5:30', true, 'PM')).toMatchObject({ ok: true, h: 17, mi: 30 });
    expect(parseTimeInput('12:00', true, 'AM')).toMatchObject({ h: 0, mi: 0 });
    expect(parseTimeInput('12:15', true, 'PM')).toMatchObject({ h: 12, mi: 15 });
    expect(parseTimeInput('7', true, 'AM')).toMatchObject({ h: 7, mi: 0 });
    expect(parseTimeInput('7:53 am', true, 'PM')).toMatchObject({ h: 7, mi: 53 });
    expect(parseTimeInput('17:30', true, 'AM')).toMatchObject({ h: 17, mi: 30 });
    expect(parseTimeInput('13:00 pm', true, 'AM').ok).toBe(false);
    expect(parseTimeInput('5:75', true, 'AM').ok).toBe(false);
    expect(parseTimeInput('abc', true, 'AM').ok).toBe(false);
  });
  it('24-hour times', () => {
    expect(parseTimeInput('17:30', false, 'AM')).toMatchObject({ ok: true, h: 17, mi: 30 });
    expect(parseTimeInput('00:05', false, 'PM')).toMatchObject({ h: 0, mi: 5 });
    expect(parseTimeInput('24:00', false, 'AM').ok).toBe(false);
    expect(parseTimeInput('5:30 PM', false, 'AM')).toMatchObject({ h: 17, mi: 30 });
  });
});
