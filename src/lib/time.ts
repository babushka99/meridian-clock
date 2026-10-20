// Time-zone conversion. Uses the bundled Temporal implementation (not the prototype's Intl round-trip
// shortcut) so gap / repeated wall times are detected explicitly rather than silently shifted.
import { Temporal } from 'temporal-polyfill/implementation';

export const MINUTE = 60_000;
export const DAY = 86_400_000;

export interface Wall { y: number; mo: number; d: number; h: number; mi: number }
export interface ZonedParts extends Wall {
  /** Offset from UTC in minutes at this instant (east positive). */
  offsetMin: number;
  /** Days since 1970-01-01 of the local calendar date; used for date-line deltas. */
  epochDay: number;
  /** 0 = Sunday … 6 = Saturday. */
  dow: number;
}

export function zonedParts(ms: number, tz: string): ZonedParts {
  const z = Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(tz);
  return {
    y: z.year, mo: z.month, d: z.day, h: z.hour, mi: z.minute,
    offsetMin: Math.round(z.offsetNanoseconds / 6e10),
    epochDay: Math.round(Date.UTC(z.year, z.month - 1, z.day) / DAY),
    dow: z.dayOfWeek % 7,
  };
}

export const offsetMinutes = (ms: number, tz: string) => zonedParts(ms, tz).offsetMin;

/** First instant of the local calendar date (not always 00:00 — some zones skip midnight). */
export function startOfLocalDay(tz: string, y: number, mo: number, d: number): number {
  return Temporal.PlainDate.from({ year: y, month: mo, day: d }).toZonedDateTime(tz).epochMilliseconds;
}

/** [start, end) instants of a local calendar date. 23 h or 25 h long on DST change dates. */
export function localDayWindow(tz: string, y: number, mo: number, d: number): [number, number] {
  const date = Temporal.PlainDate.from({ year: y, month: mo, day: d });
  return [date.toZonedDateTime(tz).epochMilliseconds, date.add({ days: 1 }).toZonedDateTime(tz).epochMilliseconds];
}

export function isValidDate(y: number, mo: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return false;
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

export interface Occurrence { utc: number; offsetMin: number }
export type WallResolution =
  | { kind: 'ok'; utc: number; offsetMin: number }
  /** The wall time happens twice (clocks set back). Both instants, earliest first. */
  | { kind: 'ambiguous'; options: [Occurrence, Occurrence] }
  /** The wall time never happens (clocks set forward). Local wall times bounding the skipped range. */
  | { kind: 'gap'; transitionUtc: number; gapStart: Wall; gapEnd: Wall };

/** Interpret a wall-clock date/time in an IANA zone. Never guesses on gaps or repeats. */
export function resolveWall(tz: string, w: Wall): WallResolution {
  const pdt = Temporal.PlainDateTime.from({ year: w.y, month: w.mo, day: w.d, hour: w.h, minute: w.mi }, { overflow: 'reject' });
  const earlier = pdt.toZonedDateTime(tz, { disambiguation: 'earlier' });
  const later = pdt.toZonedDateTime(tz, { disambiguation: 'later' });
  const a = earlier.epochMilliseconds, b = later.epochMilliseconds;
  const off = (z: typeof earlier) => Math.round(z.offsetNanoseconds / 6e10);
  if (a === b) return { kind: 'ok', utc: a, offsetMin: off(earlier) };
  if (earlier.toPlainDateTime().equals(pdt)) {
    return { kind: 'ambiguous', options: [{ utc: a, offsetMin: off(earlier) }, { utc: b, offsetMin: off(later) }] };
  }
  // Gap: 'earlier' lands before the transition, 'later' after it. Bisect for the transition instant.
  const before = off(earlier), after = off(later);
  let lo = a, hi = b;
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2000) * 1000;
    if (offsetMinutes(mid, tz) === before) lo = mid; else hi = mid;
  }
  const wallAt = (ms: number, offsetMin: number): Wall => {
    const t = new Date(ms + offsetMin * MINUTE);
    return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes() };
  };
  return { kind: 'gap', transitionUtc: hi, gapStart: wallAt(hi, before), gapEnd: wallAt(hi, after) };
}

// ---------- formatting ----------
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateFmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts });
const F_WD = dateFmt({ weekday: 'short' }), F_WDL = dateFmt({ weekday: 'long' });
const F_SHORT = dateFmt({ month: 'short', day: 'numeric' });
const F_LONG = dateFmt({ month: 'long', day: 'numeric', year: 'numeric' });
const asUtc = (p: { y: number; mo: number; d: number }) => Date.UTC(p.y, p.mo - 1, p.d);

/** All labels derive from the real calendar date — never from sample copy. */
export const weekdayShort = (p: { y: number; mo: number; d: number }) => F_WD.format(asUtc(p));
export const weekdayLong = (p: { y: number; mo: number; d: number }) => F_WDL.format(asUtc(p));
export const monthDay = (p: { y: number; mo: number; d: number }) => F_SHORT.format(asUtc(p));
export const longDate = (p: { y: number; mo: number; d: number }) => F_LONG.format(asUtc(p));
export const isoDate = (p: { y: number; mo: number; d: number }) =>
  `${String(p.y).padStart(4, '0')}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;

export interface TimeText { main: string; suffix: '' | 'AM' | 'PM' }
export function fmtClock(h: number, mi: number, hour12: boolean): TimeText {
  const mm = String(mi).padStart(2, '0');
  if (!hour12) return { main: `${String(h).padStart(2, '0')}:${mm}`, suffix: '' };
  return { main: `${h % 12 || 12}:${mm}`, suffix: h < 12 ? 'AM' : 'PM' };
}
export const clockStr = (h: number, mi: number, hour12: boolean) => {
  const t = fmtClock(h, mi, hour12);
  return t.suffix ? `${t.main} ${t.suffix}` : t.main;
};
/** Format an instant as a clock time in a zone. */
export const clockAt = (ms: number, tz: string, hour12: boolean) => {
  const p = zonedParts(ms, tz);
  return clockStr(p.h, p.mi, hour12);
};

export function diffLabel(min: number): string {
  if (!min) return 'HOME';
  const a = Math.abs(min), h = Math.floor(a / 60), m = a % 60;
  return `${min < 0 ? '−' : '+'}${h}h${m ? ` ${String(m).padStart(2, '0')}m` : ''}`;
}
export function diffSpoken(min: number, homeName: string): string {
  if (!min) return `same time as ${homeName}`;
  const a = Math.abs(min), h = Math.floor(a / 60), m = a % 60;
  const parts = [h ? `${h} hour${h === 1 ? '' : 's'}` : '', m ? `${m} minutes` : ''].filter(Boolean).join(' ');
  return `${parts} ${min < 0 ? 'behind' : 'ahead of'} ${homeName}`;
}
export function utcLabel(offsetMin: number): string {
  const a = Math.abs(offsetMin), h = Math.floor(a / 60), m = a % 60;
  return `UTC${offsetMin < 0 ? '−' : '+'}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

// ---------- editor input parsing ----------
export type ParsedDate = { ok: true; y: number; mo: number; d: number } | { ok: false; error: string };
export function parseDateInput(text: string): ParsedDate {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text.trim());
  if (!m) return { ok: false, error: 'Enter a date as YYYY-MM-DD' };
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 1900 || y > 2200) return { ok: false, error: 'Year must be between 1900 and 2200' };
  if (!isValidDate(y, mo, d)) return { ok: false, error: `${text.trim()} is not a calendar date` };
  return { ok: true, y, mo, d };
}

export type ParsedTime = { ok: true; h: number; mi: number } | { ok: false; error: string };
/** `meridiem` is the AM/PM toggle (12h mode only). A typed am/pm suffix wins over the toggle. */
export function parseTimeInput(text: string, hour12: boolean, meridiem: 'AM' | 'PM'): ParsedTime {
  const m = /^(\d{1,2})(?:[:.](\d{2}))?\s*([ap])?\.?m?\.?$/i.exec(text.trim());
  const example = hour12 ? 'Enter a time like 5:30' : 'Enter a time like 17:30';
  if (!m) return { ok: false, error: example };
  let h = +m[1];
  const mi = +(m[2] ?? 0);
  const typed = m[3] ? (m[3].toLowerCase() === 'a' ? 'AM' : 'PM') : null;
  if (mi > 59) return { ok: false, error: 'Minutes must be 00–59' };
  if (hour12 || typed) {
    const mer = typed ?? meridiem;
    if (h >= 1 && h <= 12) h = (h % 12) + (mer === 'PM' ? 12 : 0);
    else if (typed || h > 23) return { ok: false, error: 'Hour must be 1–12 with AM/PM' };
    // 0 or 13–23 without a typed suffix is unambiguous 24-hour input; accept as entered.
  } else if (h > 23) return { ok: false, error: 'Hour must be 00–23' };
  return { ok: true, h, mi };
}
