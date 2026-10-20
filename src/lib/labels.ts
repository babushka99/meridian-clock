// Collision-aware label placement. Each labelled city gets one of nine slots around its dot; the layout is chosen
// by minimising weighted overlap between labels, dots and the viewport edge (greedy west → east, then local search,
// then a short deterministic simulated-annealing pass so crowded clusters such as the western USA or West Africa
// can reach arrangements that single-label moves cannot).
export type Slot = 'right' | 'left' | 'above' | 'below' | 'top' | 'top-left' | 'top-right' | 'below-left' | 'below-right' | 'hide';
export interface LabelInput { id: string; name: string; x: number; y: number; labelled: boolean; lon: number }
interface Box { x: number; y: number; w: number; h: number; weight: number; owner?: string }
type Plain = Omit<Box, 'weight'>;
type Cand = { k: Slot; pref: number; boxes: Plain[] };

/** How the SVG draws each slot: text anchor plus offsets (px) of the name and time baselines from the dot. */
export const SLOT_LAYOUT: Record<Exclude<Slot, 'hide'>, { anchor: 'start' | 'middle' | 'end'; dx: number; dyName: number; dyTime: number }> = {
  right: { anchor: 'start', dx: 8, dyName: -1, dyTime: 10 },
  left: { anchor: 'end', dx: -8, dyName: -1, dyTime: 10 },
  above: { anchor: 'middle', dx: 0, dyName: -9, dyTime: 18 },   // name above the dot, time below it
  below: { anchor: 'middle', dx: 0, dyName: 16, dyTime: 27 },   // both lines under the dot
  top: { anchor: 'middle', dx: 0, dyName: -18, dyTime: -7 },    // both lines over the dot
  'top-left': { anchor: 'end', dx: -4, dyName: -18, dyTime: -7 },
  'top-right': { anchor: 'start', dx: 4, dyName: -18, dyTime: -7 },
  'below-left': { anchor: 'end', dx: -4, dyName: 16, dyTime: 27 },
  'below-right': { anchor: 'start', dx: 4, dyName: 16, dyTime: 27 },
};

const TOUCHING = 300; // total overlap cost (px² × weight) we stop fighting: labels that merely touch
const TIME_W = 48; // "12:00 AM" in JetBrains Mono 10px measures 48px; other times 42px
const W_RULER_DOT = 40, W_LABEL = 20, W_MINOR_DOT = 3;
const overlap = (a: Plain, b: Plain) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
/** Uppercase Inter 600 at 10px with .06em tracking measures ≈ 7.6px per letter and ≈ 3px per space. */
export const nameWidth = (name: string) => {
  const spaces = (name.match(/ /g) ?? []).length;
  return Math.max((name.length - spaces) * 7.6 + spaces * 3, TIME_W) + 2;
};

/** Text boxes for every slot. A name box is 12px tall with its top 10px above the baseline; a time box is 13px tall. */
function candidates(d: LabelInput): Cand[] {
  const { x, y } = d, w = nameWidth(d.name), t = TIME_W;
  const side = (k: Slot, pref: number, bx: number): Cand => ({ k, pref, boxes: [{ x: bx, y: y - 11, w, h: 24 }] });
  const stack = (k: Slot, pref: number, top: number, nx: number, tx: number): Cand => ({ k, pref, boxes: [{ x: nx, y: top, w, h: 12 }, { x: tx, y: top + 11, w: t, h: 13 }] });
  return [
    side('right', 0, x + 6),
    side('left', 0.5, x - 6 - w),
    { k: 'above', pref: 1, boxes: [{ x: x - w / 2, y: y - 19, w, h: 12 }, { x: x - t / 2, y: y + 8, w: t, h: 13 }] },
    stack('below', 1, y + 6, x - w / 2, x - t / 2),
    stack('top', 1.5, y - 28, x - w / 2, x - t / 2),
    stack('top-left', 2, y - 28, x - 4 - w, x - 4 - t),
    stack('top-right', 2, y - 28, x + 4, x + 4),
    stack('below-left', 2, y + 6, x - 4 - w, x - 4 - t),
    stack('below-right', 2, y + 6, x + 4, x + 4),
  ];
}

/** Small deterministic PRNG so a given layout always places labels the same way. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Only `labelled` cities (ruler + always-labelled) get a label; they always get a slot (least-overlap fallback). */
export function placeLabels(items: LabelInput[], width: number): Map<string, Slot> {
  const out = new Map<string, Slot>();
  const dots: Box[] = items.map(d => ({ x: d.x - 5, y: d.y - 5, w: 10, h: 10, weight: d.labelled ? W_RULER_DOT : W_MINOR_DOT, owner: d.id }));
  const labels = new Map<string, Box[]>();
  const ruler = items.filter(d => d.labelled).sort((a, b) => a.lon - b.lon || a.id.localeCompare(b.id));
  for (const d of items) if (!d.labelled) out.set(d.id, 'hide');
  if (!ruler.length) return out;

  const opts = new Map<string, Cand[]>();
  for (const d of ruler) {
    const all = candidates(d), inside = all.filter(c => c.boxes.every(b => b.x >= 2 && b.x + b.w <= width - 2));
    opts.set(d.id, inside.length ? inside : all);
  }
  // Only nearby things can collide: each label is costed against dots within reach and the labels of neighbouring cities.
  const reach = (d: LabelInput) => nameWidth(d.name) + 12;
  const nearDots = new Map(ruler.map(d => [d.id, dots.filter(o => o.owner !== d.id && Math.abs(o.x + 5 - d.x) < reach(d) + 10 && Math.abs(o.y + 5 - d.y) < 45)]));
  const neighbours = new Map(ruler.map(d => [d.id, ruler.filter(e => e !== d && Math.abs(e.x - d.x) < reach(d) + reach(e) && Math.abs(e.y - d.y) < 70)]));
  /** Weighted overlap of `c` with nearby dots and neighbouring labels, plus the slot's style preference. */
  const cost = (d: LabelInput, c: Cand) => {
    let s = c.pref;
    const ds = nearDots.get(d.id)!, ns = neighbours.get(d.id)!;
    for (const b of c.boxes) {
      for (const o of ds) s += overlap(b, o) * o.weight;
      for (const n of ns) { const bs = labels.get(n.id); if (bs) for (const o of bs) s += overlap(b, o) * W_LABEL; }
    }
    return s;
  };
  const place = (d: LabelInput, c: Cand) => { out.set(d.id, c.k); labels.set(d.id, c.boxes.map(b => ({ ...b, weight: W_LABEL }))); };
  const current = (d: LabelInput) => opts.get(d.id)!.find(c => c.k === out.get(d.id))!;
  /** Move `d` to its cheapest slot given everything else; returns true when it moved. */
  const improve = (d: LabelInput) => {
    let best: Cand | undefined, bestCost = Infinity;
    for (const c of opts.get(d.id)!) { const k = cost(d, c); if (k < bestCost - 1e-9) { bestCost = k; best = c; } }
    const moved = best!.k !== out.get(d.id);
    place(d, best!);
    return moved;
  };
  const total = () => ruler.reduce((s, d) => s + cost(d, current(d)), 0);
  const descend = () => { for (let pass = 0; pass < 8; pass++) { let moved = false; for (const d of ruler) moved = improve(d) || moved; if (!moved) break; } };
  const clean = () => total() - ruler.reduce((s, d) => s + current(d).pref, 0) <= TOUCHING;

  for (const d of ruler) improve(d); // greedy west → east
  descend();
  const crowded = ruler.filter(d => neighbours.get(d.id)!.length);
  if (!clean() && crowded.length) {
    // Still colliding: anneal the crowded labels from the descended layout, a few restarts, keep the best layout seen.
    const prefs = () => ruler.reduce((s, d) => s + current(d).pref, 0);
    let best = crowded.map(d => out.get(d.id)!), bestCost = total(), bestOverlap = bestCost - prefs();
    const start = [...best];
    for (let run = 0; run < 4; run++) {
      crowded.forEach((d, i) => place(d, opts.get(d.id)!.find(c => c.k === start[i])!));
      const random = rng(width * 7919 + ruler.length * 131 + run);
      let cur = total();
      const steps = crowded.length * 1500;
      for (let i = 0; i < steps; i++) {
        const temp = 3000 * Math.pow(0.0003, i / steps); // 3000 → ~1 (overlap units: px² × weight)
        const d = crowded[Math.floor(random() * crowded.length)], options = opts.get(d.id)!;
        const from = current(d), to = options[Math.floor(random() * options.length)];
        if (to === from) continue;
        const delta = cost(d, to) - cost(d, from);
        if (delta <= 0 || random() < Math.exp(-delta / temp)) {
          place(d, to); cur += delta;
          if (cur < bestCost - 1e-9) { bestCost = cur; best = crowded.map(e => out.get(e.id)!); bestOverlap = cur - prefs(); if (bestOverlap <= TOUCHING) break; }
        }
      }
      if (bestOverlap <= TOUCHING) break; // nothing worse than touching remains
    }
    crowded.forEach((d, i) => place(d, opts.get(d.id)!.find(c => c.k === best[i])!));
    descend();
  }
  return out;
}
