# Aether Grid React console

The console is the app. The collector (`collector/aether.py`) serves this
build from `web-react/dist/` together with the API on one port, so one
process on `:8792` is UI + data. Without `?demo` it runs on the live feed
(`/api/snapshot` + `/api/stream` SSE, poll fallback); `?demo` runs the
seeded in-browser simulator with no collector.

## Stack

Vite 5, React 18, Tailwind CSS 3.4 with PostCSS and Autoprefixer,
framer-motion for motion, lucide-react for icons, and
`@fontsource-variable/jetbrains-mono` self-hosted. Plain `.jsx`, because
the repo has no TypeScript.

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

- `src/App.jsx` one shell, seven skins, four layer toggles
- `src/lib/` simulator (demo), adapt (live wire format -> state), feed
  (snapshot/SSE/poll lifecycle), formatting, skin tokens, canvas painters
- `src/hooks/` telemetry stream (demo or live by URL), canvas animation loops
- `src/components/` header, status, metrics, the three named canvases,
  gauges, cohort, log, field layers, data band

## Skins and motion

All seven skins re-theme the console through CSS custom properties mapped
into `tailwind.config.js`, so no component hardcodes a color.
`prefers-reduced-motion` starts the demo feed paused and stops
framer-motion, leaving a static final frame instead of unwanted motion.
