# AETHER-GRID

Futuristic toy LLM brain-scan dashboard. Live metrics always on. UISpace visuals on top.

Base is `speculum/collector` stdlib feed. Visual base is HEX-LAB. Layers are DECLINATION field backdrop, LOOM-9 router cables, SCOPE-OMEGA anomaly scatter, SAFEHOUSE reasoning scope.

## Layout

- `collector/` vendored speculum feed plus router and reasoning adapters
- `web/` static UI with no build
- `docker/` slim images plus compose
- `.router/` run folders for staged work
- `docs/` deploy notes and visual map

## Run

```sh
python3 collector/aether.py [--port 8792] [--config speculum.toml]
# serves web/ at / plus /api/snapshot and /api/stream, then open:
# http://localhost:8792
```

No backends needed for a first look — open `http://localhost:8792/?demo`
for the seeded in-browser simulator (same UI, fake data, no polling).

## Docker

```sh
docker compose -f docker/compose.yml up -d --build
# open http://<host>:8792 (one host port: nginx serves web/ +
# proxies /api/* to the collector; history DB survives in a named volume)
```

See `docs/DEPLOY.md` for config (`speculum.toml`), GPU passthrough,
and data management. Visual-to-endpoint mapping is in `docs/VISUAL-MAP.md`.

## Repo

https://github.com/T-Crypt/aether-grid

## Sources

All optional. Each degrades to no data. GPU via one `nvidia-smi -lms 1000` reader. Host via `/proc` or Win32. llama-swap `:9090`. NInfer backend via `/running` proxy. Strata `:8080`.
