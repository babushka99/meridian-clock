import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CITY_BY_ID } from './lib/cities';
import { buildModel } from './lib/model';
import { addCity, defaultPrefs, removeCity, replaceCity, setHome, setLabel, type OpResult, type Prefs } from './lib/prefs';
import { loadPrefs, savePrefs, subscribePrefs } from './lib/storage';
import { coordLabel, subsolarPoint } from './lib/solar';
import { clockStr, longDate, MINUTE, monthDay, utcLabel, weekdayShort, zonedParts } from './lib/time';
import { palette } from './lib/theme';
import { IconMoon, IconPlus, IconRotate, IconSettings, IconSliders, IconSun } from './components/Icons';
import { WorldMap } from './components/WorldMap';
import { Ruler } from './components/Ruler';
import { AddCityPanel, ManagePanel, SettingsPanel } from './components/Panels';
import type { PlanChoice } from './components/Editor';

const VERSION = typeof chrome !== 'undefined' && chrome.runtime?.getManifest ? `v${chrome.runtime.getManifest().version}` : 'dev preview';
const minuteNow = () => Math.floor(Date.now() / MINUTE) * MINUTE;
type PanelName = 'add' | 'manage' | 'settings' | null;

/** Current instant at minute precision; re-reads the clock each minute and whenever the tab becomes visible. */
function useLiveMinute(): number {
  const [now, setNow] = useState(minuteNow);
  useEffect(() => {
    let timer: number;
    const tick = () => {
      setNow(minuteNow());
      timer = window.setTimeout(tick, MINUTE - (Date.now() % MINUTE) + 25);
    };
    const wake = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); tick(); } };
    tick();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('pageshow', wake);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', wake); window.removeEventListener('focus', wake); window.removeEventListener('pageshow', wake); };
  }, []);
  return now;
}

export function App() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [plan, setPlan] = useState<PlanChoice | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelName>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const live = useLiveMinute();

  useEffect(() => {
    let alive = true;
    void loadPrefs().then(p => { if (alive) setPrefs(p); });
    const off = subscribePrefs(p => setPrefs(p));
    return () => { alive = false; off(); };
  }, []);
  useEffect(() => { if (prefs) document.body.classList.toggle('light', prefs.theme === 'light'); }, [prefs?.theme]);

  const commit = useCallback((next: Prefs) => { setPrefs(next); void savePrefs(next); }, []);
  const apply = (r: OpResult) => { if (r.ok) commit(r.prefs); return r.ok; };

  const utc = plan ? plan.utc : live;
  const model = useMemo(() => (prefs ? buildModel(utc, prefs) : null), [utc, prefs?.ruler, prefs?.home, prefs?.labelsOff, prefs?.labelsOn]);
  if (!prefs || !model) return <div className="app" aria-busy="true" />;

  const T = palette(prefs.theme);
  const { hour12 } = prefs;
  const g = zonedParts(utc, 'Etc/UTC');
  const sun = subsolarPoint(utc);
  const iso = `${new Date(utc).toISOString().slice(0, 16).replace('T', ' ')}Z`;
  const planCity = plan ? CITY_BY_ID.get(plan.cityId)! : null;
  const planParts = plan && planCity ? zonedParts(plan.utc, planCity.tz) : null;

  const openEditor = (id: string) => { returnFocus.current = document.activeElement as HTMLElement | null; setPanel(null); setHoverId(null); setEditorId(id); };
  const closeEditor = () => { setEditorId(null); returnFocus.current?.focus?.(); };
  const openPanel = (p: PanelName) => { setEditorId(null); setPanel(cur => (cur === p ? null : p)); };
  const panelBtn = (name: Exclude<PanelName, null>) => ({ 'aria-haspopup': 'dialog' as const, 'aria-expanded': panel === name, onClick: () => openPanel(name) });

  return (
    <div className="app" data-mode={plan ? 'planning' : 'live'}>
      <header className="top">
        <div className="l">
          <h1 className="brand">Meridian Clock</h1>
          {plan ? <span className="pill plan" role="status"><i />PLANNING</span> : <span className="pill live" role="status"><i />LIVE</span>}
          <span className="meta home-meta">Home · <b>{model.home.city.name}</b></span>
          <span className="meta" data-testid="gmt">GMT · <b>{clockStr(g.h, g.mi, hour12)}<span className="gd"> · {weekdayShort(g)}, {monthDay(g)}</span></b></span>
        </div>
        <div className="r">
          <div className="seg" role="group" aria-label="Time format">
            <button type="button" className={hour12 ? 'on' : ''} aria-pressed={hour12} onClick={() => commit({ ...prefs, hour12: true })}>12h</button>
            <button type="button" className={!hour12 ? 'on' : ''} aria-pressed={!hour12} onClick={() => commit({ ...prefs, hour12: false })}>24h</button>
          </div>
          <button type="button" className="btn" data-panel="add" {...panelBtn('add')}><IconPlus /><span className="lbl">Add city</span></button>
          <button type="button" className="btn" data-panel="manage" {...panelBtn('manage')}><IconSliders /><span className="lbl">Manage</span></button>
          <button type="button" className="btn icon" data-theme-toggle="" title="Toggle light / dark" aria-label={`Switch to ${prefs.theme === 'dark' ? 'light' : 'dark'} theme`}
            onClick={() => commit({ ...prefs, theme: prefs.theme === 'dark' ? 'light' : 'dark' })}>{prefs.theme === 'dark' ? <IconSun /> : <IconMoon />}</button>
          <button type="button" className="btn icon" data-panel="settings" title="Settings" aria-label="Settings" {...panelBtn('settings')}><IconSettings /></button>
        </div>
      </header>

      {plan && planCity && planParts && (
        <div className="plan-strip" role="status" aria-label="Planning mode">
          <div className="t">
            <span className="pill plan bare"><i /></span><span className="k">PLANNING</span><span className="d">·</span>
            <span data-testid="plan-city">{planCity.name}</span><span className="d">·</span>
            <span data-testid="plan-date">{longDate(planParts)}</span><span className="d">·</span>
            <span data-testid="plan-time">{clockStr(planParts.h, planParts.mi, hour12)}</span>
            <span className="w">{plan.occurrence ? `${plan.occurrence} occurrence · ${utcLabel(plan.offsetMin)} · ` : ''}fixed until changed</span>
          </div>
          <button type="button" className="btn primary" data-back-now="" onClick={() => { setPlan(null); setEditorId(null); }}><IconRotate />Back to now</button>
        </div>
      )}

      <Ruler model={model} hour12={hour12} T={T} hoverId={hoverId} editorId={editorId} onHover={setHoverId} onOpen={openEditor} />
      <WorldMap model={model} hour12={hour12} T={T} hoverId={hoverId} editorId={editorId} onHover={setHoverId} onOpen={openEditor}
        onApply={c => { setPlan(c); setEditorId(null); returnFocus.current?.focus?.(); }} onCancel={closeEditor} />

      <footer className="foot">
        <span>{plan ? 'Planning instant' : 'Live'} · {iso} · {model.map.length} cities on map · {model.ruler.length - 1} + GMT on ruler<span className="compact-note"> · compact ruler</span> · longitude grid = solar reference (±15° per hour, ticks every 30 min), not legal time-zone boundaries</span>
        <span className="mid">Subsolar {coordLabel(sun)}</span>
        <span>Solar times are estimates · DST per IANA · Natural Earth 110m</span>
      </footer>

      {panel === 'add' && (
        <AddCityPanel prefs={prefs} utc={utc} hour12={hour12} onClose={() => setPanel(null)} onManage={() => setPanel('manage')}
          onAdd={id => apply(addCity(prefs, id))} onReplace={(rm, add) => apply(replaceCity(prefs, rm, add))} />
      )}
      {panel === 'manage' && (
        <ManagePanel prefs={prefs} model={model} hour12={hour12} onClose={() => setPanel(null)} onAddCity={() => setPanel('add')}
          onRemove={(id, newHome) => apply(removeCity(prefs, id, newHome))} onHome={id => apply(setHome(prefs, id))} onLabel={(id, on) => apply(setLabel(prefs, id, on))} />
      )}
      {panel === 'settings' && (
        <SettingsPanel prefs={prefs} version={VERSION} onClose={() => setPanel(null)} onFormat={h => commit({ ...prefs, hour12: h })}
          onTheme={t => commit({ ...prefs, theme: t })} onReset={() => commit(defaultPrefs())} />
      )}
    </div>
  );
}
