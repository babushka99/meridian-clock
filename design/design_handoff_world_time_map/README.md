# Handoff: World Time Ruler — FK-L001 (dedicated-tab world time map)

## Overview
A single-screen browser-extension tab (also works as a standalone web page) that shows world time on a flat equirectangular world map with a live day/night terminator, 60+ cities as dots, ten "ruler" cities with always-visible local times, a GMT offset ruler across the top, and a dense city time bar along the bottom. Supports a planning mode (pick any city, enter a date/time, everything converts), 12h/24h, hover tooltips, and a one-click light/dark theme.

Owner: Faisal Khan LLC. Design system: **Mission Control** (Bloomberg Terminal × Linear × NASA Mission Control). Read `brand/DESIGN_SYSTEM.md` first.

## About the design files
`World Time Map.html` is a **working HTML design reference** — a prototype showing the intended look and behavior, not production code to ship as-is. Recreate it in the target environment (the extension's existing stack, or React + TypeScript + Vite if none exists) using its patterns. The prototype's JS is deliberately plain so every algorithm (time zones, DST, solar geometry, label placement) can be ported 1:1.

Open the HTML directly in a browser to see the live reference (needs network for d3/topojson/world-atlas CDNs and Google Fonts).

## Fidelity
**High-fidelity.** Colors, type, spacing, states and copy are final. Recreate pixel-accurately. All values below are the actual values in the prototype; where the prototype uses CSS variables, the variable name is given and resolved in `brand/colors_and_type.css`.

## Layout (single view, fills viewport, no page scroll)
Vertical flex column, `height: 100vh`, `overflow: hidden`:

1. **Top bar** — 44px, `--bg-base`, bottom border `1px --line-weak`, padding 0 16px, space-between.
   - Left (gap 12): wordmark "WORLD TIME RULER" (Inter 11px/700, 0.14em tracking, uppercase); mode pill (LIVE green / PLANNING amber); `Home · Istanbul`; `GMT · 08:53 · Tue, Oct 7` (meta: JetBrains Mono 11px, `--fg-tertiary`, bold part `--fg-secondary`; the GMT date part hides < 1100px).
   - Right (gap 8): 12h/24h segmented control (26px high, mono 11px/600, active = `--bg-elevated` + `--fg-primary`); "Add city" button; "Manage" button; theme toggle (sun icon, 28×28); settings icon (28×28). Buttons: 28px high, 1px `--line-weak`, radius 4, `--bg-raised`, Inter 12px/500 `--fg-secondary`; hover → `--bg-elevated` + `--fg-primary`. Icons: Lucide, 14px, stroke 1.75.
   - Add city / Manage / Settings are **visual only in this prototype** (see Out of scope).
2. **Planning strip** — 32px, only in planning mode. `--bg-raised`, bottom border. Left: amber dot · `PLANNING` (mono 12px/600, 0.08em) · city · "October 7, 2026" · "5:30 PM" · optional DST warning (11px, `--fg-tertiary`). Right: "Back to now" primary-outline button (cyan border/text, hover fills cyan with `--fg-inverse` text), Lucide `rotate-ccw`.
3. **Map** — `flex: 1`, `--bg-base`, SVG fills it. Legend bottom-left, solar meta bottom-right (both mono 10px, non-interactive).
4. **City bar** — 64px, `--bg-raised`, top border, CSS grid `repeat(11, minmax(0,1fr))` (10 ruler cities + GMT), sorted west→east by current UTC offset.
5. **Footer** — 24px, mono 10px `--fg-muted`: left `Live · 2026-10-07 05:53Z · 63 cities on map · 10 + GMT on ruler · solar offsets ±15° per hour, ticks every 30 min`; right `Solar geometry NOAA approx. · DST per IANA · Natural Earth 110m`.

## Map specification
- **Projection:** d3 `geoEquirectangular`, `fitExtent([[12,30],[W-12,H-28]], Sphere)`. Top inset 30px reserves room for the GMT ruler labels.
- **Geometry:** Natural Earth 110m countries via `world-atlas@2.0.2/countries-110m.json` (TopoJSON → `topojson.feature`). Never hand-draw coastlines. In production, bundle the JSON locally (~110 KB).
- **Layers (bottom→top):** sphere fill → land → graticule (15° × 30°) → GMT grid → day/night overlay → sun marker → cities.
- **GMT ruler (top):** vertical line every 7.5° (= 30 min). Full-hour lines: dashed `2 4`, extend 7px above the sphere; label above (`y = top-10`), mono 9px: `−11 … −1  GMT  +1 … +11`; GMT line is solid `gridZero`, label cyan/700. Half-hour lines: 4px tick above the sphere + faint dotted `1 6` line through the map. Edge labels `−12` / `+12` at x=12 / W−12 in `lblEdge`. These are **solar** offsets (15°/h), not political zones — the footer says so.
- **Day/night:** compute the subsolar point (see algorithm), then draw with `d3.geoCircle`: a 90° circle around the subsolar point filled `dayWash`; around the antipode three nested circles r=96°/90°/84° filled `night1/2/3` (stacked translucency = twilight gradient); the 90° circle also strokes the terminator in `term` 0.8px @ 0.7 opacity. Sun: 3px circle in `sun` with a 6px `sunRing` stroke.
- **Cities:** `<g class="city">` at projected lon/lat. Children in order: hit ring (r9 transparent), halo (r7, cyan stroke only for home), name text, time text, then the dot **on top**. Dot: ruler r3.5 stroke 1.5 / minor r2.5 stroke 1, stroke `dotStroke`. Fill: home → `home`; day → `day` (minor `dayMinor`); night → `night` (minor `nightMinor`). Hover: dot r4.5.
- **Labels:** text has a paint-order stroke halo (3px, map background color). Name: Inter 10px/600 0.06em uppercase `--fg-secondary` (`--fg-tertiary` when night, cyan when home). Time: mono 10px/500 `--fg-tertiary`. **Only ruler cities are labelled**; minor cities are dots only (hover reveals name via tooltip).
- **Label placement algorithm:** process ruler cities first (then minors, which are always hidden). Seed collision boxes with every dot (10×10). Candidate slots for a ruler city: above (name at dy −9, time at dy +18), right (dx +7, name dy −1, time dy +10), left (dx −7), below (name dy +16, time dy +27). Cost = summed overlap area with existing boxes, dot boxes weighted ×40; slots that leave the viewport are skipped. Pick lowest cost (break on 0); ruler cities always get placed. Push the chosen boxes.
- **Tooltip** (hover dot or bar cell): 190px min, `--bg-overlay`, 1px `--line-strong`, radius 4, `--shadow-popover`, padding 10/12. Rows: name + country · big time (mono 22px/500, −0.02em; AM/PM 11px) · weekday/date + diff vs home (coloured; appends "· prev day"/"· next day") · Day/Night · IANA zone + UTC±h · Sunrise (amber) / Sunset (violet) · GMT time · hint "Home city" or "vs Istanbul · click to convert from here". Positioned 14px right of the dot, clamped to the map, vertically centred.
- **Legend** chips: Daylight `#e8d49a`, Twilight gradient `#1c2742→#8a6f4a→#e8d49a`, Night `#1c2742` (border `#35425f`), Sunrise/sunset 1px `#a8b3cc`, Local time 2px cyan with glow, then muted text "Hover a city for local time · click to convert". Light-theme swatches: `#f2d98a`, `#c9d2e3→#e2cfa0→#f2d98a`, `#c9d2e3`, `#5f6b85`, `#0084b3`.

## City bar cell (64px)
Padding 0 12px, left border `--line-faint`, cursor pointer, hover `--bg-elevated`.
- Row 1: name (Inter 10px/600 0.08em uppercase `--fg-secondary`, ellipsis) ↔ diff (mono 10px/600; HOME cyan, negative violet, positive blue).
- Row 2: time (mono 15px/500 −0.02em; AM/PM 10px `--fg-secondary`) ↔ date "Tue, Oct 7" (Inter 10px `--fg-tertiary`) + optional pill `PREV` (violet) / `NEXT` (amber), mono 9px/600, 1px border, pill radius.
- Daylight band: 4px tall, radius 2, gradient = night→twilight(2.8% ramps)→gold between sunrise% and sunset%; 1px sunrise/sunset ticks (8px tall, `--fg-secondary`); 2px cyan "now" marker with `--glow-cyan`.
- Home cell: `rgba(0,229,255,.045)` background + 2px inset cyan top line. GMT cell: grey top line, no band, not clickable, country text "UTC+0".
- < 1100px: row-1 diff hides and reappears after the date; weekday hides; name letter-spacing 0.04em; padding 0 8px.

## Convert editor (popover)
Opens on click of a city dot or bar cell. 272px, `--bg-elevated`, 1px `--line-strong`, radius 4, popover shadow, padding 14, gap 10. Header: `CONVERT FROM` (mono 10px/600 0.14em cyan) ↔ "New York, USA" (12px/600). Fields (label column 40px): Date — text input `YYYY-MM-DD`; Time — text input `5:30` + AM/PM segmented (hidden in 24h). Inputs 28px, `--bg-base`, 1px `--line-strong`, radius 2, mono 12px, focus border cyan. Note line (mono 10px) shows validation: "Enter a date as YYYY-MM-DD", "Enter a time like 5:30", "Invalid time". Actions right-aligned: Cancel (ghost) · Apply (solid cyan, `--fg-inverse` text). Enter applies, Esc cancels, clicking the map outside closes. Positioned 16px right of the dot, clamped in the map.

Apply → planning mode: the chosen wall time in the chosen city is resolved to a UTC instant; every city, the terminator, the GMT readout and the bar re-render for that instant. DST edge cases: a non-existent local time (spring gap) is shifted forward with warning "Entered time does not exist in <city> (DST gap) · shifted forward"; an ambiguous time (fall-back) uses the first occurrence with warning "Ambiguous during DST fall-back · first occurrence used". "Back to now" returns to live.

## Interactions & behavior summary
- Live clock: re-render every 15 s (minute precision is enough) when in live mode.
- 12h/24h: affects every time string (map labels, bar, tooltip, GMT readout, editor AM/PM visibility).
- Theme toggle: toggles `body.light`, swaps the JS palette object, redraws the map, persists to `localStorage['wtr-theme']`.
- Resize: ResizeObserver on the map container → re-fit projection → redraw.
- Boot: if the container has zero size (background tab), poll every 100 ms until it has size; also redraw on `visibilitychange`.
- Hover a bar cell shows the same tooltip as its dot.
- Animation: none beyond hover colour/size changes (design system: no bounces; ease `cubic-bezier(0.22,1,0.36,1)`, 120–200 ms if any transitions are added).

## State
```
homeIdx: number        // index into CITIES; default = Istanbul (resolve by name, not position)
is12: boolean          // default true
mode: 'live' | 'plan'
planUtc: number|null   // ms epoch of the planned instant
planMeta: { city, date, time, warn } | null
editor: { idx, ampm } | null
hover: number|null     // city idx
theme: 'dark' | 'light' (persisted)
```
Derived per render: for each city → zone offset, local wall time, diff vs home, day delta vs home date, sunrise/sunset minutes, isDay.

## Algorithms (port exactly; all in the HTML)
- **Zone math:** `Intl.DateTimeFormat(tz, hourCycle:'h23').formatToParts` → wall parts; offset = wall-as-UTC − instant. `wallToUtc(tz,y,m,d,H,M)`: guess with current offset, correct once with the offset at the guess, then detect non-existent / ambiguous via round-trip and ±1 h checks. No tz library required.
- **Sunrise/sunset:** NOAA/Wikipedia sunrise-equation (Julian day, mean anomaly, equation of centre, ecliptic longitude, solar transit, declination 23.4397°, hour angle with −0.833° refraction). Polar edge cases: all-day / all-night.
- **Subsolar point:** declination from ecliptic longitude; longitude = RA − GMST·15, normalised to ±180.
- **Solar offset grid:** 15° per hour, 7.5° per 30 min.

## Design tokens (dark — canonical; from brand/colors_and_type.css)
Surfaces: `--bg-void #05070d`, `--bg-base #0a0e18` (map bg `#0a0f1c`), `--bg-raised #0f1522`, `--bg-elevated #151c2d`, `--bg-overlay #1a2338`.
Text: `--fg-primary #e6ecf7`, `--fg-secondary #a8b3cc`, `--fg-tertiary #6b7899`, `--fg-muted #4a5570`, `--fg-inverse #05070d`.
Lines: `--line-faint #1a2133`, `--line-weak #242e47`, `--line-strong #35425f`.
Accents: cyan `#00e5ff` (home/live/now), amber `#ffb020` (planning/sunrise/NEXT), magenta `#ff3d8b`, green `#4ade80` (LIVE), blue `#5b8dff` (night dots, +diff), violet `#a78bfa` (sunset, −diff, PREV). Glows at ~20% alpha.
Map palette: ocean `#0a0f1c`, land `#1b2440` stroke `#35425f` 0.6px, graticule `#141c2c`, grid `#1a2133` / half-hour `#121a2a` / GMT `#35425f`, day wash `rgba(232,212,154,.05)`, night layers `rgba(5,7,13,.25/.35/.30)`, terminator `#8a6f4a`, minor dots day `#b3a26f` night `#3a5fb8`. Daylight band: night `#1c2742`, twilight `#8a6f4a`, day `#e8d49a`.

**Light theme palette** (full object `THEMES.light` in the HTML): bg `#f7f8fb` / raised `#ffffff` / elevated `#eef1f6`; text `#0f1522 / #3a4560 / #5f6b85 / #8b95ad`; lines `#e3e7ef / #d3d9e5 / #b7c0d2`; cyan `#0084b3`, amber `#b86e00`, green `#1d8a4a`, blue `#2f5fd6`, violet `#6d4fd1`; ocean `#dfe6f1`, land `#f4f6fa` stroke `#9aa6bd`, terminator `#b8894a`, sun `#e08a00`.

Type: Inter (UI) + JetBrains Mono (all numbers/times/zones), tabular numerals everywhere. Sizes used: 9, 10, 11, 12, 15, 22 px. Section/kicker labels uppercase, 0.08–0.14em tracking.
Spacing: 4px base (8/12/16). Radii: 2px inputs, 4px cards/buttons/popovers, pill for chips. Shadows: `--shadow-popover`. No gradients except the daylight band and legend swatches. No emoji, Lucide icons only (plus, sliders-horizontal, settings-2, rotate-ccw, sun, x, search).

## Data: cities
Ruler (always labelled, in bar): San Francisco, Chicago, New York, London, Berlin, Istanbul (home), Dubai, Mumbai, Singapore, Tokyo — plus a GMT reference cell.
Dots: Nairobi, Lagos, Cape Town, Cairo, Riyadh, Karachi, Kathmandu, Hong Kong, Beijing, Seoul, Auckland, Sydney, Melbourne, Perth, Jakarta, Lisbon, Dublin, Toronto, Dallas, Mexico City, Montevideo, São Paulo, Buenos Aires, Halifax, Edmonton, Vancouver, Seattle, Bangkok, Dhaka, Dar es Salaam, Rabat, Vilnius, Moscow, Kyiv, Reykjavík, Oslo, Helsinki, Amsterdam, Milan, Kuala Lumpur, Manila, Caracas, Santiago, Praia, Accra, Addis Ababa, Ulaanbaatar, Niamey, Tunis, Lima, Georgetown, Anchorage, Honolulu.
Each entry: `{ name, country, tz (IANA), lat, lon, ruler }` — the full array with coordinates is in the HTML. Keep IANA ids (e.g. Kyiv uses `Europe/Kiev` for compatibility).

## Out of scope / to build (from the original brief, not implemented in the prototype)
- **Add city / Manage cities** panel: search with IANA lookup, home-city picker (radio), saved list west→east, remove, capacity rules (ruler cap 10 at ≥1440px; 7 at 1280px — ruler never scrolls, replace/remove to add). The earlier mock `World Time Ruler.dc.html` in the parent project shows the intended panel; ask for it if needed.
- Settings panel; persistence of cities/home/format (use `chrome.storage.sync` or localStorage).
- Extension packaging (manifest v3, dedicated tab, offline tz data). Bundle d3-geo + topojson-client + the 110m TopoJSON locally; do not rely on CDNs in an extension.

## Assets & dependencies
- Fonts: Inter + JetBrains Mono (Google Fonts; see brand CSS) — bundle for the extension.
- Icons: Lucide (inline SVG in prototype).
- Map data: Natural Earth 110m via world-atlas@2.0.2 (public domain).
- Libraries in prototype: d3@7.9.0, topojson-client@3.1.0 (CDN). Only `d3-geo`, `d3-selection` are actually needed.

## Screenshots (`screenshots/`)
- `01-dark-live.png` — default live view, dark theme.
- `02-dark-tooltip-new-york.png` — hover tooltip on New York.
- `03-dark-convert-editor.png` — convert-from popover open on New York.
- `04-dark-planning-mode.png` — planning mode (New York 5:30 PM, Oct 7 2026) with amber strip and Back to now.
- `05-light-live.png` — light theme.

## Files in this bundle
- `World Time Map.html` — the hi-fi working reference (open in a browser).
- `brand/colors_and_type.css`, `brand/claude-tokens.css` — design tokens the HTML loads.
- `brand/DESIGN_SYSTEM.md` — Mission Control design system guide (voice, color, type, spacing, states, iconography).
- `original_brief_FK-L001.md` — the original ASCII brief for the dedicated-tab layout.
- `screenshots/` — reference captures of the five key states.
