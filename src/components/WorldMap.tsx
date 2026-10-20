import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { GeoProjection } from 'd3-geo';
import type { CityView, Model } from '../lib/model';
import { GRATICULE, LAND, makeProjection, pathFor, shading, SPHERE } from '../lib/mapgeo';
import { placeLabels, SLOT_LAYOUT } from '../lib/labels';
import { clockStr, diffSpoken, monthDay, weekdayShort } from '../lib/time';
import { coordLabel } from '../lib/solar';
import type { Palette } from '../lib/theme';
import { SunTip, SUN_TIP_ID, Tooltip, TIP_ID } from './Tooltip';
import { Editor, type PlanChoice } from './Editor';

interface Props {
  model: Model; hour12: boolean; T: Palette;
  hoverId: string | null; editorId: string | null;
  onHover: (id: string | null) => void; onOpen: (id: string) => void;
  onApply: (c: PlanChoice) => void; onCancel: () => void;
}

const Base = memo(function Base({ projection, T, W }: { projection: GeoProjection; T: Palette; W: number }) {
  const path = pathFor(projection);
  const top = projection([0, 90])![1], bot = projection([0, -90])![1];
  const lines = [];
  for (let lon = -180; lon <= 180; lon += 7.5) {
    const x = projection([lon, 0])![0], off = lon / 15, zero = off === 0, half = off % 1 !== 0;
    if (half) {
      lines.push(<line key={`t${lon}`} x1={x} x2={x} y1={top - 4} y2={top} stroke={T.tick} strokeWidth={1} />);
      lines.push(<line key={`h${lon}`} x1={x} x2={x} y1={top} y2={bot} stroke={T.gridHalf} strokeWidth={0.6} strokeDasharray="1 6" />);
      continue;
    }
    lines.push(<line key={`l${lon}`} x1={x} x2={x} y1={top - 7} y2={bot} stroke={zero ? T.gridZero : T.grid} strokeWidth={zero ? 1 : 0.8} strokeDasharray={zero ? undefined : '2 4'} />);
    if (lon > -180 && lon < 180) {
      lines.push(<text key={`x${lon}`} x={x} y={top - 10} textAnchor="middle" fill={zero ? T.lblZero : T.lbl} fontWeight={zero ? 600 : 500}>{zero ? 'GMT' : `${off > 0 ? '+' : '−'}${Math.abs(off)}`}</text>);
    }
  }
  return (
    <g aria-hidden="true">
      <path d={path(SPHERE) ?? ''} fill={T.ocean} stroke={T.sphereLine} />
      <path d={path(LAND) ?? ''} fill={T.land} stroke={T.landLine} strokeWidth={0.6} />
      <path d={path(GRATICULE) ?? ''} fill="none" stroke={T.grat} strokeWidth={0.8} />
      <g className="axis">
        {lines}
        <text x={12} y={top - 10} fill={T.lblEdge}>−12</text>
        <text x={W - 12} y={top - 10} textAnchor="end" fill={T.lblEdge}>+12</text>
      </g>
    </g>
  );
});


export function WorldMap({ model, hour12, T, hoverId, editorId, onHover, onOpen, onApply, onCancel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ W: 0, H: 0 });
  const [sunHover, setSunHover] = useState(false);
  useEffect(() => {
    const el = ref.current!;
    const measure = () => setSize(s => (s.W === el.clientWidth && s.H === el.clientHeight ? s : { W: el.clientWidth, H: el.clientHeight }));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    document.addEventListener('visibilitychange', measure);
    return () => { ro.disconnect(); document.removeEventListener('visibilitychange', measure); };
  }, []);
  const { W, H } = size;
  const ready = W > 0 && H > 0;
  const projection = useMemo(() => (ready ? makeProjection(W, H) : null), [W, H, ready]);

  const night = useMemo(() => {
    if (!projection) return null;
    const path = pathFor(projection), s = shading(model.utc);
    const [sx, sy] = projection(s.sun)!;
    return { day: path(s.day), n1: path(s.twilightOuter), n2: path(s.night), n3: path(s.twilightInner), sx, sy, sun: s.sun };
  }, [projection, model.utc]);

  const pts = useMemo(() => {
    const m = new Map<string, [number, number]>();
    if (projection) for (const v of model.map) m.set(v.city.id, projection([v.city.lon, v.city.lat]) as [number, number]);
    return m;
  }, [projection, model.map]);
  const rulerKey = model.map.filter(v => v.labelled).map(v => v.city.id).join(',');
  const slots = useMemo(
    () => placeLabels(model.map.map(v => ({ id: v.city.id, name: v.city.name, x: pts.get(v.city.id)?.[0] ?? 0, y: pts.get(v.city.id)?.[1] ?? 0, labelled: v.labelled, lon: v.city.lon })), W),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pts, rulerKey, W],
  );

  const hover = hoverId && !editorId ? model.byId.get(hoverId) : undefined;
  const editing = editorId ? model.byId.get(editorId) : undefined;
  const showSun = sunHover && !hover && !editing;
  const key = (id: string) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(id); } };
  const label = (v: CityView) =>
    `${v.city.name}, ${v.city.country}: ${clockStr(v.p.h, v.p.mi, hour12)}, ${weekdayShort(v.p)} ${monthDay(v.p)}, ${v.isHome ? 'home city' : diffSpoken(v.diff, model.home.city.name)}. Convert from here.`;
  // Labelled cities render last so their labels and dots sit above minor dots.
  const drawn = useMemo(() => [...model.map].sort((a, b) => Number(a.labelled) - Number(b.labelled) || Number(a.isHome) - Number(b.isHome)), [model.map]);

  return (
    <div className="map" ref={ref} onClick={() => editorId && onCancel()}>
      {projection && night && (
        <svg className="world" role="group" aria-label="World map with day and night shading. The longitude grid shows solar offsets, not legal time-zone boundaries.">
          <Base projection={projection} T={T} W={W} />
          <g aria-hidden="true" data-layer="daynight">
            <path d={night.day ?? ''} fill={T.dayWash} />
            <path d={night.n1 ?? ''} fill={T.night1} />
            <path d={night.n2 ?? ''} fill={T.night2} stroke={T.term} strokeWidth={0.8} strokeOpacity={0.7} />
            <path d={night.n3 ?? ''} fill={T.night3} />
            <circle className="sun" cx={night.sx} cy={night.sy} r={3} fill={T.sun} stroke={T.sunRing} strokeWidth={6} />
          </g>
          <g>
            {drawn.map(v => {
              const [x, y] = pts.get(v.city.id)!, k = slots.get(v.city.id) ?? 'hide';
              const L = k === 'hide' ? null : SLOT_LAYOUT[k];
              return (
                <g key={v.city.id} data-city={v.city.id} role="button" tabIndex={0} aria-label={label(v)}
                  aria-describedby={hoverId === v.city.id && !editorId ? TIP_ID : undefined}
                  className={`city${v.isHome ? ' home' : ''}${v.isDay ? '' : ' night'}${v.labelled ? '' : ' minor'}`}
                  transform={`translate(${x},${y})`}
                  onMouseEnter={() => onHover(v.city.id)} onMouseLeave={() => onHover(null)}
                  onFocus={() => onHover(v.city.id)} onBlur={() => onHover(null)}
                  onClick={e => { e.stopPropagation(); onOpen(v.city.id); }} onKeyDown={key(v.city.id)}>
                  <circle className="ring" r={9} fill="transparent" />
                  {v.isHome && <circle className="halo" r={7} fill="none" strokeWidth={1} stroke={T.home} opacity={0.6} />}
                  {v.labelled && L && (
                    <>
                      <text className="name" textAnchor={L.anchor} dx={L.dx} dy={L.dyName}>{v.city.name}</text>
                      <text className="time" textAnchor={L.anchor} dx={L.dx} dy={L.dyTime}>{clockStr(v.p.h, v.p.mi, hour12)}</text>
                    </>
                  )}
                  <circle className="dot" r={v.labelled ? 3.5 : 2.5} strokeWidth={v.labelled ? 1.5 : 1} stroke={T.dotStroke}
                    fill={v.isHome ? T.home : v.isDay ? (v.labelled ? T.day : T.dayMinor) : v.labelled ? T.night : T.nightMinor} />
                </g>
              );
            })}
          </g>
          <g className="sunmark" data-sun="" role="img" tabIndex={0} transform={`translate(${night.sx},${night.sy})`}
            aria-label={`Sun marker: the sun is directly overhead at ${coordLabel(night.sun)}. Not a city.`}
            aria-describedby={showSun ? SUN_TIP_ID : undefined}
            onMouseEnter={() => setSunHover(true)} onMouseLeave={() => setSunHover(false)} onFocus={() => setSunHover(true)} onBlur={() => setSunHover(false)}>
            <circle r={12} fill="transparent" />
          </g>
        </svg>
      )}
      {showSun && night && <SunTip utc={model.utc} sun={night.sun} hour12={hour12} x={night.sx} y={night.sy} W={W} H={H} />}
      {hover && pts.has(hover.city.id) && (
        <Tooltip v={hover} model={model} hour12={hour12} T={T} x={pts.get(hover.city.id)![0]} y={pts.get(hover.city.id)![1]} W={W} H={H} />
      )}
      {editing && pts.has(editing.city.id) && (
        <Editor key={editing.city.id} v={editing} hour12={hour12} x={pts.get(editing.city.id)![0]} y={pts.get(editing.city.id)![1]} W={W} H={H} onApply={onApply} onCancel={onCancel} />
      )}
      <div className="legend" aria-hidden="true">
        <span><i className="sw-day" />Daylight</span>
        <span><i className="sw-twi" />Twilight</span>
        <span><i className="sw-night" />Night</span>
        <span className="opt"><i className="sw-sun" />Sunrise / sunset (est.)</span>
        <span className="opt"><i className="sw-now" />Local time</span>
        <span className="opt2"><i className="sw-grid" />Grid = solar offset (15°/h), not legal time zones</span>
        <span className="mut opt2">Hover a city for local time · click to convert · large dot = sun overhead</span>
      </div>
    </div>
  );
}
