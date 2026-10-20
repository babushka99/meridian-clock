# Faisal Khan LLC — Mission Control Design System

A dark-first, data-dense design system for an AI-native single-operator consulting firm. Aesthetic reference points: **Bloomberg Terminal × Linear × NASA Mission Control**.

The design thesis: *Faisal is the CEO of an AI workforce.* The system must make that workforce visible, measurable, and controllable at a glance — every pixel earning its place.

---

## Index

Files at the root of this design system:

| File | What's in it |
|---|---|
| `README.md` | This file — overview, content fundamentals, visual foundations, iconography |
| `colors_and_type.css` | CSS custom properties (colors, type, spacing, radii, shadows) + semantic classes |
| `SKILL.md` | Agent-skill manifest — lets this system be invoked as a Claude Skill |
| `fonts/` | (Webfonts — loaded via Google Fonts CDN; see CSS) |
| `assets/` | Logos, icons, and any brand imagery |
| `preview/` | Small HTML cards populating the Design System tab |
| `ui_kits/dashboard/` | Mission Control dashboard — full interactive recreation |

---

## Sources

The system was built from a single artifact brief provided by the user: a detailed written spec for **"Mission Control — Faisal Khan LLC"** (Artifact A001). No codebase, Figma file, or existing brand materials were attached. All visual decisions derive from that brief plus reasonable defaults for the stated aesthetic.

**This means:** this design system is a *proposed* direction. If real brand materials (logos, fonts, color values) exist, they should be substituted in — see the *Caveats* section at the bottom of the README.

---

## Products represented

The brief describes **one primary surface**: the Mission Control dashboard — a desktop-first (27" display) web application for the operator. Within the dashboard, these sections are treated as sub-surfaces:

1. **Top bar** — global status, search, operator presence
2. **AI Agent Fleet** — org-chart view of the 37-agent workforce (hero section)
3. **Infrastructure & Token Economics** — model usage, token consumption, cost per dept
4. **Project Portfolio** — grid of websites, apps, internal tools
5. **Executive Business Panel** — financials, invoices, pipeline
6. **Operator Cockpit** — inbox, calendar, tasks, scratchpad
7. **Team Presence** — human + AI workforce strip
8. **Leads & Pipeline Intelligence** — collapsible right-drawer

The brief also references a portfolio of products belonging to Faisal Khan LLC — `faisalkhan.com`, `themoneywiki.com`, `money-transmitter-license.com`, `DealHarbor.app`, `LexMonitor.app`, `MoneyWiki.app`, `MTO Global Map`, `MSB Bank Directory`, `Financial Data Boards Inc.` — but these appear *inside* the dashboard as cards, not as separate design surfaces.

---

## Content Fundamentals

The voice of Mission Control is **operator-facing, terse, technical, confident**. It speaks to one reader — the operator (Faisal) — and assumes intelligence, context, and speed. It is never marketing copy and never cheerful.

### Tone & voice
- **Terse.** Labels are 1–3 words. Status messages are fragments, not sentences.
- **Technical & specific.** Exact numbers, exact times, exact model names. Never "lots" — always `1,284`. Never "recently" — always `14m ago`.
- **Confident but neutral.** No exclamation points. No hedging ("maybe", "probably"). AI confidence is expressed as a percentage badge, not as prose.
- **Second person implicit.** The dashboard addresses the operator directly without saying "you". Labels are imperatives or nouns: `Review`, `Delegate`, `Priority Inbox` — not *"Your priority inbox"*.
- **I vs. you:** Neither. System speaks as an instrument, not a person. The agents themselves have names, which humanizes the fleet — but the chrome around them stays neutral.

### Casing & formatting
- **SECTION HEADERS** are **UPPERCASE** with tracked letter-spacing (`0.08em` to `0.14em`). Think NASA panel labels.
- **Card titles** use Title Case.
- **Metrics** are tabular numerals in mono font. Always include units: `$24,840`, `47ms`, `8.7K`, `62%`.
- **Dates** are short, e.g. `Apr 22` or `14:32 TRT` (Istanbul time).
- **Agent names** appear as written — first name only (`Sarah`, `Mariam`, `Priya`).
- **Model names** appear as written with version: `Opus 4.7`, `Sonnet 4.6`, `Haiku 4.5`, `GPT-5`, `Gemini 2.5`.

### Vocabulary
- Agents have **status**, not "mood": `ACTIVE`, `IDLE`, `RUNNING TASK`, `ERROR`, `OFFLINE`.
- Operations use **verbs of delegation**: `Delegate`, `Assign`, `Dispatch`, `Route`, `Triage`.
- AI recommendations are always **suggestions**: `AI suggests → Reply now`, `AI suggests → Delegate to Sarah`.
- Money is USD, always formatted with the `$` prefix and thousands commas.

### Emoji policy
**No emoji.** The aesthetic is instrument-panel serious. Emoji break the cockpit metaphor. Use Lucide icons or colored status dots instead.

### Examples

Good (in-voice):
- `TOTAL AGENTS DEPLOYED  ·  37`
- `Sarah · Europe & Americas · Opus 4.7 · ACTIVE`
- `Pipeline value (weighted)  $214,000`
- `AI-triaged 47 emails this morning`
- `47ms p95  ·  99.98% uptime`

Bad (out-of-voice):
- ~~"Great job! You've got 37 agents deployed today! 🚀"~~
- ~~"Your pipeline is looking pretty good this month"~~
- ~~"You might want to reply to this email soon"~~

---

## Visual Foundations

### Colors
- **Surfaces** are a stack of near-black deep navies: `#05070d` → `#0a0e18` → `#0f1522` → `#151c2d` → `#1a2338`. No pure black; everything carries a trace of cool blue.
- **Foreground** steps from `#e6ecf7` (primary) → `#a8b3cc` (secondary) → `#6b7899` (tertiary) → `#4a5570` (muted). Never pure white — always cool-leaning off-white.
- **Neon accents** are the signal layer: electric **cyan** `#00e5ff` (primary, active data), **amber** `#ffb020` (caution/idle), **magenta** `#ff3d8b` (alerts/errors), **green** `#4ade80` (healthy/success), **blue** `#5b8dff` (running/info), **violet** `#a78bfa` (secondary series).
- **Status semantic:** green=active, amber=idle, magenta=error, blue=running task, muted=offline.
- Accents get a matching **glow** at ~20% alpha for data emphasis. Glows are never decorative — they indicate *live signal*.

### Type
- **Sans-serif (Inter):** all labels, body copy, UI chrome.
- **Monospace (JetBrains Mono):** all numerical metrics, timestamps, code, model names, API identifiers. This creates the Bloomberg-terminal reading rhythm.
- **UPPERCASE with letter-spacing** for section labels and kickers — the NASA panel treatment.
- Tabular numerals (`font-variant-numeric: tabular-nums`) on every metric so numbers align in columns.
- Big metric numerals use mono weight 500 with tight tracking (`-0.02em`).

### Spacing
- 4px base unit. Most spacing is `8 / 12 / 16 / 24`. Cards get `20–24px` internal padding; dense rows (agent lists, invoice rows) use `8–12px`.
- The grid is **12-column at desktop** (the brief's primary viewport is a 27" display). Gutters are `16px`.

### Backgrounds
- **No gradients** — everything is flat flood-filled near-black surfaces. The only exception: ultra-subtle radial "scanner sweeps" allowed on the agent org-chart hero area at 2–4% opacity.
- **No hand-drawn illustrations, no photographs, no textures.** The brand is an instrument panel, not a lifestyle.
- **Optional grid overlay** (1px lines at `--line-grid` on 8px grid) allowed on the hero section or chart backgrounds to reinforce the NASA feel — always subtle, always decorative-not-functional.

### Animation
- **Ease:** `cubic-bezier(0.22, 1, 0.36, 1)` (smooth out). Durations: `120ms` (fast), `200ms` (base), `400ms` (slow), `2000ms` (pulse loops).
- **Number tickers** animate on load (rolling odometer or count-up).
- **Pulse** animation on active agent nodes — opacity and/or glow radius oscillates over 2s.
- **No bounces, no wobbles, no spring physics.** The brand does not have personality; it has precision.
- **Fade + slight translate-y (4–8px)** for card mount. Drawers slide with `200ms` ease-out.

### Hover states
- Cards: subtle lift — `translateY(-1px)`, border brightens from `--line-weak` → `--line-strong`, no color change.
- Buttons: background step-up (+1 level in the surface scale).
- Icons in rows: color shifts to `--fg-primary` (from `--fg-tertiary`), no size change.
- Agent nodes: reveal tooltip; node scales `1.05`; glow intensifies.

### Press states
- Buttons/nodes: `transform: scale(0.98)`, faster transition (`100ms`).
- No color change on press — the scale alone signals the click.

### Borders
- Standard is `1px solid var(--line-weak)` (`#242e47`).
- Emphasized inputs/cards-in-focus: `--line-strong` (`#35425f`).
- Card dividers inside dense lists: `--line-faint` (`#1a2133`).
- **No double-borders, no dashed borders** outside of chart elements.

### Shadows & elevation
- **Outer shadows are minimal.** `--shadow-card` is a 2px/8px drop with 40% alpha — just enough to lift a card off the surface.
- **Inset highlight** on cards: `0 1px 0 0 rgba(255,255,255,0.02) inset` — a single-pixel top-edge sheen that reads as "machined metal."
- **Glows** (`--glow-cyan`, etc.) are used *semantically* — only where live data is flowing, never decoratively.

### Transparency & blur
- **Sticky top bar** uses `backdrop-filter: blur(12px)` + `background: rgba(10,14,24,0.8)` — you see the content scrolling beneath.
- **Drawers and modals** get `rgba(5,7,13,0.9)` + blur.
- **Cards are opaque.** No glassmorphism on content surfaces — that's a web-design trope this brand rejects.

### Corner radii
- **Mostly sharp.** `--radius-sm` (4px) on cards and buttons. `--radius-xs` (2px) on input fields.
- **Pills** for status chips and agent badges (`--radius-pill`).
- **Never `rounded-2xl`** / never `border-radius: 16px+`. This aesthetic is not "friendly consumer app."

### Cards
- Background: `--bg-raised` (`#0f1522`).
- Border: `1px solid --line-weak`.
- Radius: `4px`.
- Padding: `20–24px` outer; `12–16px` for dense list items inside.
- Optional `--kicker` label top-left (uppercase, tracked, mono, cyan).
- Optional `⋯` menu top-right (appears on hover).

### Layout rules
- **Sticky top bar** (64px tall) always pinned.
- **Collapsible left nav** (220px expanded, 56px collapsed).
- Main content: 12-col grid, `16px` gutters, max-width `1680px`.
- **Mission Control uses a `12-col` hero split 8/4** (agent chart / stats panel).
- **Right-side drawer** (Leads panel) slides from edge — overlays content, not inline.
- Footer strip is thin (`32px`), mono, shows system vitals.

### Imagery vibe
- The brief calls for **no photography**. Imagery is data visualization — charts, graphs, nodes, sparklines. Color of imagery is always derived from the neon-accent palette. No warm tones, no grain, no soft focus.

---

## Iconography

See the `assets/` folder and the ICONOGRAPHY section below.

### Icon system

- **Primary icon library: Lucide** (https://lucide.dev) — loaded via the `lucide` CDN (`lucide@latest`). Stroke-only, 1.5px stroke weight, 24×24 viewport by default but rendered at 16px in UI chrome.
- The brief explicitly specifies `lucide-react`. All UI chrome icons are Lucide.
- In the dashboard, icons are rendered at **14px or 16px** with `color: currentColor`, inheriting from the parent — typically `--fg-tertiary` (`#6b7899`) in labels and `--fg-primary` on hover.
- **Status dots** are NOT icons — they're 6–8px colored discs using the semantic status colors, often with a matching glow.
- **Agent avatars** are stylized monogram-in-ring badges (first-letter in mono font) — not Lucide icons. Colored ring uses the agent's status color. Some agent cards can show Lucide `bot` / `sparkles` icons as departmental glyphs.
- **Model badges** are small pill chips with the model name (`Opus 4.7`, `Sonnet 4.6`) in mono-bold, no icon inside. Colored by tier (Opus=cyan, Sonnet=blue, Haiku=violet, GPT=green, Gemini=amber).

### When to use which

| Use case | Solution |
|---|---|
| UI chrome (menus, buttons, meta) | Lucide icon at 14–16px |
| Department glyphs (Sales, Content, etc.) | Lucide icon at 16px in a 28px colored-square container |
| Agent identity | Monogram badge (mono letter in colored ring) |
| Status (active/idle/error) | Colored dot with glow, NOT an icon |
| Logo | Custom SVG wordmark (see `assets/logo.svg`) |
| Project favicons | Simple 16px monogram or Lucide glyph (not real site favicons) |

### Emoji / Unicode
- **No emoji anywhere.** See Content Fundamentals.
- **No decorative Unicode** (★ ◆ ▲ etc.). The only Unicode permitted is the dot separator `·` in meta strings (e.g. `Sarah · Europe & Americas · Opus 4.7`).

### SUBSTITUTIONS & CAVEATS
- Lucide via CDN is a **reasonable default** but may differ from what a real codebase uses. If the actual product uses another icon set (Heroicons, Phosphor, custom SVGs), substitute.
- All icon imagery in this system is from Lucide. **No hand-drawn SVGs** were authored for this system.

---

## Caveats / Open questions for the user

1. **No real brand assets** — logo, typeface, exact colors were all inferred from the written brief. **Please attach real brand materials if they exist.**
2. **Fonts are Google-Fonts substitutes** — Inter + JetBrains Mono are solid, free, well-known defaults that match the described aesthetic. If the real brand uses (e.g.) IBM Plex, JetBrains Mono, or Söhne — flag and I'll swap.
3. **Only one product surface** (the dashboard) is represented, because that's all the brief describes. If there's a marketing site, mobile app, or docs site, say the word and I'll add a kit.
4. **No Figma or codebase** was provided, so components in the UI kit are visual-recreation-from-spec, not pixel-exact reproductions. They are modular and reusable but not validated against a source of truth.
5. **Mock data** is plausible-synthetic per the brief's "Mock Data Philosophy" guidance — not real Faisal Khan LLC numbers.
