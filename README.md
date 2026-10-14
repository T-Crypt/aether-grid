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

`python3 collector/aether.py` serves `web/` plus `/api/snapshot` and `/api/stream`.

## Sources

All optional. Each degrades to no data. GPU via one `nvidia-smi -lms 1000` reader. Host via `/proc` or Win32. llama-swap `:9090`. NInfer backend via `/running` proxy. Strata `:8080`.
