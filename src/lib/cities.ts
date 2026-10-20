import raw from '../data/cities.json';

export interface City {
  /** Stable id: "gn" + GeoNames geonameid. */
  id: string;
  name: string;
  country: string;
  cc: string;
  tz: string;
  lat: number;
  lon: number;
  pop: number;
  /** Part of the design handoff's map set (always drawn as a dot). */
  map: boolean;
  capital: boolean;
  /** Pre-folded search text: name, ascii name, country, alt country name, country code. */
  key: string;
  nameKey: string;
}

type Row = [string, string, string | 0, string, string, string, number, number, number, number, string | 0];

export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').toLowerCase().replace(/[^a-z0-9/_ ]+/g, ' ').replace(/\s+/g, ' ').trim();

const rows = raw.rows as unknown as Row[];
export const CITIES: City[] = rows.map(r => {
  const nameKey = fold(r[1]);
  const ascii = r[2] ? fold(r[2]) : '';
  return {
    id: r[0], name: r[1], country: r[3], cc: r[4], tz: r[5], lat: r[6], lon: r[7], pop: r[8],
    map: !!(r[9] & 1), capital: !!(r[9] & 4), nameKey,
    key: [nameKey, ascii !== nameKey ? ascii : '', fold(r[3]), r[10] ? fold(r[10]) : '', r[4].toLowerCase()].filter(Boolean).join(' | '),
  };
});
export const CITY_BY_ID = new Map(CITIES.map(c => [c.id, c]));
export const DEFAULT_RULER: string[] = rows.filter(r => r[9] & 2).map(r => r[0]);
export const DEFAULT_HOME = CITIES.find(c => c.name === 'Istanbul' && c.cc === 'TR')!.id;
export const MAP_CITIES = CITIES.filter(c => c.map);
const byName = (name: string, cc: string) => CITIES.find(c => c.name === name && c.cc === cc)!.id;
/** Always drawn on the map with a name and time label, like ruler cities, without taking a ruler slot (1.1). */
export const MAP_LABELLED: string[] = [
  ['Santiago', 'CL'], ['San Juan', 'PR'], ['Montréal', 'CA'], ['Rio de Janeiro', 'BR'], ['Madrid', 'ES'], ['Beirut', 'LB'], ['Tehran', 'IR'], ['Ho Chi Minh City', 'VN'],
  ['Shanghai', 'CN'], ['Tripoli', 'LY'], ['Freetown', 'SL'], ['Yaoundé', 'CM'], ['Bogotá', 'CO'], ['Panama City', 'PA'], ['La Paz', 'BO'], ['Caracas', 'VE'],
  ['Miami', 'US'], ['Denver', 'US'], ['Salt Lake City', 'US'], ['Las Vegas', 'US'], ['Seattle', 'US'],
  ['Lagos', 'NG'], ['Accra', 'GH'], ['Karachi', 'PK'], ['Kathmandu', 'NP'], ['Dhaka', 'BD'],
  ['Sydney', 'AU'], ['Auckland', 'NZ'], ['Cape Town', 'ZA'],
  ['Toronto', 'CA'], ['Islamabad', 'PK'], ['Paris', 'FR'], ['Copenhagen', 'DK'],
].map(([n, cc]) => byName(n, cc));
export const DATA_SOURCE = raw.source;
export const MAX_RULER = 10;

export const GMT_CITY: City = { id: 'gmt', name: 'GMT', country: 'UTC+0', cc: '', tz: 'Etc/UTC', lat: 51.48, lon: 0, pop: 0, map: false, capital: false, key: 'gmt utc', nameKey: 'gmt' };

/** Search by city name, country, country code or IANA zone. Every term must match. */
export function searchCities(query: string, limit = 40): City[] {
  const terms = fold(query).split(' ').filter(Boolean);
  if (!terms.length) return [];
  const q = terms.join(' ');
  const scored: { c: City; s: number }[] = [];
  for (const c of CITIES) {
    const tzKey = c.tz.toLowerCase();
    let ok = true;
    for (const t of terms) if (!c.key.includes(t) && !tzKey.includes(t)) { ok = false; break; }
    if (!ok) continue;
    const s = c.nameKey === q ? 0 : c.nameKey.startsWith(q) ? 1 : c.nameKey.includes(q) ? 2 : 3;
    scored.push({ c, s });
  }
  scored.sort((a, b) => a.s - b.s || Number(b.c.map) - Number(a.c.map) || b.c.pop - a.c.pop);
  return scored.slice(0, limit).map(x => x.c);
}
