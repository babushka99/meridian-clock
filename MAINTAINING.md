# Maintaining Meridian Clock

How the project fits together, how to ship a new version, and the rules that keep users' data safe.
For setting up a development copy, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Rules that must not be broken

1. **Never change the storage key `wtr.prefs`** (`src/lib/storage.ts`). Every installed copy keeps the
   user's cities, home city, time format and theme under that key. Renaming it silently resets
   everyone to the defaults. The `wtr-` prefixes on element ids are from the project's original
   name (World Time Ruler) and are invisible to users; leave them.
2. **No network access, ever.** The content security policy in `public/manifest.json` sets
   `connect-src 'none'`. No remote scripts, fonts, maps or analytics. The browser tests fail on any
   request that leaves the extension.
3. **One permission only: `storage`.** Any new permission triggers a warning to every user on update
   and needs an issue and a clear reason first.
4. **Every bundled library or data file needs a licence that allows redistribution** and must be
   added to the `BUNDLED` list in `scripts/notices.mjs`, so it appears in `THIRD_PARTY_NOTICES.txt`.
5. **Back up before rebuilding or renaming.** `npm run build` empties and refills
   `dist/meridian-clock/`. If a Chrome profile loads the extension from that folder, copy it to
   `backups/` first (that folder is git-ignored). Never delete or rename a folder Chrome loads from:
   Chrome ties an unpacked extension's saved settings to the folder path.

## Releasing a new version

1. Bump `version` in **both** `public/manifest.json` and `package.json` (they must match).
2. Add an entry at the top of `CHANGELOG.md`.
3. Run `npm test`, `npm run build` and `npm run test:e2e`. All must pass.
4. Commit, then tag and push:

   ```sh
   git tag -a v1.2.0 -m "Meridian Clock 1.2.0"
   git push origin main --tags
   ```

5. The **Release** workflow (`.github/workflows/release.yml`) builds the extension, checks the tag
   matches the manifest version, and publishes `meridian-clock-<version>.zip` on the Releases page
   with auto-generated notes. Check the run under the repository's **Actions** tab.

The **CI** workflow runs unit tests, the build and the browser tests on every push to `main` and
on every pull request.

## Screenshots

The browser tests write the screenshots in `docs/test-screenshots/` every time `npm run test:e2e`
runs, so they always match the current build. The README's Features and Screenshots sections use
them directly. Commit the refreshed images with the change that caused them.

## How the main pieces work

| Area | File | Notes |
|---|---|---|
| Toolbar button | `src/background.ts` | Opens the page in a new tab. No popup, no New Tab override. |
| Time zones and DST | `src/lib/time.ts` | Bundled Temporal polyfill on top of Chrome's IANA database. Repeated hours (clocks back) offer both instants; skipped hours (clocks forward) are rejected with the gap shown. |
| Sun and day/night | `src/lib/solar.ts`, `src/lib/mapgeo.ts` | Subsolar point, twilight bands, sunrise/sunset estimates. |
| Map sizing | `makeProjection` in `src/lib/mapgeo.ts` | Fits the whole globe when the map area is 2:1 or taller. On wider windows it fills the full width and crops the polar caps, keeping latitude `CROP_CENTRE` (10° N) in the middle. |
| Map layers | `src/components/WorldMap.tsx` | Bottom to top: ocean, land, graticule, day/night shading, country borders again, the GMT hour grid, cities. Borders and the hour grid sit above the shading so they stay visible on the night side. |
| Label placement | `src/lib/labels.ts` | Greedy placement, local search, then a deterministic annealing pass. Ruler cities always keep a label. If an extra map label still overlaps other text by more than `CLASH` (40 px²), it is dropped, its dot stays, and the rest re-settle. |
| Cities | `src/lib/cities.ts`, `src/data/cities.json` | ~6,000 GeoNames cities. The ruler holds at most `MAX_RULER` (10). Extra always-labelled map cities go in `MAP_LABELLED`; adding one there does not use a ruler slot. |
| Colours | `src/lib/theme.ts`, `src/styles.css` | Dark and light palettes. In the light theme, night-side labels get a grey-blue outline and darker text. |
| Saved settings | `src/lib/prefs.ts`, `src/lib/storage.ts` | Validation rules and `chrome.storage.local`, synced live across open tabs. |

## Updating the city data

`npm run data:cities` rebuilds `src/data/cities.json` from the GeoNames files in `data-src/`.
GeoNames data is CC BY 4.0, so keep the attribution in `scripts/notices.mjs` and the README.

## Project history

The project started as **World Time Ruler** (versions 1.0.0 and 1.1.0, private) and was renamed
**Meridian Clock** for its first public release, 1.1.0, on 21 October 2026. See `CHANGELOG.md`.
