import { CITY_BY_ID, DEFAULT_HOME, DEFAULT_RULER, MAP_LABELLED, MAX_RULER } from './cities';

export type Theme = 'dark' | 'light';
export interface Prefs {
  v: 1;
  /** Saved ruler city ids (max 10). Display order is derived from UTC offset, not from this array. */
  ruler: string[];
  /** Home city id; always a member of `ruler`. */
  home: string;
  hour12: boolean;
  theme: Theme;
  /** Labelled map cities (saved or always-labelled) whose name + time label is switched off; they stay as dots. */
  labelsOff: string[];
  /** Plain map dots the user switched a name + time label on for. */
  labelsOn: string[];
}

export const defaultPrefs = (): Prefs => ({ v: 1, ruler: [...DEFAULT_RULER], home: DEFAULT_HOME, hour12: true, theme: 'dark', labelsOff: [], labelsOn: [] });

/** Accept anything from storage and return valid prefs (unknown ids dropped, home repaired). */
export function sanitizePrefs(raw: unknown): Prefs {
  const d = defaultPrefs();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const seen = new Set<string>();
  let ruler = Array.isArray(r.ruler) ? r.ruler.filter((id): id is string => typeof id === 'string' && CITY_BY_ID.has(id) && !seen.has(id) && !!seen.add(id)) : d.ruler;
  ruler = ruler.slice(0, MAX_RULER);
  if (!ruler.length) ruler = d.ruler;
  const home = typeof r.home === 'string' && ruler.includes(r.home) ? r.home : ruler.includes(d.home) ? d.home : ruler[0];
  const ids = (v: unknown, keep: (id: string) => boolean) => {
    const seen = new Set<string>();
    return Array.isArray(v) ? v.filter((id): id is string => typeof id === 'string' && CITY_BY_ID.has(id) && keep(id) && !seen.has(id) && !!seen.add(id)) : [];
  };
  const labelsOff = ids(r.labelsOff, () => true);
  const labelsOn = ids(r.labelsOn, id => !!CITY_BY_ID.get(id)!.map && !labelsOff.includes(id)); // only map dots can gain a label
  return { v: 1, ruler, home, hour12: typeof r.hour12 === 'boolean' ? r.hour12 : d.hour12, theme: r.theme === 'light' ? 'light' : 'dark', labelsOff, labelsOn };
}

export type OpResult = { ok: true; prefs: Prefs } | { ok: false; reason: 'duplicate' | 'full' | 'unknown' | 'home' | 'last' | 'not-saved' };

export function addCity(p: Prefs, id: string): OpResult {
  if (!CITY_BY_ID.has(id)) return { ok: false, reason: 'unknown' };
  if (p.ruler.includes(id)) return { ok: false, reason: 'duplicate' };
  if (p.ruler.length >= MAX_RULER) return { ok: false, reason: 'full' };
  return { ok: true, prefs: { ...p, ruler: [...p.ruler, id] } };
}

/** Swap a saved city for a new one. The home city cannot be replaced (change home first). */
export function replaceCity(p: Prefs, removeId: string, addId: string): OpResult {
  if (!CITY_BY_ID.has(addId)) return { ok: false, reason: 'unknown' };
  if (p.ruler.includes(addId)) return { ok: false, reason: 'duplicate' };
  if (!p.ruler.includes(removeId)) return { ok: false, reason: 'not-saved' };
  if (removeId === p.home) return { ok: false, reason: 'home' };
  return { ok: true, prefs: { ...p, ruler: p.ruler.map(x => (x === removeId ? addId : x)) } };
}

/** Removing the home city requires `newHome` (another saved city). */
export function removeCity(p: Prefs, id: string, newHome?: string): OpResult {
  if (!p.ruler.includes(id)) return { ok: false, reason: 'not-saved' };
  if (p.ruler.length <= 1) return { ok: false, reason: 'last' };
  let home = p.home;
  if (id === p.home) {
    if (!newHome || newHome === id || !p.ruler.includes(newHome)) return { ok: false, reason: 'home' };
    home = newHome;
  }
  return { ok: true, prefs: { ...p, ruler: p.ruler.filter(x => x !== id), home } };
}

/**
 * Show or hide a city's map label. Cities labelled by default (saved or always-labelled) go into `labelsOff` when hidden;
 * plain map dots go into `labelsOn` when shown. Either list only ever holds the ids that differ from the default.
 */
export function setLabel(p: Prefs, id: string, on: boolean): OpResult {
  const city = CITY_BY_ID.get(id);
  if (!city) return { ok: false, reason: 'unknown' };
  const byDefault = p.ruler.includes(id) || MAP_LABELLED.includes(id);
  const without = (xs: string[]) => xs.filter(x => x !== id);
  const with_ = (xs: string[]) => (xs.includes(id) ? xs : [...xs, id]);
  const labelsOff = on || !byDefault ? without(p.labelsOff) : with_(p.labelsOff);
  const labelsOn = !on || byDefault || !city.map ? without(p.labelsOn) : with_(p.labelsOn);
  return { ok: true, prefs: { ...p, labelsOff, labelsOn } };
}

export function setHome(p: Prefs, id: string): OpResult {
  if (!p.ruler.includes(id)) return { ok: false, reason: 'not-saved' };
  return { ok: true, prefs: { ...p, home: id } };
}
