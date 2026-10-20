// Writes THIRD_PARTY_NOTICES.txt (project root + built extension) from the installed packages' licence files.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLED = ['react', 'react-dom', 'scheduler', 'd3-geo', 'd3-array', 'internmap', 'topojson-client', 'world-atlas', 'temporal-polyfill', 'temporal-spec', 'suncalc', '@fontsource-variable/inter', '@fontsource-variable/jetbrains-mono'];

let out = `MERIDIAN CLOCK — THIRD-PARTY NOTICES
====================================

Everything below is bundled inside the extension. Nothing is downloaded at run time.

DATA AND DESIGN ASSETS
----------------------
* City data — GeoNames (https://www.geonames.org/), "cities15000" and "countryInfo" dumps,
  licensed under Creative Commons Attribution 4.0 (https://creativecommons.org/licenses/by/4.0/).
  Filtered to cities of 100,000+ people plus national capitals; each city id is "gn" + the GeoNames
  geonameid. The 63 map cities keep the names, country labels, coordinates and IANA zones supplied
  in the FK-L001 design handoff. Changes were made to the original data (filtering, reformatting).
* Country outlines — Natural Earth 1:110m Admin 0 countries (https://www.naturalearthdata.com/),
  public domain, as packaged by world-atlas (ISC, below).
* Icons — Lucide (https://lucide.dev/), ISC License. Copyright (c) for portions of Lucide are held by
  Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by
  Lucide Contributors 2022.
* Fonts — Inter (Copyright The Inter Project Authors) and JetBrains Mono (Copyright The JetBrains
  Mono Project Authors), both SIL Open Font License 1.1, packaged by Fontsource.
* Time-zone rules — the IANA Time Zone Database (public domain) as shipped inside Chrome (ICU).
* Solar geometry — SunCalc (BSD-2-Clause, below) for sunrise/sunset/twilight; the subsolar point
  uses the public low-precision solar-coordinate formulas published by the U.S. Naval Observatory.

SOFTWARE PACKAGES
-----------------
`;
for (const name of BUNDLED) {
  const dir = path.join(root, 'node_modules', name);
  if (!existsSync(dir)) { if (name === 'temporal-spec') continue; throw new Error(`missing dependency ${name}`); }
  const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const file = readdirSync(dir).find(f => /^licen[sc]e/i.test(f));
  out += `\n${'='.repeat(78)}\n${pkg.name} ${pkg.version} — ${pkg.license}\n${pkg.homepage || pkg.repository?.url || ''}\n${'='.repeat(78)}\n`;
  out += file ? readFileSync(path.join(dir, file), 'utf8').trim() + '\n' : `(no licence file in package; licence: ${pkg.license})\n`;
}
writeFileSync(path.join(root, 'THIRD_PARTY_NOTICES.txt'), out);
const dist = path.join(root, 'dist/meridian-clock');
if (existsSync(dist)) writeFileSync(path.join(dist, 'THIRD_PARTY_NOTICES.txt'), out);
console.log(`THIRD_PARTY_NOTICES.txt written (${BUNDLED.length} packages)`);
