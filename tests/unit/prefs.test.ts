import { describe, expect, it } from 'vitest';
import { CITIES, DEFAULT_HOME, DEFAULT_RULER, MAP_LABELLED, MAX_RULER, searchCities } from '../../src/lib/cities';
import { placeLabels } from '../../src/lib/labels';
import { addCity, defaultPrefs, removeCity, replaceCity, sanitizePrefs, setHome, setLabel } from '../../src/lib/prefs';
import { buildModel } from '../../src/lib/model';

const id = (name: string, cc?: string) => CITIES.find(c => c.name === name && (!cc || c.cc === cc))!.id;

describe('defaults', () => {
  it("ten prototype ruler cities, Istanbul (Türkiye) home", () => {
    const p = defaultPrefs();
    expect(p.ruler.map(x => CITIES.find(c => c.id === x)!.name)).toEqual(['San Francisco', 'Chicago', 'New York', 'London', 'Berlin', 'Istanbul', 'Dubai', 'Mumbai', 'Singapore', 'Tokyo']);
    const home = CITIES.find(c => c.id === p.home)!;
    expect([home.name, home.country, home.tz]).toEqual(['Istanbul', 'Türkiye', 'Europe/Istanbul']);
    expect(p).toMatchObject({ hour12: true, theme: 'dark' });
  });
});

describe('city operations', () => {
  const nine = { ...defaultPrefs(), ruler: DEFAULT_RULER.slice(0, 9).includes(DEFAULT_HOME) ? DEFAULT_RULER.slice(0, 9) : DEFAULT_RULER.slice(1) };
  it('adds, prevents duplicates, enforces the ten-city limit', () => {
    const r = addCity(nine, id('Kathmandu'));
    expect(r.ok && r.prefs.ruler.length).toBe(10);
    expect(addCity(nine, nine.ruler[0])).toEqual({ ok: false, reason: 'duplicate' });
    expect(addCity(defaultPrefs(), id('Kathmandu'))).toEqual({ ok: false, reason: 'full' });
    expect(addCity(nine, 'gn0')).toEqual({ ok: false, reason: 'unknown' });
  });
  it('replaces at the limit, but never the home city or with a duplicate', () => {
    const p = defaultPrefs();
    const r = replaceCity(p, id('Chicago'), id('Kathmandu'));
    expect(r.ok && r.prefs.ruler.length).toBe(MAX_RULER);
    expect(r.ok && r.prefs.ruler.includes(id('Kathmandu')) && !r.prefs.ruler.includes(id('Chicago'))).toBe(true);
    expect(replaceCity(p, p.home, id('Kathmandu'))).toEqual({ ok: false, reason: 'home' });
    expect(replaceCity(p, id('Chicago'), id('Tokyo'))).toEqual({ ok: false, reason: 'duplicate' });
  });
  it('removing home requires a replacement home; the last city cannot be removed', () => {
    const p = defaultPrefs();
    expect(removeCity(p, p.home)).toEqual({ ok: false, reason: 'home' });
    expect(removeCity(p, p.home, p.home)).toEqual({ ok: false, reason: 'home' });
    expect(removeCity(p, p.home, id('Kathmandu'))).toEqual({ ok: false, reason: 'home' });
    const r = removeCity(p, p.home, id('Tokyo'));
    expect(r.ok && r.prefs.home).toBe(id('Tokyo'));
    expect(r.ok && r.prefs.ruler.includes(DEFAULT_HOME)).toBe(false);
    const plain = removeCity(p, id('Chicago'));
    expect(plain.ok && plain.prefs.home).toBe(DEFAULT_HOME);
    expect(removeCity({ ...p, ruler: [p.home] }, p.home, undefined)).toEqual({ ok: false, reason: 'last' });
  });
  it('home must be a saved city', () => {
    const p = defaultPrefs();
    expect(setHome(p, id('Kathmandu'))).toEqual({ ok: false, reason: 'not-saved' });
    const r = setHome(p, id('Tokyo'));
    expect(r.ok && r.prefs.home).toBe(id('Tokyo'));
  });
});

describe('stored data is repaired, not trusted', () => {
  it('handles junk, unknown ids, duplicates, overflow and a missing home', () => {
    expect(sanitizePrefs(undefined)).toEqual(defaultPrefs());
    expect(sanitizePrefs('nope')).toEqual(defaultPrefs());
    expect(sanitizePrefs({ ruler: [] })).toEqual(defaultPrefs());
    const tokyo = id('Tokyo'), ktm = id('Kathmandu');
    const p = sanitizePrefs({ ruler: [tokyo, tokyo, 'gn-bogus', 42, ktm], home: 'gn-bogus', hour12: false, theme: 'light', extra: 1 });
    expect(p).toEqual({ v: 1, ruler: [tokyo, ktm], home: tokyo, hour12: false, theme: 'light', labelsOff: [], labelsOn: [] });
    expect(sanitizePrefs({ ruler: [tokyo], labelsOff: [ktm, ktm, 'gn-bogus', 7] }).labelsOff).toEqual([ktm]);
    const lima = id('Lima', 'PE'), aachen = searchCities('aachen')[0].id; // Aachen is in the search data but not a map dot
    expect(sanitizePrefs({ ruler: [tokyo], labelsOn: [lima, lima, aachen, ktm, 'gn-bogus'], labelsOff: [ktm] }).labelsOn).toEqual([lima]);
    const many = sanitizePrefs({ ruler: CITIES.slice(0, 25).map(c => c.id), home: CITIES[20].id });
    expect(many.ruler.length).toBe(MAX_RULER);
    expect(many.ruler.includes(many.home)).toBe(true);
    // A future schema with extra fields still loads (extension updates keep user data).
    expect(sanitizePrefs({ v: 2, ruler: [ktm], home: ktm, hour12: true, theme: 'dark', future: {} }).ruler).toEqual([ktm]);
  });
});

describe('search', () => {
  it('finds by city, country, country code, diacritics and zone', () => {
    expect(searchCities('kathm')[0].name).toBe('Kathmandu');
    expect(searchCities('sao paulo')[0].name).toBe('São Paulo');
    expect(searchCities('reykjavik')[0].name).toBe('Reykjavík');
    expect(searchCities('nepal').every(c => c.cc === 'NP')).toBe(true);
    expect(searchCities('turkiye').some(c => c.name === 'Istanbul')).toBe(true);
    expect(searchCities('turkey').some(c => c.name === 'Istanbul')).toBe(true);
    expect(searchCities('united kingdom').some(c => c.name === 'London')).toBe(true);
    expect(searchCities('asia/kolkata').some(c => c.name === 'Mumbai')).toBe(true);
    expect(searchCities('zzzzqq')).toEqual([]);
    expect(searchCities('  ')).toEqual([]);
  });
  it('similar names stay distinguishable by country + IANA zone', () => {
    const london = searchCities('london');
    expect(london[0]).toMatchObject({ name: 'London', cc: 'GB', tz: 'Europe/London' });
    expect(london.some(c => c.name === 'London' && c.cc === 'CA' && c.tz === 'America/Toronto')).toBe(true);
    const sj = searchCities('san jose');
    expect(new Set(sj.map(c => c.tz)).size).toBeGreaterThan(1);
    expect(searchCities('london canada')[0].cc).toBe('CA');
  });
  it('worldwide coverage', () => {
    expect(CITIES.length).toBeGreaterThan(5000);
    expect(new Set(CITIES.map(c => c.cc)).size).toBeGreaterThan(200);
    for (const n of ['Kiritimati', 'Nuuk', 'Suva', 'Thimphu', 'Tashkent', 'Lahore', 'Johannesburg', 'Bogotá']) expect(searchCities(n).length, n).toBeGreaterThan(0);
  });
});

describe('map label switches', () => {
  it('switching a label off keeps the city on the map as a dot; switching on restores it; unknown ids are refused', () => {
    const p = defaultPrefs(), miami = id('Miami', 'US'), tokyo = id('Tokyo');
    const off = setLabel(p, miami, false);
    expect(off.ok && off.prefs.labelsOff).toEqual([miami]);
    const again = setLabel(off.ok ? off.prefs : p, miami, false);
    expect(again.ok && again.prefs.labelsOff).toEqual([miami]); // idempotent
    const m = buildModel(Date.UTC(2026, 9, 7), off.ok ? off.prefs : p);
    expect(m.byId.get(miami)!.labelled).toBe(false);
    expect(m.map.some(v => v.city.id === miami)).toBe(true);
    expect(m.byId.get(tokyo)!.labelled).toBe(true);
    const rulerOff = setLabel(off.ok ? off.prefs : p, tokyo, false);
    expect(rulerOff.ok && buildModel(Date.UTC(2026, 9, 7), rulerOff.prefs).byId.get(tokyo)!.labelled).toBe(false);
    expect(rulerOff.ok && buildModel(Date.UTC(2026, 9, 7), rulerOff.prefs).ruler.some(v => v.city.id === tokyo)).toBe(true); // still on the ruler
    const on = setLabel(off.ok ? off.prefs : p, miami, true);
    expect(on.ok && on.prefs.labelsOff).toEqual([]);
    expect(setLabel(p, 'gn0', false)).toEqual({ ok: false, reason: 'unknown' });
  });
  it('a plain map dot can be given a label, and loses it again; a saved city switched off and later removed stays a plain dot', () => {
    const p = defaultPrefs(), lima = id('Lima', 'PE'), tokyo = id('Tokyo');
    expect(buildModel(Date.UTC(2026, 9, 7), p).byId.get(lima)!.labelled).toBe(false);
    const on = setLabel(p, lima, true);
    expect(on.ok && on.prefs.labelsOn).toEqual([lima]);
    expect(on.ok && on.prefs.labelsOff).toEqual([]);
    expect(on.ok && buildModel(Date.UTC(2026, 9, 7), on.prefs).byId.get(lima)!.labelled).toBe(true);
    const off = setLabel(on.ok ? on.prefs : p, lima, false);
    expect(off.ok && off.prefs).toEqual(p); // back to the default: nothing stored either way
    const tokyoOff = setLabel(p, tokyo, false);
    const gone = removeCity(tokyoOff.ok ? tokyoOff.prefs : p, tokyo);
    expect(gone.ok && buildModel(Date.UTC(2026, 9, 7), gone.prefs).byId.get(tokyo)!.labelled).toBe(false);
    const back = setLabel(gone.ok ? gone.prefs : p, tokyo, true);
    expect(back.ok && buildModel(Date.UTC(2026, 9, 7), back.prefs).byId.get(tokyo)!.labelled).toBe(true);
    expect(back.ok && back.prefs.labelsOn).toEqual([tokyo]);
    expect(back.ok && back.prefs.labelsOff).toEqual([]);
  });
});

describe('always-labelled map cities', () => {
  it('thirty-three cities are labelled on the map without being on the ruler', () => {
    const names = MAP_LABELLED.map(x => { const c = CITIES.find(c => c.id === x)!; return `${c.name}, ${c.cc}`; });
    expect(names).toEqual(['Santiago, CL', 'San Juan, PR', 'Montréal, CA', 'Rio de Janeiro, BR', 'Madrid, ES', 'Beirut, LB', 'Tehran, IR', 'Ho Chi Minh City, VN',
      'Shanghai, CN', 'Tripoli, LY', 'Freetown, SL', 'Yaoundé, CM', 'Bogotá, CO', 'Panama City, PA', 'La Paz, BO', 'Caracas, VE',
      'Miami, US', 'Denver, US', 'Salt Lake City, US', 'Las Vegas, US', 'Seattle, US',
      'Lagos, NG', 'Accra, GH', 'Karachi, PK', 'Kathmandu, NP', 'Dhaka, BD', 'Sydney, AU', 'Auckland, NZ', 'Cape Town, ZA',
      'Toronto, CA', 'Islamabad, PK', 'Paris, FR', 'Copenhagen, DK']);
    expect(MAP_LABELLED.some(x => DEFAULT_RULER.includes(x))).toBe(false);
    expect(defaultPrefs().ruler.length).toBe(10); // the ruler is unchanged
  });
});

describe('label placement', () => {
  it('two labelled cities a few pixels apart are pushed to opposite sides', () => {
    const items = [
      { id: 'w', name: 'Beirut', x: 500, y: 100, labelled: true, lon: 35.5 }, { id: 'e', name: 'Damascus', x: 502.5, y: 101, labelled: true, lon: 36.3 },
      { id: 'n', name: 'Istanbul', x: 480, y: 76, labelled: true, lon: 29 },
    ];
    const s = placeLabels(items, 1000);
    expect([s.get('w'), s.get('e')].sort()).toEqual(['left', 'right']);
  });
  it('labels every ruler city and no minor city', () => {
    const items = [
      { id: 'a', name: 'Berlin', x: 500, y: 100, labelled: true, lon: 13 }, { id: 'b', name: 'London', x: 470, y: 102, labelled: true, lon: 0 },
      { id: 'c', name: 'Amsterdam', x: 485, y: 101, labelled: false, lon: 5 }, { id: 'd', name: 'Tokyo', x: 995, y: 140, labelled: true, lon: 139 },
    ];
    const s = placeLabels(items, 1000);
    expect(s.get('c')).toBe('hide');
    for (const k of ['a', 'b', 'd']) expect(s.get(k)).not.toBe('hide');
    expect(s.get('d')).toBe('left'); // nothing may leave the viewport on the right edge
  });
});
