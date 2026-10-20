import { useLayoutEffect, useRef, useState } from 'react';
import type { CityView, Model } from '../lib/model';
import { solarDay } from '../lib/solar';
import { clockAt, clockStr, diffLabel, fmtClock, MON, utcLabel, weekdayShort, zonedParts } from '../lib/time';
import { coordLabel } from '../lib/solar';
import { diffColor, type Palette } from '../lib/theme';

export const TIP_ID = 'wtr-tip';
export const SUN_TIP_ID = 'wtr-sun-tip';

interface Props { v: CityView; model: Model; hour12: boolean; T: Palette; x: number; y: number; W: number; H: number }

export function Tooltip({ v, model, hour12, T, x, y, W, H }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const { city, p } = v;
  const t = fmtClock(p.h, p.mi, hour12);
  const sol = solarDay(city.tz, p.y, p.mo, p.d, city.lat, city.lon);
  const g = zonedParts(model.utc, 'Etc/UTC');
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tw = el.offsetWidth, th = el.offsetHeight;
    setPos({ left: Math.max(8, Math.min(x + 14, W - tw - 8)), top: Math.max(8, Math.min(y - th / 2, H - th - 8)) });
  }, [x, y, W, H, city.id, model.utc, hour12]);
  const ev = (ms: number | null) => (ms == null ? '—' : clockAt(ms, city.tz, hour12));
  return (
    <div className="tip" id={TIP_ID} role="tooltip" ref={ref} style={pos ? pos : { left: 0, top: 0, opacity: 0 }}>
      <div className="n">{city.name}<span>{city.country}</span></div>
      <div className="big">{t.main}{t.suffix && <small>{t.suffix}</small>}</div>
      <div className="row">
        <span>{weekdayShort(p)}, {MON[p.mo - 1]} {p.d}, {p.y}</span>
        <b style={{ color: diffColor(T, v.diff) }}>{diffLabel(v.diff)}{v.dayDelta < 0 ? ' · prev day' : v.dayDelta > 0 ? ' · next day' : ''}</b>
      </div>
      <div className="row"><span>{v.isDay ? 'Day' : 'Night'} · {city.tz}</span><b>{utcLabel(p.offsetMin)}</b></div>
      {sol.polar ? (
        <div className="row"><span>{sol.polar === 'day' ? 'Sun above horizon all day' : 'Sun below horizon all day'}</span></div>
      ) : (
        <div className="row">
          <span>Sunrise <b style={{ color: T.rise }}>≈ {ev(sol.sunrise)}</b></span>
          <span>Sunset <b style={{ color: T.set }}>≈ {ev(sol.sunset)}</b></span>
        </div>
      )}
      <div className="row"><span>GMT</span><b>{clockStr(g.h, g.mi, hour12)} · {MON[g.mo - 1]} {g.d}</b></div>
      <div className="hint">{v.isHome ? 'Home city' : `vs ${model.home.city.name}`} · click to convert from here · solar times est.</div>
    </div>
  );
}

interface SunProps { utc: number; sun: [number, number]; hour12: boolean; x: number; y: number; W: number; H: number }

/** Tooltip for the sun marker (subsolar point): what the big dot is, where it is, and GMT. */
export function SunTip({ utc, sun, hour12, x, y, W, H }: SunProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const g = zonedParts(utc, 'Etc/UTC');
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tw = el.offsetWidth, th = el.offsetHeight;
    setPos({ left: Math.max(8, Math.min(x + 14, W - tw - 8)), top: Math.max(8, Math.min(y - th / 2, H - th - 8)) });
  }, [x, y, W, H, utc, hour12]);
  return (
    <div className="tip" id={SUN_TIP_ID} role="tooltip" ref={ref} style={pos ? pos : { left: 0, top: 0, opacity: 0 }}>
      <div className="n">Sun overhead<span>subsolar point</span></div>
      <div className="row"><span>Directly above</span><b>{coordLabel(sun)}</b></div>
      <div className="row"><span>Solar noon along this meridian</span></div>
      <div className="row"><span>GMT</span><b>{clockStr(g.h, g.mi, hour12)} · {MON[g.mo - 1]} {g.d}</b></div>
      <div className="hint">Not a city · moves west 15° per hour · estimate</div>
    </div>
  );
}
