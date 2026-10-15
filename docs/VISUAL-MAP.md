# Visual map

Base visual is **HEX-LAB** (the React console in `web-react/`, Vite
build): status pills, key-metric KPIs, brainwave terrain canvas, helix
reasoning canvas, GPU gauges, cohort KV-slot grid, events/requests
logs. Every panel reads one console state object, assembled in
`web-react/src/lib/` — `simulator.js` for `?demo`, `adapt.js` from the
collector's `snapshot()`/`tick()` for live — so live and demo share one
paint path. Layers sit on top of that base; each layer is fed by one or
more Speculum panels from `/api/snapshot` (1 Hz `/api/stream` ticks
carry the same fields incrementally).

| Panel (`web-react/src/components/`) | Snapshot panel | Fields used |
|---|---|---|
| Status pills (`Header.jsx`) | `mode`, `engines{up,latched}`, `kpi`, `strata.up`, `gpu`, `alerts` | mode/link state; per-engine up; `tps queue vram`; GPU temp; Strata reachability; alert count |
| Timecode strip (`TimecodeStrip.jsx`) | `kpi`, `gpu`, `reasoning`, `engines`, `feed` | `tps queue vram`, temp, mtp accept, engine count, feed name |
| Key metrics (`Metrics.jsx`) | `kpi.last` + `kpi.hist` | `tps rpm p95 ttft tpot vram cache reingest mtp queue` (60-min histories for sparklines and trends) |
| Brainwave terrain (`TerrainPanel.jsx`, `paintTerrain` in `src/lib/paint.js`) | `kpi.hist.tps` | the throughput series as a receding wireframe mesh (60-min @ 1 s ring) |
| Helix reasoning (`HelixPanel.jsx`, `paintHelix`) | `kpi.tps` + `kpi.hist.tps`, `reasoning` | strand energy from live load over the 60 s peak; MTP accept % and thinking tokens in the meta row |
| GPU gauges (`GaugePanel.jsx`) | `gpu` | `utilization temp vram power` as radial gauges, GPU name in the header |
| Cohort grid · KV slots (`CohortPanel.jsx`) | `sessions` (derived from `engines.sessions`, `strata.slots`) | per-session `window used cached`; fill drives cell tint and bar |
| Events / Requests (`LogPanel.jsx`) | `events` (last 100, newest first), `requests` (last 200, newest first) | level + message log; per-request records (deduped by id across llama-swap activity + NInfer log) |
| Data band (`DataBand.jsx`) | `kpi`, `host`, `reasoning` | every KPI plus host `uptime cpu ram` and reasoning tick |
| Footer (`Foot.jsx`) | `feed`, `engines` | feed name, engine up count |

Long-range panels (`/api/history`, `/api/spans`, `/api/leaderboard`,
`/api/storage`, `/api/export`) all read the SQLite history DB — see
`docs/DEPLOY.md` for where that file lives.

## Skins

The chrome is AETHER GRID (sigil logo, frosted header). All seven skins
ship: HEX-LAB (the base, cyan) plus AETHER, THE BRAID, ISODOSE,
CORVANE, SOUNDING and GULLET. The skin rail in the header flips the CSS
custom properties in `src/index.css` (mapped into Tailwind by
`tailwind.config.js`) and the canvas palette in `src/lib/skins.js`
(severity hues stay absolute); the choice persists to
`localStorage`. `src/index.css` and `skins.js` carry the same token
values in two forms — CSS for the DOM, RGB channels for the painters —
so change one, change the other.

## Layers

The four overlays render as live miniatures behind real switches in
`FieldLayersPanel.jsx` (one `<canvas>` per layer, a `role=switch`
per toggle). Turning one off dims its miniature and stops its clock.

### DECLINATION — field backdrop

The ambient wash behind the panels, driven by the host/GPU baseline.
In the console it is fed by the throughput series —
`kpi.hist.tps` — and rendered by `paintBackdrop` as a layered
background wash on the `DECLINATION · BACKDROP` canvas.

### SCOPE-OMEGA — anomaly scatter

An overlay scatter of outliers on top of the terrain: queue spikes,
VRAM pressure, p95/TTFT excursions. The console plots deterministic
points sampled from `kpi.hist` (`queue`, `vram`, `p95`), with queue
excursions flagged critical. `paintScatter` renders them on the
`SCOPE-OMEGA · SCATTER` canvas.

### LOOM-9 — router cables

Cables from request sources to engines: which model traffic flows
where. The console draws one cable per loaded model (`models`, top
five), thickness from live throughput (`kpi.tps` against its 60 s
peak). `paintCables` renders them on the `LOOM-9 · CABLES` canvas.

### SAFEHOUSE — reasoning scope

A scoped, dimmed read of reasoning load: a radar sweep whose fill
tracks live load. It deliberately draws no session content, so
chain-of-thought style content never leaks into the shared field.
`paintScope` renders it on the `SAFEHOUSE · SCOPE` canvas.

## Quick reference

```text
hex-lab base        status pills · timecode · kpis · terrain · helix · gauges · cohort · events/requests · data band
declination    →    kpi.hist.tps as an ambient backdrop wash
scope-omega    →    kpi.queue/vram/p95 excursions as scatter
loom-9         →    models as cables, thickness from kpi.tps
safehouse      →    live load as a scoped radar read
```
