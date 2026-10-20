import type { CSSProperties } from 'react';
import type { CityView, Model } from '../lib/model';
import { bandPos, solarDay } from '../lib/solar';
import { clockStr, diffLabel, diffSpoken, fmtClock, monthDay, weekdayShort } from '../lib/time';
import { bandGradient, diffColor, type Palette } from '../lib/theme';
import { TIP_ID } from './Tooltip';

interface Props { model: Model; hour12: boolean; T: Palette; hoverId: string | null; editorId: string | null; onHover: (id: string | null) => void; onOpen: (id: string) => void }

const pct = (f: number) => `${(f * 100).toFixed(2)}%`;

function Cell({ v, model, hour12, T, described, onHover, onOpen }: { v: CityView; model: Model; hour12: boolean; T: Palette; described: boolean; onHover: Props['onHover']; onOpen: Props['onOpen'] }) {
  const { city, p } = v;
  const t = fmtClock(p.h, p.mi, hour12);
  const full = `${city.name}, ${city.country}`;
  const body = (
    <>
      <div className="r1"><span className="nm">{city.name}</span><span className="diff" style={{ color: diffColor(T, v.diff) }}>{v.isHome ? 'HOME' : diffLabel(v.diff).replace('HOME', '±0h')}</span></div>
      <div className="r2">
        <span className="tm">{t.main}{t.suffix && <small>{t.suffix}</small>}</span>
        <span className="dt"><span className="dd">{weekdayShort(p)}, {monthDay(p)}</span>{v.dayDelta < 0 ? <b className="prev">PREV</b> : v.dayDelta > 0 ? <b className="next">NEXT</b> : null}</span>
      </div>
    </>
  );
  if (v.gmt) {
    return (
      <div className="cell gmt" data-city="gmt" title="GMT reference (UTC+0)" role="group"
        aria-label={`GMT reference: ${clockStr(p.h, p.mi, hour12)}, ${weekdayShort(p)} ${monthDay(p)}, ${diffSpoken(v.diff, model.home.city.name)}`}>
        {body}<div className="band" />
      </div>
    );
  }
  const sol = solarDay(city.tz, p.y, p.mo, p.d, city.lat, city.lon);
  return (
    <button type="button" className={`cell${v.isHome ? ' home' : ''}`} data-city={city.id} title={full}
      aria-label={`${full}: ${clockStr(p.h, p.mi, hour12)}, ${weekdayShort(p)} ${monthDay(p)}${v.dayDelta < 0 ? ', previous day' : v.dayDelta > 0 ? ', next day' : ''}, ${v.isHome ? 'home city' : diffSpoken(v.diff, model.home.city.name)}. Convert from here.`}
      aria-describedby={described ? TIP_ID : undefined}
      onMouseEnter={() => onHover(city.id)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(city.id)} onBlur={() => onHover(null)}
      onClick={e => { e.stopPropagation(); onOpen(city.id); }}>
      {body}
      <div className="band" style={{ background: bandGradient(T, sol) }}>
        {sol.sunrise != null && <i style={{ left: pct(bandPos(sol, sol.sunrise)) }} />}
        {sol.sunset != null && <i style={{ left: pct(bandPos(sol, sol.sunset)) }} />}
        <em style={{ left: pct(bandPos(sol, model.utc)) }} />
      </div>
    </button>
  );
}

export function Ruler({ model, hour12, T, hoverId, editorId, onHover, onOpen }: Props) {
  const n = model.ruler.length;
  const style = { '--cols': n, '--cols2': Math.ceil(n / 2), '--cols3': Math.ceil(n / 3) } as CSSProperties;
  return (
    <div className="bar" style={style} role="group" aria-label="City ruler, west to east by current UTC offset">
      {model.ruler.map(v => (
        <Cell key={v.city.id} v={v} model={model} hour12={hour12} T={T} described={hoverId === v.city.id && !editorId} onHover={onHover} onOpen={onOpen} />
      ))}
    </div>
  );
}
