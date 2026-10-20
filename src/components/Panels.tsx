import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CITIES, CITY_BY_ID, DATA_SOURCE, MAP_CITIES, MAX_RULER, searchCities, type City } from '../lib/cities';
import type { Model } from '../lib/model';
import type { Prefs, Theme } from '../lib/prefs';
import { clockAt, diffLabel, utcLabel, zonedParts } from '../lib/time';
import { IconCheck, IconPlus, IconSearch, IconX } from './Icons';

function Panel({ title, count, onClose, children }: { title: string; count?: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!, opener = document.activeElement as HTMLElement | null;
    if (!el.contains(opener)) (el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>('.pb button, .pb input') ?? el.querySelector<HTMLElement>('button'))?.focus();
    // Hand focus back to whatever opened the panel, unless another dialog has taken it.
    return () => { if (opener?.isConnected && (document.activeElement === document.body || !document.activeElement)) opener.focus(); };
  }, []);
  // Escape closes the panel even if focus has dropped out of it (e.g. the focused row was just removed).
  useEffect(() => {
    const fn = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onClose(); } };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);
  useEffect(() => {
    const el = ref.current!;
    if (!el.contains(document.activeElement)) (el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>('.x'))?.focus();
  });
  // Keep Tab inside the dialog; Escape closes it.
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const f = [...ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="panel" role="dialog" aria-modal="true" aria-label={title} ref={ref} onKeyDown={onKey}>
        <div className="ph">
          <span className="kicker">{title}</span>
          {count && <span className="cnt">{count}</span>}
          <button type="button" className="x" aria-label={`Close ${title}`} onClick={onClose}><IconX /></button>
        </div>
        <div className="pb">{children}</div>
      </div>
    </>
  );
}

const zoneLine = (c: City, utc: number, hour12: boolean) => `${c.tz} · ${utcLabel(zonedParts(utc, c.tz).offsetMin)} · ${clockAt(utc, c.tz, hour12)}`;
const savedWestToEast = (prefs: Prefs, utc: number) =>
  prefs.ruler.map(id => CITY_BY_ID.get(id)!).sort((a, b) => zonedParts(utc, a.tz).offsetMin - zonedParts(utc, b.tz).offsetMin || a.lon - b.lon);

// ---------------- Add city ----------------
interface AddProps { prefs: Prefs; utc: number; hour12: boolean; onAdd: (id: string) => void; onReplace: (removeId: string, addId: string) => void; onManage: () => void; onClose: () => void }

export function AddCityPanel({ prefs, utc, hour12, onAdd, onReplace, onManage, onClose }: AddProps) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [pending, setPending] = useState<City | null>(null);
  const [status, setStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const full = prefs.ruler.length >= MAX_RULER;
  const saved = new Set(prefs.ruler);
  const results = useMemo(() => (q.trim() ? searchCities(q, 40) : MAP_CITIES.filter(c => !prefs.ruler.includes(c.id)).sort((a, b) => b.pop - a.pop).slice(0, 8)), [q, prefs.ruler]);
  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector('.act')?.scrollIntoView({ block: 'nearest' }); }, [active]);

  function choose(c: City) {
    if (saved.has(c.id)) return setStatus(`${c.name} is already on the ruler.`);
    if (full) return setPending(c);
    onAdd(c.id);
    setStatus(`${c.name} added to the ruler and map.`);
    inputRef.current?.focus();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); choose(results[active]); }
  }

  if (pending) {
    return (
      <Panel title="Replace city" count={`${prefs.ruler.length} / ${MAX_RULER}`} onClose={onClose}>
        <div className="msg">The ruler holds {MAX_RULER} cities. Choose the saved city that <b>{pending.name}, {pending.country}</b> replaces.</div>
        <ul className="list">
          {savedWestToEast(prefs, utc).map((c, i) => {
            const home = c.id === prefs.home;
            return (
              <li key={c.id}>
                <button type="button" className="row" disabled={home} data-autofocus={i === 0 && !home ? '' : undefined} data-replace={c.id}
                  onClick={() => { onReplace(c.id, pending.id); setStatus(`${pending.name} replaced ${c.name}.`); setPending(null); }}>
                  <span className="main"><span className="a">{c.name}<span>{c.country}</span></span><span className="b">{zoneLine(c, utc, hour12)}</span></span>
                  <span className={`tag ${home ? 'home' : 'rep'}`}>{home ? 'Home · locked' : 'Replace'}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="msg">Home cannot be replaced here; change home in Manage first.</div>
        <div className="set">
          <button type="button" className="ghost" onClick={() => setPending(null)}>Back to search</button>
          <button type="button" className="ghost" onClick={onManage}>Remove a city in Manage</button>
        </div>
      </Panel>
    );
  }
  return (
    <Panel title="Add city" count={`${prefs.ruler.length} / ${MAX_RULER} saved`} onClose={onClose}>
      <div className="search">
        <IconSearch />
        <input ref={inputRef} data-autofocus="" type="text" role="combobox" aria-expanded="true" aria-controls="wtr-results" aria-autocomplete="list"
          aria-activedescendant={results[active] ? `wtr-opt-${results[active].id}` : undefined} aria-label="Search cities by name or country"
          placeholder="Search city or country…" value={q} spellCheck={false} autoComplete="off" onChange={e => { setQ(e.target.value); setStatus(''); }} onKeyDown={onKey} />
      </div>
      {full && (
        <div className="msg warn"><span>Ruler is full ({MAX_RULER}/{MAX_RULER}). Pick a city to replace a saved one, or remove one first.</span>
          <button type="button" className="ghost" onClick={onManage}>Manage</button></div>
      )}
      <div className={`msg${status ? ' ok' : ''}`} role="status" aria-live="polite">
        {status || (q.trim() ? `${results.length === 40 ? '40+' : results.length} match${results.length === 1 ? '' : 'es'} · IANA zone shown to tell similar names apart` : `Search ${CITIES.length.toLocaleString('en-US')} cities by name, country or zone. Suggestions:`)}
      </div>
      {results.length > 0 && (
        <ul className="list" id="wtr-results" role="listbox" aria-label="Cities" ref={listRef}>
          {results.map((c, i) => {
            const isSaved = saved.has(c.id);
            return (
              <li key={c.id} role="presentation">
                <button type="button" id={`wtr-opt-${c.id}`} role="option" aria-selected={i === active} aria-disabled={isSaved} tabIndex={-1}
                  className={`row${i === active ? ' act' : ''}`} data-result={c.id} onMouseMove={() => setActive(i)} onClick={() => choose(c)}>
                  <span className="main"><span className="a">{c.name}<span>{c.country}</span></span><span className="b">{zoneLine(c, utc, hour12)}</span></span>
                  {isSaved ? <span className="tag"><IconCheck />{c.id === prefs.home ? 'Home' : 'Saved'}</span>
                    : full ? <span className="tag rep">Replace…</span> : <span className="tag add"><IconPlus />Add</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ---------------- Manage ----------------
interface ManageProps { prefs: Prefs; model: Model; hour12: boolean; onRemove: (id: string, newHome?: string) => void; onHome: (id: string) => void; onLabel: (id: string, on: boolean) => void; onAddCity: () => void; onClose: () => void }

/** On/off switch for a city's map label (a checkbox styled as a toggle). */
function LabelSwitch({ city, on, text, onChange }: { city: City; on: boolean; text?: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="sw" title={on ? 'Label shown on the map' : 'Label hidden; the city stays a dot'}>
      <input type="checkbox" checked={on} aria-label={`Show label for ${city.name}`} onChange={e => onChange(e.target.checked)} />
      <span className="knob" aria-hidden="true" />
      {text && <span className="sl">Label</span>}
    </label>
  );
}

export function ManagePanel({ prefs, model, hour12, onRemove, onHome, onLabel, onAddCity, onClose }: ManageProps) {
  const [askHome, setAskHome] = useState(false);
  const [newHome, setNewHome] = useState('');
  const cities = savedWestToEast(prefs, model.utc);
  const saved = new Set(prefs.ruler);
  const shown = (id: string) => model.byId.get(id)?.labelled ?? false;
  // every dot on the map that is not a saved city, whether or not it currently has a label
  const dots = model.map.filter(v => !saved.has(v.city.id)).map(v => v.city).sort((a, b) => a.lon - b.lon);
  const labelCount = dots.filter(c => shown(c.id)).length;
  const only = cities.length <= 1;
  const others = cities.filter(c => c.id !== prefs.home);
  return (
    <Panel title="Manage cities" count={`${cities.length} / ${MAX_RULER} saved`} onClose={onClose}>
      <div className="msg">Saved cities, west → east. The selected radio is home; every offset and date badge is relative to it.</div>
      <ul className="list whole" role="radiogroup" aria-label="Home city">
        {cities.map(c => {
          const home = c.id === prefs.home, v = model.byId.get(c.id);
          return (
            <li key={c.id} data-saved={c.id}>
              <div className="row">
                <input type="radio" name="wtr-home" id={`wtr-home-${c.id}`} checked={home} aria-label={`Set ${c.name} as home`} onChange={() => { onHome(c.id); setAskHome(false); }} />
                <label className="main" htmlFor={`wtr-home-${c.id}`}>
                  <span className="a">{c.name}<span>{c.country}</span></span>
                  <span className="b">{zoneLine(c, model.utc, hour12)}</span>
                </label>
                <span className={`tag${home ? ' home' : ' num'}`}>{home ? 'Home' : v ? diffLabel(v.diff).replace('HOME', '±0h') : ''}</span>
                <LabelSwitch city={c} on={shown(c.id)} onChange={on => onLabel(c.id, on)} />
                <button type="button" className="rm" aria-label={`Remove ${c.name}`} title={only ? 'At least one city is required' : `Remove ${c.name}`} disabled={only}
                  onClick={() => { if (home) { setAskHome(true); setNewHome(others[0]?.id ?? ''); } else onRemove(c.id); }}><IconX /></button>
              </div>
              {home && askHome && !only && (
                <div className="sub">
                  <div className="msg" role="alert">{c.name} is home. Choose a replacement home before removing it.</div>
                  <div className="line">
                    <select aria-label="New home city" value={newHome} autoFocus onChange={e => setNewHome(e.target.value)}>
                      {others.map(o => <option key={o.id} value={o.id}>{o.name}, {o.country}</option>)}
                    </select>
                    <button type="button" className="ghost" onClick={() => setAskHome(false)}>Cancel</button>
                    <button type="button" className="btn danger" data-confirm-remove-home="" disabled={!newHome} onClick={() => { onRemove(c.id, newHome); setAskHome(false); }}>Set home &amp; remove</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="set">
        <span className="msg">{only ? 'At least one city (home) is required.' : 'Cities from the original map set stay on the map as small dots after removal.'}</span>
        <button type="button" className="btn" onClick={onAddCity}><IconPlus />Add city</button>
      </div>
      <div className="sep" />
      <div className="msg">Map labels, west → east: {labelCount} of {dots.length} map dots are named with their time. Switch a label on to name a dot, or off to leave just the dot. None of these take a ruler slot.</div>
      <ul className="list whole" aria-label="Map labels">
        {dots.map(c => (
          <li key={c.id} data-labelled={c.id} data-on={shown(c.id) ? '' : undefined}>
            <div className="row">
              <span className="main">
                <span className="a">{c.name}<span>{c.country}</span></span>
                <span className="b">{zoneLine(c, model.utc, hour12)}</span>
              </span>
              <LabelSwitch city={c} on={shown(c.id)} text onChange={on => onLabel(c.id, on)} />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ---------------- Settings ----------------
interface SettingsProps { prefs: Prefs; version: string; onFormat: (hour12: boolean) => void; onTheme: (t: Theme) => void; onReset: () => void; onClose: () => void }

export function SettingsPanel({ prefs, version, onFormat, onTheme, onReset, onClose }: SettingsProps) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Panel title="Settings" onClose={onClose}>
      <div className="set">
        <span className="lab">Time format</span>
        <div className="seg" role="group" aria-label="Time format">
          <button type="button" className={prefs.hour12 ? 'on' : ''} aria-pressed={prefs.hour12} onClick={() => onFormat(true)}>12h</button>
          <button type="button" className={!prefs.hour12 ? 'on' : ''} aria-pressed={!prefs.hour12} onClick={() => onFormat(false)}>24h</button>
        </div>
      </div>
      <div className="set">
        <span className="lab">Theme</span>
        <div className="seg" role="group" aria-label="Theme">
          <button type="button" className={prefs.theme === 'dark' ? 'on' : ''} aria-pressed={prefs.theme === 'dark'} onClick={() => onTheme('dark')}>Dark</button>
          <button type="button" className={prefs.theme === 'light' ? 'on' : ''} aria-pressed={prefs.theme === 'light'} onClick={() => onTheme('light')}>Light</button>
        </div>
      </div>
      <div className="sep" />
      {confirm ? (
        <div className="set" role="alertdialog" aria-label="Confirm reset">
          <span className="lab">Reset everything?<small>Restores the ten default cities, Istanbul as home, 12h and dark theme. Applies to every open tab.</small></span>
          <span style={{ display: 'flex', gap: 8, flex: 'none' }}>
            <button type="button" className="ghost" autoFocus onClick={() => setConfirm(false)}>Cancel</button>
            <button type="button" className="btn danger" data-confirm-reset="" onClick={() => { onReset(); setConfirm(false); }}>Reset</button>
          </span>
        </div>
      ) : (
        <div className="set">
          <span className="lab">Reset to defaults<small>Cities, home, time format and theme.</small></span>
          <button type="button" className="ghost" data-reset="" onClick={() => setConfirm(true)}>Reset…</button>
        </div>
      )}
      <div className="sep" />
      <div className="about">
        <b>World Time Ruler {version}</b> · settings are stored on this device (chrome.storage.local) and shared by all open tabs.<br />
        Time zones: IANA rules via the browser, resolved with a bundled Temporal implementation.<br />
        Sunrise, sunset, twilight and the day/night boundary are estimates (SunCalc + USNO approximation).<br />
        The longitude grid is a solar reference (15° per hour), not a map of legal time-zone boundaries.<br />
        Map: Natural Earth 1:110m (public domain). {DATA_SOURCE}<br />
        Full notices: THIRD_PARTY_NOTICES.txt in the extension folder.
      </div>
    </Panel>
  );
}
