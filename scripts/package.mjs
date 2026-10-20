// Zips the built extension folder: dist/world-time-ruler-<version>.zip → world-time-ruler/manifest.json …
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const manifest = JSON.parse(readFileSync(path.join(dist, 'world-time-ruler/manifest.json'), 'utf8'));
const zip = `world-time-ruler-${manifest.version}.zip`;
if (existsSync(path.join(dist, zip))) rmSync(path.join(dist, zip));
execFileSync('zip', ['-r', '-X', '-q', zip, 'world-time-ruler', '-x', '*.DS_Store'], { cwd: dist });
console.log(`dist/${zip} (${(statSync(path.join(dist, zip)).size / 1024).toFixed(0)} KB)`);
