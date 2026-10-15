# Aether Grid React console

The console is the app. The collector (`collector/aether.py`) serves this
build from `web-react/dist/` together with the API on one port, so one
process on `:8792` is UI + data. Without `?demo` it runs on the live feed
(`/api/snapshot` + `/api/stream` SSE, poll fallback); `?demo` runs the
seeded in-browser simulator (a 60 s idle → burst → pressure → overflow →
recover story loop) with no collector.

## Stack

Vite 5, React 18, Tailwind CSS 3.4 with PostCSS and Autoprefixer,
lucide-react for icons, and `@fontsource-variable/jetbrains-mono`
self-hosted. Plain `.jsx`, because the repo has no TypeScript.

All motion is conductor-driven (see below). The console uses no animation
library. Canvas painters are pure functions. Text chrome animates with CSS
transitions and the `--heat`, `--alert` and `--flow` variables the
conductor publishes.

## Scene architecture (read before touching visuals)

`src/scene/SceneRoot.jsx` is the only component that touches the feed and
the only place a timer exists. It owns one conductor
(`src/scene/conductor.js`):

- **clock.** One rAF loop advances `conductor.t` and calls every
  registered painter (`src/scene/Canvas.jsx`). Canvases read the latest
  snapshot off the conductor. React state changes at feed rate only
  (≤ 1 Hz), so the tree never re-renders per frame. A held feed or
  `prefers-reduced-motion` stops the clock and settles every canvas on a
  static frame.
- **event bus.** Each feed tick, `translateSnap` diffs consecutive
  snapshots and emits the canonical events (`request_arrived`,
  `token_generated`, `kv_slot_changed`, `vram_pressure`, `anomaly`).
  Emits fan out to `conductor.on(type, fn)` subscribers and leave frame
  traces (helix kick, KV flashes, pings) that the painters consume. One
  event ripples across the scene in the same frame.
- **scene state.** Smoothed `heat`, `alert`, `flow` and `reason` scalars,
  published to the document as `--heat`, `--alert` and `--flow`. CSS
  chrome and canvas painters share one palette shift.
- **anchors.** Named DOM rects (`queue`, `hero`, `kv`, `gpu`, engine
  rail) let full-bleed Loom-9 cables route across panel boundaries.

Full-bleed layers (declination backdrop, loom-9 cables, scope-omega
scatter) and the pinned safehouse corner scope live in
`src/components/LayerStack.jsx`. The `Scope` primitive
(`src/scene/Scope.jsx`) is the hairline, bracket and caption region that
replaces every old card. Skin authors supply tokens only:
`src/index.css` custom properties + the palette mirror in
`src/lib/skins.js` (canvas painters read `conductor.palette`).

## Run

```sh
npm install          # one-time
npm run dev          # http://localhost:5173, /api proxied to 127.0.0.1:8792
npm run build        # dist/ (gitignored, served by the collector)
npm run preview      # serves dist/ at http://localhost:4173 (no API)
```

The dev loop wants a local collector running: `python3 collector/aether.py`
from the repo root. `npm run build` then restart the collector to pick up
console changes.

## Layout

- `src/App.jsx` shell: header, strips, the three-column stage, layers
- `src/scene/` SceneRoot (conductor + feed), Scope, SceneCanvas, painters,
  anchor hook
- `src/lib/` simulator (demo, scenario loop), adapt (live wire format ->
  state), feed (snapshot/SSE/poll lifecycle), formatting, skin tokens
- `src/components/` header, status pills, timecode + KPI + data strips,
  terrain / hero / GPU / KV / log scopes, layer stack, atmosphere, foot

## Skins

All seven skins re-theme the console through CSS custom properties mapped
into Tailwind, mirrored as RGB channels for the canvas painters
(`src/lib/skins.js`). Severity colours stay absolute. The alarm red
(`--alm`) never follows the skin accent. The choice persists to
`localStorage`.
