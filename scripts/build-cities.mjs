// Generates src/data/cities.json from GeoNames (CC BY 4.0) plus the design handoff's map cities.
// Inputs (kept in data-src/ so this runs offline):
//   data-src/cities15000.zip  https://download.geonames.org/export/dump/cities15000.zip
//   data-src/countryInfo.txt  https://download.geonames.org/export/dump/countryInfo.txt
//   data-src/zone-supplement.txt  the most populous GeoNames place for each IANA zone that has no
//     100k+ city (e.g. Pacific/Kiritimati). Regenerated from cities500.zip when that file is present
//     (https://download.geonames.org/export/dump/cities500.zip, 14 MB, not kept in the project).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIN_POPULATION = 100_000;

// The handoff dataset: [name, country label, IANA zone, lat, lon, GeoNames id]. First ten = default ruler.
const BASE = [
  ['San Francisco', 'USA', 'America/Los_Angeles', 37.77, -122.42, 5391959],
  ['Chicago', 'USA', 'America/Chicago', 41.88, -87.63, 4887398],
  ['New York', 'USA', 'America/New_York', 40.71, -74.01, 5128581],
  ['London', 'UK', 'Europe/London', 51.51, -0.13, 2643743],
  ['Berlin', 'Germany', 'Europe/Berlin', 52.52, 13.4, 2950159],
  ['Istanbul', 'Türkiye', 'Europe/Istanbul', 41.01, 28.98, 745044],
  ['Dubai', 'UAE', 'Asia/Dubai', 25.2, 55.27, 292223],
  ['Mumbai', 'India', 'Asia/Kolkata', 19.08, 72.88, 1275339],
  ['Singapore', 'Singapore', 'Asia/Singapore', 1.35, 103.82, 1880252],
  ['Tokyo', 'Japan', 'Asia/Tokyo', 35.68, 139.69, 1850147],
  ['Nairobi', 'Kenya', 'Africa/Nairobi', -1.29, 36.82, 184745],
  ['Lagos', 'Nigeria', 'Africa/Lagos', 6.52, 3.38, 2332459],
  ['Cape Town', 'South Africa', 'Africa/Johannesburg', -33.93, 18.42, 3369157],
  ['Cairo', 'Egypt', 'Africa/Cairo', 30.04, 31.24, 360630],
  ['Riyadh', 'Saudi Arabia', 'Asia/Riyadh', 24.71, 46.68, 108410],
  ['Karachi', 'Pakistan', 'Asia/Karachi', 24.86, 67.01, 1174872],
  ['Kathmandu', 'Nepal', 'Asia/Kathmandu', 27.72, 85.32, 1283240],
  ['Hong Kong', 'Hong Kong SAR', 'Asia/Hong_Kong', 22.32, 114.17, 1819729],
  ['Beijing', 'China', 'Asia/Shanghai', 39.9, 116.4, 1816670],
  ['Seoul', 'South Korea', 'Asia/Seoul', 37.57, 126.98, 1835848],
  ['Auckland', 'New Zealand', 'Pacific/Auckland', -36.85, 174.76, 2193733],
  ['Sydney', 'Australia', 'Australia/Sydney', -33.87, 151.21, 2147714],
  ['Melbourne', 'Australia', 'Australia/Melbourne', -37.81, 144.96, 2158177],
  ['Perth', 'Australia', 'Australia/Perth', -31.95, 115.86, 2063523],
  ['Jakarta', 'Indonesia', 'Asia/Jakarta', -6.21, 106.85, 1642911],
  ['Lisbon', 'Portugal', 'Europe/Lisbon', 38.72, -9.14, 2267057],
  ['Dublin', 'Ireland', 'Europe/Dublin', 53.35, -6.26, 2964574],
  ['Toronto', 'Canada', 'America/Toronto', 43.65, -79.38, 6167865],
  ['Dallas', 'USA', 'America/Chicago', 32.78, -96.8, 4684888],
  ['Mexico City', 'Mexico', 'America/Mexico_City', 19.43, -99.13, 3530597],
  ['Montevideo', 'Uruguay', 'America/Montevideo', -34.9, -56.16, 3441575],
  ['São Paulo', 'Brazil', 'America/Sao_Paulo', -23.55, -46.63, 3448439],
  ['Buenos Aires', 'Argentina', 'America/Argentina/Buenos_Aires', -34.6, -58.38, 3435910],
  ['Halifax', 'Canada', 'America/Halifax', 44.65, -63.57, 6324729],
  ['Edmonton', 'Canada', 'America/Edmonton', 53.55, -113.49, 5946768],
  ['Vancouver', 'Canada', 'America/Vancouver', 49.28, -123.12, 6173331],
  ['Seattle', 'USA', 'America/Los_Angeles', 47.61, -122.33, 5809844],
  ['Bangkok', 'Thailand', 'Asia/Bangkok', 13.76, 100.5, 1609350],
  ['Dhaka', 'Bangladesh', 'Asia/Dhaka', 23.81, 90.41, 1185241],
  ['Dar es Salaam', 'Tanzania', 'Africa/Dar_es_Salaam', -6.79, 39.21, 160263],
  ['Rabat', 'Morocco', 'Africa/Casablanca', 34.02, -6.84, 2538475],
  ['Vilnius', 'Lithuania', 'Europe/Vilnius', 54.69, 25.28, 593116],
  ['Moscow', 'Russia', 'Europe/Moscow', 55.76, 37.62, 524901],
  ['Kyiv', 'Ukraine', 'Europe/Kiev', 50.45, 30.52, 703448],
  ['Reykjavík', 'Iceland', 'Atlantic/Reykjavik', 64.15, -21.94, 3413829],
  ['Oslo', 'Norway', 'Europe/Oslo', 59.91, 10.75, 3143244],
  ['Helsinki', 'Finland', 'Europe/Helsinki', 60.17, 24.94, 658225],
  ['Amsterdam', 'Netherlands', 'Europe/Amsterdam', 52.37, 4.9, 2759794],
  ['Milan', 'Italy', 'Europe/Rome', 45.46, 9.19, 3173435],
  ['Kuala Lumpur', 'Malaysia', 'Asia/Kuala_Lumpur', 3.14, 101.69, 1735161],
  ['Manila', 'Philippines', 'Asia/Manila', 14.6, 120.98, 1701668],
  ['Caracas', 'Venezuela', 'America/Caracas', 10.48, -66.9, 3646738],
  ['Santiago', 'Chile', 'America/Santiago', -33.45, -70.67, 3871336],
  ['Praia', 'Cabo Verde', 'Atlantic/Cape_Verde', 14.93, -23.51, 3374333],
  ['Accra', 'Ghana', 'Africa/Accra', 5.6, -0.19, 2306104],
  ['Addis Ababa', 'Ethiopia', 'Africa/Addis_Ababa', 9.03, 38.74, 344979],
  ['Ulaanbaatar', 'Mongolia', 'Asia/Ulaanbaatar', 47.89, 106.91, 2028462],
  ['Niamey', 'Niger', 'Africa/Niamey', 13.51, 2.11, 2440485],
  ['Tunis', 'Tunisia', 'Africa/Tunis', 36.81, 10.17, 2464470],
  ['Lima', 'Peru', 'America/Lima', -12.05, -77.04, 3936456],
  ['Georgetown', 'Guyana', 'America/Guyana', 6.8, -58.16, 3378644],
  ['Anchorage', 'USA', 'America/Anchorage', 61.22, -149.9, 5879400],
  ['Honolulu', 'USA', 'Pacific/Honolulu', 21.31, -157.86, 5856195],
];

const txt = execFileSync('unzip', ['-p', path.join(root, 'data-src/cities15000.zip'), 'cities15000.txt'], { maxBuffer: 1 << 28 }).toString('utf8');
const countries = {};
for (const line of readFileSync(path.join(root, 'data-src/countryInfo.txt'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const f = line.split('\t');
  countries[f[0]] = f[4];
}
const COUNTRY_LABEL = { TR: 'Türkiye', CV: 'Cabo Verde', US: 'United States', GB: 'United Kingdom', AE: 'United Arab Emirates', HK: 'Hong Kong SAR', MO: 'Macao SAR', CZ: 'Czechia' };
const valid = new Set(Intl.supportedValuesOf('timeZone'));
const zoneOk = tz => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } };

const gn = new Map();
for (const line of txt.split('\n')) {
  if (!line) continue;
  const f = line.split('\t');
  gn.set(+f[0], { id: +f[0], name: f[1], ascii: f[2], lat: +f[4], lon: +f[5], fcode: f[7], cc: f[8], admin1: f[10], pop: +f[14], tz: f[17] });
}

const parse = line => { const f = line.split('\t'); return { id: +f[0], name: f[1], ascii: f[2], lat: +f[4], lon: +f[5], fcode: f[7], cc: f[8], admin1: f[10], pop: +f[14], tz: f[17] }; };
const included = g => (g.pop >= MIN_POPULATION || g.fcode === 'PPLC') && !['PPLX', 'PPLH', 'PPLQ', 'PPLW'].includes(g.fcode);
// GeoNames rows whose zone tag is wrong (Windsor Park is an Auckland suburb tagged Pacific/Chatham).
const MISTAGGED = new Set([13631316]);
const supplementPath = path.join(root, 'data-src/zone-supplement.txt');
if (existsSync(path.join(root, 'data-src/cities500.zip'))) {
  const covered = new Set([...gn.values()].filter(included).map(g => g.tz).concat(BASE.map(b => b[2])));
  const best = new Map();
  const all500 = execFileSync('unzip', ['-p', path.join(root, 'data-src/cities500.zip'), 'cities500.txt'], { maxBuffer: 1 << 29 }).toString('utf8');
  for (const line of all500.split('\n')) {
    if (!line) continue;
    const g = parse(line);
    if (!g.tz || MISTAGGED.has(g.id) || covered.has(g.tz) || ['PPLX', 'PPLH', 'PPLQ', 'PPLW'].includes(g.fcode)) continue;
    const cur = best.get(g.tz);
    if (!cur || g.pop > cur.g.pop) best.set(g.tz, { g, line });
  }
  writeFileSync(supplementPath, [...best.values()].sort((a, b) => a.g.tz.localeCompare(b.g.tz)).map(b => b.line).join('\n') + '\n');
}
const supplement = new Set();
for (const line of readFileSync(supplementPath, 'utf8').split('\n')) {
  if (!line) continue;
  const g = parse(line);
  if (!gn.has(g.id)) gn.set(g.id, g);
  supplement.add(g.id);
}

const out = [];
const used = new Set();
BASE.forEach(([name, country, tz, lat, lon, id], i) => {
  const g = gn.get(id);
  if (!g) throw new Error(`GeoNames id ${id} for ${name} not found`);
  const dist = Math.hypot(g.lat - lat, (g.lon - lon) * Math.cos(lat * Math.PI / 180));
  if (dist > 0.6) throw new Error(`GeoNames id ${id} (${g.name}) is too far from handoff ${name}`);
  used.add(id);
  // ascii carries extra search keys: GeoNames ascii name and the full country name.
  out.push({ id: `gn${id}`, name, ascii: g.ascii, country, cc: g.cc, alt: countries[g.cc], tz, lat, lon, pop: g.pop, map: 1, ...(i < 10 ? { ruler: 1 } : {}) });
});
const skipped = [];
for (const g of gn.values()) {
  if (used.has(g.id)) continue;
  const capital = g.fcode === 'PPLC';
  if (!included(g) && !supplement.has(g.id)) continue; // also drops city sections, historical, abandoned, destroyed places
  if (!g.tz || !(valid.has(g.tz) || zoneOk(g.tz))) { skipped.push(`${g.name} (${g.tz || 'no zone'})`); continue; }
  out.push({ id: `gn${g.id}`, name: g.name, ascii: g.ascii, country: COUNTRY_LABEL[g.cc] ?? countries[g.cc] ?? g.cc, cc: g.cc, tz: g.tz, lat: +g.lat.toFixed(3), lon: +g.lon.toFixed(3), pop: g.pop, ...(capital ? { cap: 1 } : {}) });
}
out.sort((a, b) => (b.map ?? 0) - (a.map ?? 0) || 0);
const head = out.filter(c => c.map), rest = out.filter(c => !c.map).sort((a, b) => b.pop - a.pop);
const all = [...head, ...rest];
// Compact row format keeps the bundle small: see src/data/cities.ts for the decoder.
const rows = all.map(c => [c.id, c.name, c.ascii === c.name ? 0 : c.ascii, c.country, c.cc, c.tz, c.lat, c.lon, c.pop, (c.map ? 1 : 0) | (c.ruler ? 2 : 0) | (c.cap ? 4 : 0), c.alt && c.alt !== c.country ? c.alt : 0]);
mkdirSync(path.join(root, 'src/data'), { recursive: true });
writeFileSync(path.join(root, 'src/data/cities.json'), JSON.stringify({
  source: 'GeoNames cities15000 + countryInfo (https://www.geonames.org/), CC BY 4.0; map-city coordinates, labels and zones from the FK-L001 design handoff.',
  generated: new Date().toISOString().slice(0, 10),
  minPopulation: MIN_POPULATION,
  fields: ['id', 'name', 'ascii', 'country', 'cc', 'tz', 'lat', 'lon', 'pop', 'flags(1=map,2=defaultRuler,4=capital)', 'countryAlt'],
  rows,
}).replace(/\],\[/g, '],\n['));
console.log(`cities: ${all.length} (${head.length} map, ${rest.length} searchable extras, ${supplement.size} zone supplements; ${new Set(all.map(c => c.tz)).size} zones); skipped ${skipped.length}: ${skipped.slice(0, 8).join(', ')}`);
