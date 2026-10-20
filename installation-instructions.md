# World Time Ruler — Installation Instructions

No development tools or local server are needed.

## Install

1. Download `world-time-ruler-<version>.zip` from the [Releases page](https://github.com/babushka99/world-time-ruler/releases/latest) and extract it to a permanent folder.
   Chrome reads the files from there every time it starts, so do not delete, move or rename the folder afterwards.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (switch in the top-right corner).
4. Click **Load unpacked**.
5. Select the `world-time-ruler` folder — the one that directly contains `manifest.json`.
6. Click the puzzle-piece icon in the Chrome toolbar and **pin** World Time Ruler.
7. Click its icon. World Time Ruler opens in its own tab.

If you built from source, load `dist/world-time-ruler/` directly in step 5.

## Updating to a newer build

1. Replace the contents of the installed folder with the new `world-time-ruler` folder (keep the same location).
2. Open `chrome://extensions` and press the reload arrow on the World Time Ruler card.

Saved cities, home city, time format and theme are kept.

## Troubleshooting

- **"Manifest file is missing or unreadable"** — the wrong folder was selected. Pick the folder that directly contains `manifest.json` (`world-time-ruler`), not its parent and not the ZIP.
- **The icon is not in the toolbar** — click the puzzle-piece icon and pin World Time Ruler.
- **The extension disappeared or shows an error after a restart** — the folder was moved, renamed or deleted. Put it back, or use Load unpacked again from its new location.
- **Settings reset to defaults** — Chrome ties an unpacked extension's saved data to its folder path. Loading it from a different path starts with default settings; keeping the same path keeps your cities.
- **"Disable developer mode extensions" prompt at start-up** — normal for unpacked extensions; dismiss it. Managed (work) Chrome profiles may block Load unpacked entirely.
- **Not working in Incognito** — turn on "Allow in Incognito" on the extension's card in `chrome://extensions`.
- **Blank map** — press the reload arrow on the extension card, then reopen the tab.

See `README.md` for usage and rebuild instructions, and `TEST_RESULTS.md` for what was tested.
