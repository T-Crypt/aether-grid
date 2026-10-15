# Aether Grid

Aether Grid watches local inference engines and shows their numbers live, with history. It covers GPU, host, llama-swap, NInfer, and Strata on one screen. Every source is optional. A missing source leaves its panels empty.

The feed is the speculum collector in `collector/` and uses only the standard library. The UI is the React console in `web-react/`. The collector serves the console build and the API together, so one process on one port is the whole app. The default skin is Hex-Lab. Aether and five more stay selectable as skins. Four layers sit on top of the base panels. They are Declination field backdrop, Loom-9 router cables, Scope-Omega anomaly scatter, and Safehouse reasoning scope.

## Layout

- `collector/` speculum feed plus router and reasoning adapters
- `web-react/` the React console (Vite build in `web-react/dist/`)
- `.router/` run folders for staged work
- `docs/` deploy notes and visual map

## Run

Build the console once, then start the collector:

```sh
npm --prefix web-react install
npm --prefix web-react run build
python3 collector/aether.py [--port 8792] [--config speculum.toml]
# serves the console and /api/snapshot + /api/stream on one port:
# http://localhost:8792
```

The collector exits with a build instruction if `web-react/dist` is missing. No backends are needed for a first look. Open `http://localhost:8792/?demo` for the seeded in-browser simulator (same UI, fake data, no collector traffic).

For LAN access bind all interfaces: `python3 collector/aether.py --host 0.0.0.0 --port 8792`.

## Dev

In `web-react/`:

```sh
npm run dev
```

The Vite dev server proxies `/api` to a local collector on `127.0.0.1:8792`, so start the collector first. Point the browser at the Vite URL for the dev build, or at the collector URL for the built one.

See `docs/DEPLOY.md` for config (`speculum.toml`), the history database, and LAN exposure. Visual-to-endpoint mapping is in `docs/VISUAL-MAP.md`.

## Repo

https://github.com/T-Crypt/aether-grid

## Sources

All optional. Each degrades to no data. GPU via one `nvidia-smi -lms 1000` reader. Host via `/proc` or Win32. llama-swap `:9090`. NInfer backend via `/running` proxy. Strata `:8080`.
