// Solar geometry, computed locally. Sunrise / sunset / civil twilight instants come from SunCalc;
// the subsolar point (which drives the map terminator) uses the low-precision USNO formula.
// All results are estimates (≈ ±1–2 min at mid latitudes; no terrain or local refraction).
import { getTimes } from 'suncalc';
import { DAY, localDayWindow } from './time';

const rad = Math.PI / 180;
/** Geometric altitude of the sun's centre at sunrise/sunset (refraction + semi-diameter). */
export const HORIZON_DEG = -0.833;
/** Civil twilight limit. */
export const CIVIL_DEG = -6;

/** [longitude, latitude] of the point where the sun is at the zenith. */
export function subsolarPoint(ms: number): [number, number] {
  const d = (ms - Date.UTC(2000, 0, 1, 12)) / DAY;
  const L = (280.46 + 0.9856474 * d) % 360, g = (357.528 + 0.9856003 * d) * rad;
  const lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad, eps = (23.439 - 4e-7 * d) * rad;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam)) / rad;
  const RA = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) / rad;
  const GMST = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
  const lon = ((((RA - GMST * 15) + 540) % 360) + 360) % 360 - 180;
  return [lon, dec];
}

/** "7.4°S 65.8°W" for a [longitude, latitude] pair. */
export const coordLabel = ([lon, lat]: [number, number]) => `${Math.abs(lat).toFixed(1)}°${lat < 0 ? 'S' : 'N'} ${Math.abs(lon).toFixed(1)}°${lon < 0 ? 'W' : 'E'}`;

export const antipode = ([lon, lat]: [number, number]): [number, number] => [lon > 0 ? lon - 180 : lon + 180, -lat];

/** Geometric solar altitude in degrees (no refraction), consistent with the map terminator. */
export function sunAltitude(ms: number, lat: number, lon: number): number {
  const [slon, slat] = subsolarPoint(ms);
  const s = Math.sin(lat * rad) * Math.sin(slat * rad) + Math.cos(lat * rad) * Math.cos(slat * rad) * Math.cos((lon - slon) * rad);
  return Math.asin(Math.max(-1, Math.min(1, s))) / rad;
}
export const isDaylight = (ms: number, lat: number, lon: number) => sunAltitude(ms, lat, lon) > HORIZON_DEG;

export interface SolarDay {
  /** [start, end) instants of the local calendar date. */
  start: number; end: number;
  /** Events falling inside the local date, as instants. null = does not occur on this date. */
  sunrise: number | null; sunset: number | null; dawn: number | null; dusk: number | null;
  /** Set when the sun neither rises nor sets on this local date. */
  polar: 'day' | 'night' | null;
  /** Solar altitude sampled evenly across [start, end] (BAND_SAMPLES + 1 values). */
  alts: number[];
}
export const BAND_SAMPLES = 96;

const cache = new Map<string, SolarDay>();

/**
 * Sun events for a city's *local calendar date* (y-mo-d in tz). The solar day that SunCalc anchors
 * to can straddle local midnight, so events from the neighbouring solar days are gathered and then
 * filtered to the local date's real [start, end) window — which is 23 h / 25 h on DST change dates.
 */
export function solarDay(tz: string, y: number, mo: number, d: number, lat: number, lon: number): SolarDay {
  const key = `${tz}|${y}-${mo}-${d}|${lat}|${lon}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [start, end] = localDayWindow(tz, y, mo, d);
  const mid = (start + end) / 2;
  const found: Record<'sunrise' | 'sunset' | 'dawn' | 'dusk', number[]> = { sunrise: [], sunset: [], dawn: [], dusk: [] };
  for (const k of [-1, 0, 1]) {
    const t = getTimes(new Date(mid + k * DAY), lat, lon);
    for (const name of ['sunrise', 'sunset', 'dawn', 'dusk'] as const) {
      const v = t[name]?.valueOf();
      if (v != null && Number.isFinite(v) && v >= start && v < end && !found[name].some(x => Math.abs(x - v) < 30 * 60_000)) found[name].push(v);
    }
  }
  const first = (a: number[]) => (a.length ? Math.min(...a) : null);
  const last = (a: number[]) => (a.length ? Math.max(...a) : null);
  const alts: number[] = [];
  for (let i = 0; i <= BAND_SAMPLES; i++) alts.push(sunAltitude(start + ((end - start) * i) / BAND_SAMPLES, lat, lon));
  const sunrise = first(found.sunrise), sunset = last(found.sunset);
  const polar = sunrise == null && sunset == null ? (Math.max(...alts) > HORIZON_DEG ? 'day' : 'night') : null;
  const out: SolarDay = { start, end, sunrise, sunset, dawn: first(found.dawn), dusk: last(found.dusk), polar, alts };
  if (cache.size > 600) cache.clear();
  cache.set(key, out);
  return out;
}

/** Position (0–1) of an instant along a local date's band. */
export const bandPos = (s: SolarDay, ms: number) => Math.max(0, Math.min(1, (ms - s.start) / (s.end - s.start)));
