# Deploy

One process, one port. `python3 collector/aether.py` starts the
collector and serves the React console build (`web-react/dist/`) plus
`/api/snapshot` and `/api/stream` on `http://<host>:8792`. There is no
separate web server and no container.

## Build

The console is a Vite build. Build it once, and rebuild after pulling
console changes:

```sh
npm --prefix web-react install     # one-time
npm --prefix web-react run build
```

The collector refuses to start without `web-react/dist/` and prints
the build instruction.

## Run

```sh
python3 collector/aether.py [--port 8792] [--config speculum.toml]
```

Open `http://localhost:8792`. For LAN access, bind all interfaces:

```sh
python3 collector/aether.py --host 0.0.0.0 --port 8792
```

## Config

Optional. Copy the example to the repo root (or
`~/.config/speculum/speculum.toml`) and edit:

```sh
cp aether.example.toml speculum.toml
$EDITOR speculum.toml
```

Without `speculum.toml` the collector probes localhost defaults
(llama-swap `:9090`, Strata `:8080`, discovery on) and still serves.
The `[server]`, `[discovery]`, `[llama_swap]`, `[strata]`,
`[[engine]]` and `[alerts]` tables and the history retention setting
are documented in `aether.example.toml`.

## History

- The history database is a SQLite file at
  `~/.local/share/speculum/speculum.db` on Linux (honours
  `XDG_DATA_HOME`) and `%LOCALAPPDATA%\Speculum\speculum.db` on
  Windows.
- Retention comes from the config file (`[history]
  retention_days = 30`, or `0` to disable). The rolling 60-minute
  ring buffers live in memory regardless.
- Back up the DB by copying that file.
- Reset history by stopping the collector and deleting it.
- Prune on demand: `POST /api/prune` (via
  `http://<host>:8792/api/prune`). The long-range APIs
  (`/api/history`, `/api/spans`, `/api/leaderboard`,
  `/api/storage`, `/api/export`) read it.

## Sources

All optional; each degrades to empty panels.

- GPU: one long-lived `nvidia-smi -lms 1000` reader. Without a GPU or
  `nvidia-smi`, `gpu.present` is null and the GPU panels stay empty.
- Host: `/proc` on Linux, Win32 via ctypes on Windows (CPU total and
  per-core, memory, load, uptime, plus RSS of the inference processes).
- llama-swap: `http://127.0.0.1:9090` (`/running`, `/v1/models`,
  `/api/metrics/activity`, `/api/events`, log stream).
- NInfer: the backend llama-swap reports in `/running` (`/metrics`,
  `/slots`, upstream log stream).
- Strata: `http://127.0.0.1:8080` (`/v1/models`, `/metrics`,
  `/slots`), when up.

The collector itself is stdlib-only, target footprint under 40 MB RSS.

## Demo mode (no backends needed)

Open `http://<host>:8792/?demo` for the seeded in-browser simulator:
same UI, fake engine + KPI/host histories, no collector traffic.
