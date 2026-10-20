import { CIVIL_DEG, HORIZON_DEG, type SolarDay, BAND_SAMPLES } from './solar';
import type { Theme } from './prefs';

// Map palette objects from the design prototype (THEMES.dark / THEMES.light), unchanged.
export const THEMES = {
  dark: { NIGHT: '#1c2742', TWI: '#8a6f4a', GOLD: '#e8d49a', ocean: '#0a0f1c', sphereLine: '#242e47', land: '#1b2440', landLine: '#35425f', border: '#4d5c8080', grat: '#141c2c', gridHalf: '#1c2438', grid: '#2a3550', gridZero: '#35425f', tick: '#35425f', lbl: '#6b7899', lblZero: '#00e5ff', lblEdge: '#4a5570', dayWash: 'rgba(232,212,154,0.05)', night1: 'rgba(5,7,13,0.25)', night2: 'rgba(5,7,13,0.35)', night3: 'rgba(5,7,13,0.3)', term: '#8a6f4a', sun: '#ffb020', sunRing: '#ffb02033', dotStroke: '#0a0f1c', home: '#00e5ff', day: '#e8d49a', dayMinor: '#b3a26f', night: '#5b8dff', nightMinor: '#3a5fb8', diffHome: '#00e5ff', diffNeg: '#a78bfa', diffPos: '#5b8dff', rise: '#ffb020', set: '#a78bfa' },
  light: { NIGHT: '#c9d2e3', TWI: '#e2cfa0', GOLD: '#f2d98a', ocean: '#dfe6f1', sphereLine: '#b7c0d2', land: '#f4f6fa', landLine: '#9aa6bd', border: '#3c486673', grat: '#cfd7e4', gridHalf: '#d6dde9', grid: '#c5cedd', gridZero: '#8b95ad', tick: '#8b95ad', lbl: '#5f6b85', lblZero: '#0084b3', lblEdge: '#8b95ad', dayWash: 'rgba(255,214,102,0.10)', night1: 'rgba(40,55,90,0.14)', night2: 'rgba(40,55,90,0.18)', night3: 'rgba(40,55,90,0.16)', term: '#b8894a', sun: '#e08a00', sunRing: '#e08a0033', dotStroke: '#f7f8fb', home: '#0084b3', day: '#d9a400', dayMinor: '#c4a24a', night: '#2f5fd6', nightMinor: '#7f98dc', diffHome: '#0084b3', diffNeg: '#6d4fd1', diffPos: '#2f5fd6', rise: '#b86e00', set: '#6d4fd1' },
} as const;
export type Palette = { [K in keyof (typeof THEMES)['dark']]: string };
export const palette = (t: Theme): Palette => THEMES[t];

export const diffColor = (T: Palette, diff: number) => (diff === 0 ? T.diffHome : diff < 0 ? T.diffNeg : T.diffPos);

const hex = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const A = hex(a), B = hex(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
/** Altitude at which the band reaches full daylight colour (mirrors the twilight ramp above the horizon). */
const FULL_DAY_DEG = HORIZON_DEG + (HORIZON_DEG - CIVIL_DEG);

function altColor(T: Palette, alt: number): string {
  if (alt <= CIVIL_DEG) return T.NIGHT;
  if (alt < HORIZON_DEG) return mix(T.NIGHT, T.TWI, (alt - CIVIL_DEG) / (HORIZON_DEG - CIVIL_DEG));
  if (alt < FULL_DAY_DEG) return mix(T.TWI, T.GOLD, (alt - HORIZON_DEG) / (FULL_DAY_DEG - HORIZON_DEG));
  return T.GOLD;
}

/** Daylight band: night → civil twilight → day, from the sun's altitude across the local date. */
export function bandGradient(T: Palette, s: SolarDay): string {
  const stops: string[] = [];
  let prev = '';
  s.alts.forEach((alt, i) => {
    const c = altColor(T, alt), next = i < BAND_SAMPLES ? altColor(T, s.alts[i + 1]) : '';
    if (i === 0 || i === BAND_SAMPLES || c !== prev || c !== next) stops.push(`${c} ${((i / BAND_SAMPLES) * 100).toFixed(2)}%`);
    prev = c;
  });
  return `linear-gradient(90deg,${stops.join(',')})`;
}
