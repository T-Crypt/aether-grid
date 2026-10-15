# Visual map

Base visual is **HEX-LAB** (the React console in `web-react/`, Vite
build): the scene is one continuous surface with hairline scopes, corner
ticks and caption labels over a full-bleed Declination backdrop. Status
pills, KPI strips, the hero helix, terrain, GPU block, KV cohort, log,
data band. Every element reads one console state object assembled in
`web-react/src/lib/`. `simulator.js` feeds `?demo` with a seeded loop
through idle, burst, pressure, overflow and recover. `adapt.js` maps the
collector `snapshot()` and `tick()` documents for live. Live and demo
share one paint path.

Motion is conducted from one master clock: `SceneRoot` (`src/scene/`) is
the only feed consumer and the only timer owner; the canvas painters
read the conductor's clock, snapshot, event traces and smoothed scene
scalars (`heat` / `alert` / `flow` / `reason`). See README “Scene
architecture” for the full model.

| Region (`web-react/src/components/`) | Snapshot source | Fields used |
|---|---|---|
| Status pills (`Header.jsx`) | `mode`, `engines{up}`, `kpi`, `strata.up`, `gpu`, `alerts`, `phase` | mode/link state; per-engine up; `tps queue vram`; GPU temp; Strata reachability; alert count; demo phase chip |
| Timecode strip (`TimecodeStrip.jsx`) | `kpi`, `gpu`, `reasoning`, `engines`, `feed` | `tps queue vram`, temp, mtp accept, engine count, feed name |
| KPI strip (`KpiStrip.jsx`) | `kpi.last` + `kpi.hist` | `tps p95 queue vram` as steered cells (sparkline / ring) + `rpm ttft tpot cache reingest mtp` micro row; the queue cell is a Loom-9 cable anchor |
| Hero helix (`HelixHero.jsx`, `paintHero`) | `kpi.tps` + `kpi.hist.tps`, `reasoning` | the dominant stage: coil phase is the token clock (turns with decode rate), token packet trains, request kicks, anomaly glitch; MTP accept %, thinking tokens, phase in the meta row |
| Brainwave terrain (`TerrainScope.jsx`, `paintTerrain`) | `kpi.hist.tps` | the throughput series as a receding wireframe mesh |
| GPU block (`GpuScope.jsx`) | `gpu` | `utilization temp vram power` as radial gauges (CSS-eased between ticks), GPU name in the header; temp alerts use the absolute alarm red |
| KV cohort (`CohortGrid.jsx`, `paintKvFlashes`) | `sessions` (derived from `engines.sessions`, `strata.slots`) | per-session `window used cached`; fill drives cell tint and bar; a `kv_slot_changed` event flashes the slot on an overlay canvas |
| Log (`LogScope.jsx`) | `events` (last 100), `requests` (last 200) | level + message log; per-request records (deduped by id); new rows arrive at feed rate |
| Data band (`DataBand.jsx`) | `kpi`, `host`, `reasoning` | every KPI plus host `uptime cpu ram` and reasoning tick |
| Footer (`Foot.jsx`) | `feed`, `engines` | feed name, engine up count |

Long-range panels (`/api/history`, `/api/spans`, `/api/leaderboard`,
`/api/storage`, `/api/export`) all read the SQLite history DB. See
`docs/DEPLOY.md` for where that file lives.

## Skins

The chrome is AETHER GRID (sigil logo, hairline header). All seven skins
ship: HEX-LAB (the base, cyan) plus AETHER, THE BRAID, ISODOSE,
CORVANE, SOUNDING and GULLET. The skin rail in the header flips the CSS
custom properties in `src/index.css` (mapped into Tailwind by
`tailwind.config.js`) and the canvas palette in `src/lib/skins.js`
(severity hues stay absolute, including the alarm red `--alm`); the choice
persists to `localStorage`. `src/index.css` and `skins.js` carry the same
token values in two forms, CSS for the DOM and RGB channels for the
painters. Change one, change the other.

## Layers

The four overlays are full-bleed scene layers, not boxed miniatures:
each is a canvas registered on the shared clock (`src/scene/paint.js`),
switched from the `field layers` cluster pinned bottom-left. Turning one
off hides its canvas and stops its paint.

### DECLINATION (field backdrop)

A full-screen canvas behind everything. Ambient wash bands ride the
throughput series (`kpi.hist.tps`); the wash warms toward the data token
as `heat` climbs (VRAM/temp/power) and takes the alarm tint under
`alert`, so the backdrop is the palette shift the rest of the scene rides
on. It is a soft wash, so the canvas renders at half resolution.

### LOOM-9 (router cables)

Full-screen cables that cross panel boundaries: from the engine rail and
the queue cell (named anchors, measured live) through the hero stage to
the KV grid and the GPU block. Packet speed and density track the decode
rate; a `request_arrived` event fires a bright packet from the queue;
cables warm/turn red with scene state.

### SCOPE-OMEGA (anomaly scatter)

A full-frame scatter of threshold excursions (deterministic points
sampled from `kpi.hist` `queue` / `vram` / `p95`, anchored near their
source region, queue excursions flagged critical). Live `anomaly` events
add expanding ping rings. Err pings are red and warn pings are amber.

### SAFEHOUSE (reasoning scope)

A pinned corner scope, always on (unless toggled off). A radar read of
load: sweep angle is the master clock, blips are deterministic per KV
slot (red above the alert line), pressure rings warm with `heat`,
anomaly pings echo as expanding rings on the radar. It deliberately draws
no session content, so chain-of-thought style content never leaks into
the shared field.

## Quick reference

```text
hex-lab base        pills · timecode · kpi strip · hero helix · terrain · gpu block · kv cohort · log · data band · foot
declination    →    kpi.hist.tps as a state-reactive full-screen backdrop (half-res)
loom-9         →    anchors (queue/hero/kv/gpu/rail) as cables, packets from kpi.tps
scope-omega    →    kpi.queue/vram/p95 excursions + anomaly ping rings, full frame
safehouse      →    pinned corner radar: clock sweep, per-slot blips, pressure rings, anomaly pings
canonical events →  request_arrived, token_generated, kv_slot_changed, vram_pressure, anomaly
scenario loop    →  ?demo: idle → burst → pressure → overflow → recover, 60 s lap
```
