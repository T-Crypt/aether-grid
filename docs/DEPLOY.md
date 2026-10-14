# Deploy

Two images, one host port. `docker/compose.yml` runs a GPU-aware
collector plus an nginx static UI; `http://<host>:8792` serves both
(nginx proxies `/api/*` to the collector).

## Prerequisites

- Docker Engine + Compose v2 plugin.
- For GPU telemetry: NVIDIA driver + [NVIDIA Container Toolkit][toolkit]
  on the host. Without them the `collector` service still starts and
  serves — `gpu.present` is `null` and the GPU panels stay empty.
- Optional config: copy the example next to the compose context root
  (repo root) and edit it:

```sh
cp aether.example.toml speculum.toml
$EDITOR speculum.toml
```

Without `speculum.toml` the collector probes localhost defaults
(llama-swap `:9090`, Strata `:8080`, discovery on) and still serves.

[toolkit]: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html

## Run

From the repo root (`compose.yml` uses `context: ..`, so run it via the
file path or from `docker/`):

```sh
docker compose -f docker/compose.yml up -d --build
docker compose -f docker/compose.yml logs -f
```

Open `http://<host>:8792`. Direct collector API (container network
only by default):

```sh
docker compose -f docker/compose.yml exec collector \
  python3 -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8792/api/snapshot').status)"
```

LAN-direct collector access: add `ports: ["8793:8792"]` to the
`collector` service (8792 is taken by `web`).

## What lives where

| Concern | How |
|---|---|
| Collector port (internal) | 8792 (`collector:8792` in compose DNS) |
| Public port | host **8792** → `web:80` (UI + `/api/*` proxy) |
| History DB | named volume `aether-speculum-data` at `/data`; SQLite file `/data/speculum/speculum.db` (`XDG_DATA_HOME=/data`) |
| Config | `../speculum.toml` → `/app/speculum.toml` (read-only) |
| GPU | `deploy.resources.reservations.devices` (`driver: nvidia`, `capabilities: [gpu, utility]`); image has no CUDA, uses host `nvidia-smi` |
| Footprint | collector is stdlib-only on `python:3.12-slim`, target < 40 MB RSS |

## Data management

- History retention comes from the config file (`[history]
  retention_days = 30`, or `0` to disable). The rolling 60-minute
  ring buffers live in memory regardless.
- Back up the DB: `docker run --rm -v aether-speculum-data:/data
  -v "$PWD":/bak alpine cp /data/speculum/speculum.db /bak/`.
- Reset history: `docker compose -f docker/compose.yml down` then
  `docker volume rm aether-speculum-data`.
- Prune on demand: `POST /api/prune` (via `http://<host>:8792/api/prune`).

## Bare-metal alternative

```sh
python3 collector/aether.py [--port 8792] [--config speculum.toml]
# serves web/ at / plus /api/snapshot and /api/stream
# (speculum feed merged with router + reasoning keys).
# Bare feed instead: python3 collector/speculum.py [same flags]
# (serves the repo root; UI then lives at /web/index.html).
```

`web/` ships `index.html` + `app.js` + `layers.js` + `field.js` +
`tokens.css` (no build). `index.html` loads `app.js` as a module,
which imports `field.js` (terrain/helix painters) and `layers.js`
(backdrop/scatter/cables/scope painters).

## Demo mode (no backends needed)

Open `http://<host>:8792/?demo` (or `?demo` on a bare-metal run)
for the seeded in-browser simulator: same paint path, fake engine +
KPI/host histories, no collector traffic.
