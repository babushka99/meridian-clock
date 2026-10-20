// Draws the extension icons (16/32/48/128 px PNG) with no dependencies: a dark tile, a globe ring
// with a night half, a cyan home meridian and a ruler tick row. 4×4 supersampled.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/icons');
mkdirSync(out, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(body)); return Buffer.concat([len, body, c]); };
function png(size, rgba) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const BG = [13, 19, 34], LINE = [53, 66, 95], DAY = [232, 212, 154], NIGHT = [28, 39, 66], CYAN = [0, 229, 255];
// Colour + alpha of a point in unit coordinates (0..1).
function sample(u, v, size) {
  const r = 0.2; // rounded tile
  const qx = Math.max(Math.abs(u - 0.5) - (0.5 - r), 0), qy = Math.max(Math.abs(v - 0.5) - (0.5 - r), 0);
  if (Math.hypot(qx, qy) > r) return [0, 0, 0, 0];
  const small = size <= 16;
  const cx = 0.5, cy = small ? 0.5 : 0.44, R = small ? 0.36 : 0.3;
  const d = Math.hypot(u - cx, v - cy);
  let c = BG;
  if (d <= R) {
    // terminator: an S-curve like the equirectangular day/night boundary
    const edge = cx + 0.06 * Math.sin((v - cy) / R * 1.6);
    c = u < edge ? NIGHT : DAY;
    if (Math.abs(u - (cx + R * 0.38)) < (small ? 0.045 : 0.022)) c = CYAN; // home meridian
  } else if (d <= R + (small ? 0.05 : 0.035)) c = small ? LINE : [107, 120, 153];
  if (!small && v > 0.83 && v < 0.9) { // ruler ticks
    const t = (u - 0.2) / 0.6;
    if (t >= -0.02 && t <= 1.02) { const k = Math.round(t * 6); if (Math.abs(t * 6 - k) < 0.11) c = k === 4 ? CYAN : [168, 179, 204]; }
  }
  if (!small && v > 0.795 && v < 0.815 && u > 0.18 && u < 0.82) c = LINE;
  return [...c, 255];
}
for (const size of [16, 32, 48, 128]) {
  const S = 4, buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const p = sample((x + (i + 0.5) / S) / size, (y + (j + 0.5) / S) / size, size);
      r += p[0] * p[3]; g += p[1] * p[3]; b += p[2] * p[3]; a += p[3];
    }
    const o = (y * size + x) * 4;
    if (a) { buf[o] = Math.round(r / a); buf[o + 1] = Math.round(g / a); buf[o + 2] = Math.round(b / a); }
    buf[o + 3] = Math.round(a / (S * S));
  }
  writeFileSync(path.join(out, `icon-${size}.png`), png(size, buf));
}
console.log('icons written to public/icons');
