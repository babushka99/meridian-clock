import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { CityView } from '../lib/model';
import { clockStr, fmtClock, isoDate, monthDay, parseDateInput, parseTimeInput, resolveWall, utcLabel, zonedParts, type Occurrence } from '../lib/time';

export interface PlanChoice { cityId: string; utc: number; offsetMin: number; occurrence: null | 'first' | 'second' }
interface Props { v: CityView; hour12: boolean; x: number; y: number; W: number; H: number; onApply: (c: PlanChoice) => void; onCancel: () => void }

export function Editor({ v, hour12, x, y, W, H, onApply, onCancel }: Props) {
  const { city, p } = v;
  const init = fmtClock(p.h, p.mi, hour12);
  const [date, setDate] = useState(isoDate(p));
  const [time, setTime] = useState(init.main);
  const [mer, setMer] = useState<'AM' | 'PM'>(p.h < 12 ? 'AM' : 'PM');
  const [note, setNote] = useState<{ text: string; field?: 'date' | 'time' } | null>(null);
  const [options, setOptions] = useState<[Occurrence, Occurrence] | null>(null);
  const [pick, setPick] = useState<0 | 1 | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => { timeRef.current?.focus(); timeRef.current?.select(); }, []);
  useEffect(() => {
    const fn = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onCancel(); } };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onCancel]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos({ left: Math.max(8, Math.min(x + 16, W - el.offsetWidth - 8)), top: Math.max(8, Math.min(y - 20, H - el.offsetHeight - 8)) });
  }, [x, y, W, H, options, note]);

  const edited = () => { setNote(null); setOptions(null); setPick(null); };

  function apply() {
    const d = parseDateInput(date);
    if (!d.ok) return setNote({ text: d.error, field: 'date' });
    const t = parseTimeInput(time, hour12, mer);
    if (!t.ok) return setNote({ text: t.error, field: 'time' });
    const r = resolveWall(city.tz, { y: d.y, mo: d.mo, d: d.d, h: t.h, mi: t.mi });
    const shown = clockStr(t.h, t.mi, hour12);
    if (r.kind === 'ok') return onApply({ cityId: city.id, utc: r.utc, offsetMin: r.offsetMin, occurrence: null });
    if (r.kind === 'gap') {
      // Never shift silently: explain the skipped range and ask for a real time.
      return setNote({
        field: 'time',
        text: `${shown} does not exist in ${city.name} on ${monthDay(d)}, ${d.y}: clocks jump from ${clockStr(r.gapStart.h, r.gapStart.mi, hour12)} to ${clockStr(r.gapEnd.h, r.gapEnd.mi, hour12)} (daylight saving). Enter a valid time.`,
      });
    }
    if (options && pick != null) {
      const o = options[pick];
      return onApply({ cityId: city.id, utc: o.utc, offsetMin: o.offsetMin, occurrence: pick === 0 ? 'first' : 'second' });
    }
    setOptions(r.options);
    setNote({ text: `${shown} happens twice in ${city.name} on ${monthDay(d)}, ${d.y} (clocks go back). Choose which one, then Apply.` });
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); apply(); }
  }
  const gmt = (ms: number) => { const g = zonedParts(ms, 'Etc/UTC'); return clockStr(g.h, g.mi, false); };

  return (
    <div className="editor" ref={ref} role="dialog" aria-label={`Convert from ${city.name}, ${city.country}`} onKeyDown={onKey}
      onClick={e => e.stopPropagation()} style={pos ?? { left: 0, top: 0, opacity: 0 }}>
      <div className="hd"><span className="kicker">Convert from</span><span className="c" title={city.tz}>{city.name}, {city.country}</span></div>
      <label className="f">Date
        <input type="text" value={date} placeholder="2026-10-07" spellCheck={false} autoComplete="off" inputMode="numeric"
          aria-invalid={note?.field === 'date'} aria-describedby="wtr-ed-note" onChange={e => { setDate(e.target.value); edited(); }} />
      </label>
      <div className="trow">
        <label htmlFor="wtr-ed-time">Time</label>
        <input id="wtr-ed-time" ref={timeRef} type="text" value={time} placeholder={hour12 ? '5:30' : '17:30'} spellCheck={false} autoComplete="off"
          aria-invalid={note?.field === 'time'} aria-describedby="wtr-ed-note" onChange={e => { setTime(e.target.value); edited(); }} />
        {hour12 && (
          <div className="seg" role="group" aria-label="AM or PM">
            {(['AM', 'PM'] as const).map(m => (
              <button key={m} type="button" className={mer === m ? 'on' : ''} aria-pressed={mer === m} onClick={() => { setMer(m); edited(); }}>{m}</button>
            ))}
          </div>
        )}
      </div>
      <div id="wtr-ed-note" className={`note${note ? ' err' : ''}`} role="alert">{note?.text ?? `Local time in ${city.tz}`}</div>
      {options && (
        <fieldset className="occ">
          <legend className="sr">Which occurrence</legend>
          {options.map((o, i) => (
            <label key={o.utc}>
              <input type="radio" name="wtr-occ" checked={pick === i} autoFocus={i === 0} onChange={() => setPick(i as 0 | 1)} />
              {i === 0 ? 'First' : 'Second'} · {utcLabel(o.offsetMin)}
              <small>{gmt(o.utc)} GMT</small>
            </label>
          ))}
        </fieldset>
      )}
      <div className="acts">
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn solid" onClick={apply} disabled={!!options && pick == null}>Apply</button>
      </div>
    </div>
  );
}
