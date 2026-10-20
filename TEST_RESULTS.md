# World Time Ruler 1.1.0 — test results

Run on 2026-10-07, macOS (Darwin 27), Node 26.4, Vitest 5.0.3, Playwright 1.63.0 with its bundled
Chromium 153 in headless mode.

## What ran

| Check | Command | Result |
|---|---|---|
| Type check | `tsc --noEmit` | clean |
| Unit tests (Node) | `npm test` | **40 / 40 passed** |
| Browser tests on the built extension folder `dist/world-time-ruler` | `npm run test:e2e` | **15 / 15 passed** |
| Same browser tests on a folder freshly extracted from `dist/world-time-ruler-1.1.0.zip` | `WTR_EXT=<extracted> npx playwright test` | **15 / 15 passed** |
| ZIP contents identical to the folder | `diff -r` | identical |
| Bundle scan | grep of built JS/CSS/HTML | no `eval(` / `new Function`; the only URLs are XML namespaces, React's error-message link text and the GeoNames attribution string — none are fetched |

The browser tests load the real unpacked extension (`--load-extension`) in Chromium and drive the
`chrome-extension://…/index.html` page. They are not a plain web-page preview. Every test also
fails on any console error, page error, CSP violation, failed request, HTTP ≥ 400 or request to a
non-`chrome-extension://` URL.

## Required conversions (each checked twice: in the unit tests and through the editor UI)

| Input | Expected | Result |
|---|---|---|
| 7 Oct 2026, 7:53 AM Istanbul | Tokyo 7 Oct 1:53 PM | pass |
| 〃 | San Francisco 6 Oct 9:53 PM (PREV badge) | pass |
| 7 Oct 2026, 5:30 PM New York | Istanbul 8 Oct 12:30 AM | pass |
| Kathmandu vs Istanbul on both instants | +2h 45m | pass |
| New York, 1 Nov 2026, 1:30 AM | both occurrences offered (UTC−4 → 05:30Z, UTC−5 → 06:30Z); Apply disabled until one is chosen | pass |
| New York, 8 Mar 2026, 2:30 AM | rejected as nonexistent ("clocks jump from 2:00 AM to 3:00 AM"); stays in Live mode | pass |

## Coverage by requirement

* **Toolbar click → dedicated tab** — the service worker's `chrome.action.onClicked` event is fired
  from inside the loaded extension; a new tab opens at `chrome-extension://<id>/index.html`, is the
  active tab, and a second click opens a second tab. No popup is configured. *See "Not verified".*
* **Offline** — with the browser context set offline the page loads completely: 63 map cities,
  country geometry, both bundled fonts report `loaded`, all requests are `chrome-extension://`.
* **CSP / permissions** — manifest is MV3 with `permissions: ["storage"]` only, no host
  permissions, popup, content scripts or New Tab override; no inline script or handlers in
  `index.html`; a `fetch` to a remote host and an injected remote `<script>` are both refused by the
  page's CSP.
* **Controls** — 12h/24h, theme toggle, Add city (search by name / country / zone, IANA zone shown,
  duplicate refused, keyboard add, replace flow at the limit with home locked, adding a non-map city
  puts it on ruler and map), Manage (remove, change home with offsets and PREV/NEXT updating
  immediately, home removal blocked until a replacement is chosen), Settings (format, theme, reset
  with cancel and confirm).
* **Persistence and sync** — changes made in one tab appear in a second open tab without reload;
  survive reload; survive a full browser restart on the same profile; data is in
  `chrome.storage.local` (`chrome.storage.sync` stays empty).
* **Live / Planning** — live mode advances at the minute boundary (fake clock) and refreshes on
  `visibilitychange`; planning shows source city, date and entered time, stays fixed, re-formats in
  24h, and *Back to now* restores live. Selecting a source does not change home.
* **Map and ruler together** — after Apply the ruler cells, map time labels, GMT readout, footer
  instant, night polygon and sun-marker position all change to the same instant.
* **Keyboard / accessibility** — ruler cells focusable; tooltip appears on focus and is wired with
  `aria-describedby`; Enter opens the editor, Enter applies, Escape cancels and returns focus;
  panels close on Escape; date/time validation messages for malformed, impossible and out-of-range input.
* **Layout** — at 1280×720 and 1440×900: ten cities + GMT in one row, no horizontal or vertical
  page scroll, no clipped time/date/offset text in any cell, full names in cell tooltips, none of the
  26 map labels (10 ruler + 16 always-labelled cities) overlapping, top bar not overflowing, ruler 76 px tall (≤ 144). At 924 px the compact
  fallback shows all eleven cells in two rows (≤ 144 px); at 560 px all eleven remain visible in
  three rows.
* **Themes** — computed colours for top bar, ruler, home highlight, planning amber and home dot
  checked in dark and light against the handoff tokens; screenshots in `docs/test-screenshots/`
  were compared by eye with the five handoff screenshots.
* **Time-zone rules (unit)** — gap/overlap edges for New York and Berlin, a 30-minute gap (Lord
  Howe), half- and quarter-hour offsets (Kolkata, Kathmandu, Eucla, St John's, Chatham),
  northern/southern DST direction, date line (Kiritimati vs Honolulu), 23 h and 25 h dates, every
  one of the 395 bundled zones resolves.
* **Solar (unit)** — subsolar point agrees with an independent SunCalc position (sun within 0.6° of
  the zenith there, of the nadir at the antipode) at nine instants; equinox/solstice declinations;
  for every shading layer the subsolar point is inside daylight and the antipode inside night; the
  night polygon agrees with computed altitude on a sampled grid; sunrise/sunset within 4 minutes of
  published times for Istanbul and New York; events always fall inside the city's own local date
  near midnight and across the date line; polar day and polar night (Tromsø, Longyearbyen,
  McMurdo); one sunrise and one sunset inside the 23 h and 25 h New York dates.

## Not verified

* **A physical click on the toolbar icon.** Automation cannot press Chrome's toolbar button; the
  test fires the same `chrome.action.onClicked` event programmatically. The listener, tab creation
  and absence of a popup are verified; the pixel-level click, pinning, and the look of the icon in
  the toolbar are not.
* **Branded Google Chrome.** Tests ran in Playwright's Chromium 153, not in an installed copy of
  Google Chrome, and not through the `chrome://extensions` → *Load unpacked* dialog.
* **A real extension update.** Schema repair and persistence across restart are tested; replacing
  the files and reloading the extension was not exercised end to end.
* **Windows / Linux, display scaling other than 1×, screen readers.** ARIA roles, labels and
  keyboard paths are tested mechanically; no VoiceOver/NVDA pass was done.
* **Pixel-exact match to the handoff.** Comparison with the reference screenshots was visual, not
  an automated image diff.

## Known limitations and deliberate differences from the prototype

* The ruler is 76 px tall with the time above the date (the prototype's own ≤ 1280 px layout) up to
  1900 px wide, and the prototype's 64 px single-line layout above that. At 1280–1440 px the
  single-line layout clips dates and PREV/NEXT badges, as the handoff screenshots show.
* "San Francisco" is ellipsised in its ruler cell at 1280–1440 px; the full name is in the cell's
  tooltip and on the map.
* DST gap and repeated times are rejected / offered as a choice instead of being shifted or
  defaulted (required change from the prototype).
* The daylight band is drawn from the sun's computed altitude across the city's actual local date
  (so it is right on 23 h / 25 h dates and in polar regions) rather than a fixed 40-minute ramp.
* Surface colours follow the handoff's rendered CSS (`brand/colors_and_type.css`), which differs
  slightly from the hex values listed in the handoff README.
* Planning mode is per tab and is not saved; a new tab always opens in Live mode.
* Dates are accepted from 1900 to 2200. Solar times are estimates; within a few minutes at mid
  latitudes, less accurate near the polar circles around the start and end of polar day/night.
* Zone rules come from Chrome's built-in IANA data, so they are as current as the installed Chrome.
* The city list is GeoNames places of 100,000+ people, national capitals, and one place for each
  remaining IANA zone (5,997 entries). Smaller towns are not searchable. Search matches the
  English/ASCII name, country, country code and zone, not alternate-language names.
* Chrome keys an unpacked extension's storage to its folder path: moving the folder starts from
  default settings.
* Each toolbar click opens a new tab (accepted for version 1).
