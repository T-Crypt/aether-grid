# Visual map

Base visual is **HEX-LAB** (`web/index.html` + `web/tokens.css`, no
build): status pills, key-metric KPIs, brainwave terrain canvas,
helix reasoning canvas, cohort KV-slot grid, events/requests logs.
Layers sit on top of that base; each layer is fed by one or more
Speculum panels from `/api/snapshot` (1 Hz `/api/stream` ticks carry
the same fields incrementally).

## HEX-LAB base → snapshot panels

| Base element (`web/index.html` id) | Snapshot panel | Fields used |
|---|---|---|
| Status pills (`#pills`) | `alerts`, `engines{up,latched}`, `strata.up`, `gpu.present` | active alert strings; per-engine up/latch; Strata reachability; GPU presence |
| Key metrics (`#kpis`) | `kpi.last` + `kpi.hist` | `tps rpm p95 ttft tpot vram cache queue reingest mtp` (60-min histories for sparklines) |
| Brainwave terrain (`#terrain`) | `gpu.hist`, `host.hist` | `util temp power vram_gb` + `cpu ram_gb` time series (60 min @ 1 s ring buffers) |
| Helix reasoning (`#helix`) | `engines{rates,hist,window}`, `strata.slots` | per-engine throughput series + slot/session windows |
| Cohort grid · KV slots (`#cohort`) | `strata.slots`, `engines.sessions`, `models`, `running` | slot states, sessions, loaded-model roster |
| Events (`#events`) | `events` (last 100, newest first) | level + message log, incl. discovery/model-load lines |
| Requests (`#requests`) | `requests` (last 200, newest first) | per-request records (deduped by id across llama-swap activity + NInfer log) |
| Footer (`#foot`) | `collector`, `gen` | uptime, port, buffered-request count, tick generation |

Long-range panels (`/api/history`, `/api/spans`, `/api/leaderboard`,
`/api/storage`, `/api/export`) all read the SQLite history DB — see
`docs/DEPLOY.md` for where that file lives.

## Layers

### DECLINATION — field backdrop

The ambient backdrop behind every panel: a slow drift field driven by
host/GPU baselines. Maps to the **Brainwave terrain** panel's inputs —
`gpu.hist` (`util`, `temp`, `power`) and `host.hist` (`cpu`, `ram_gb`)
— rendered as background wash on the dedicated `#backdrop` canvas
(toggle `#tgl-declination`) rather than the terrain's own traces.
When `gpu.present` is null (no NVIDIA box), declination falls back to
`host.hist` alone. No new endpoint: same `gpu`/`host` snapshot panels.

### SCOPE-OMEGA — anomaly scatter

An overlay scatter of outliers on top of terrain/helix: queue spikes,
VRAM pressure, temperature excursions, stalled engines. Sources:

- `kpi.last`/`kpi.hist`: `queue`, `vram`, `p95`, `ttft` excursions.
- `alerts`: fired threshold alerts (`vram_pct`, `gpu_temp_c`, `queue`,
  `foreign_vram_mib` from the `[alerts]` config table) become scatter markers.
- `engines{idle_vram, service_unavailable, reason}`: idle-but-holding-VRAM
  engines and erroring engines plot as flagged points.
- `events` (level `warn`/`err`/`alert`): timestamped annotations on the scatter.

Renders on the dedicated `#scatter` canvas (toggle `#tgl-scope`);
consumes KPI + alerts + events panels.

### LOOM-9 — router cables

Cables from request sources to engines: which model traffic flows where.
Drawn over the **Cohort grid** panel. Sources:

- `running` (llama-swap `/running` entries) + `_swap_models` pairs: live
  model→engine claims.
- `engines{backend, rates, mtp, counters}`: per-engine throughput per cable.
- `requests`: newest-first records show per-cable recent traffic.
- `models`: full model roster for cable endpoints.

Each cable is one running entry; thickness from `rates`, label from
model name. Renders on the dedicated `#cables` canvas (toggle `#tgl-loom`).

### SAFEHOUSE — reasoning scope

A scoped, dimmed view of reasoning internals: engine sessions and slot
states rendered as an isolated "room" so chain-of-thought style content
never leaks into the shared field. Maps to the **Helix reasoning** panel:

- `engines{sessions, window, slots}`: per-session reasoning windows.
- `strata.slots`: cohort slot states (shared with the cohort grid).
- `strata.models`: which models back the scoped sessions.

Safehouse reads the same `engines`/`strata` panels as helix/cohort but
renders them behind a scope boundary on the dedicated `#scope` canvas
(toggle `#tgl-safehouse`, muted palette from `tokens.css`).

## Quick reference

```text
hex-lab base        status pills · kpis · terrain · helix · cohort · events/requests
declination    →    terrain inputs (gpu.hist + host.hist) as backdrop wash
scope-omega    →    kpi excursions + alerts + warn/err events as scatter
loom-9         →    running + engines.rates + requests as cables on cohort
safehouse      →    engines.sessions + strata.slots as scoped helix view
```
