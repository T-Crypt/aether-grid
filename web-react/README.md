# Aether Grid React console

A React rebuild of the field monitor in `web/`. It ships beside the static
UI, which still has no build step and is what Docker serves. Nothing here
is wired to the collector yet. All data comes from a seeded simulator at
1 Hz with the same snapshot shape as `web/app.js` applies from the SSE
feed, so the panels can be built and judged before any plumbing exists.

## Stack

Vite 5, React 18, Tailwind CSS 3.4 with PostCSS and Autoprefixer,
framer-motion for motion, lucide-react for icons, and
`@fontsource-variable/jetbrains-mono` self-hosted. Plain `.jsx`, because
the repo has no TypeScript.

## Run

```sh
cd web-react
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ (gitignored, drop behind nginx at any path)
npm run preview    # serves dist/ at http://localhost:4173
```

## Layout

- `src/App.jsx` one shell, seven skins, four layer toggles
- `src/lib/` simulator, formatting, skin tokens, canvas painters
- `src/hooks/` telemetry stream, canvas animation loops
- `src/components/` header, status, metrics, the three named canvases,
  cohort, log, field layers

## Skins and motion

All seven skins from `web/` re-theme the console through CSS custom
properties mapped into `tailwind.config.js`, so no component hardcodes a
color. `prefers-reduced-motion` starts the feed paused and stops
framer-motion, leaving a static final frame instead of unwanted motion.

## Switching the served UI

`docker/Dockerfile.web` still copies only `web/`. Serving this console
instead means building `web-react` and copying `dist/` into that image,
which is a deliberate follow-up, not something this directory does.
