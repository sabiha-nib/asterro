# ASTERRO V19: regression baseline (V18 release)

Recorded before any V19 change by `python3 scripts/v19_baseline.py cab7a0c <npm test log>`, which writes
`data/v19/baseline.json` and compares the V18 commit with the working tree. Run it again after V19 work: it must keep
reporting `differences: none` for every preserved item.

| Item | Baseline |
|---|---|
| Commit | `cab7a0c` (V18 Local Impact), local; remote `main` is still `60e0c16` because the push is refused (403, repository not authorised for this session) |
| Deployment | claude.ai artifact, version 18 |
| Engine | `tai-sim-1.0.0`; six dimensions (aridity, annual temperature range, elevation, slope, surface roughness, thermal); thresholds match 0.85, partial 0.60, minimum coverage 0.80; 300 km separation; 800 candidates |
| Profiles | six stored profiles (general, rover, eva, thermal, habitat, instrument) plus the Custom weighting in the interface, seven choices in all |
| Protected files | 79, all byte-identical to `tests/phase3/fixtures/protected_sha256.json` |
| Reference results | SHA-256 of the seven parity and reproduction fixtures |
| Predictor stack | SHA-256 of `public/data/stack.bin` |
| V17 products | SHA-256 of cube, patterns, registry, modules, limits |
| V17 registry | 55 sources: 12 integrated and validated, 4 integrated with validation incomplete, 38 endpoint unavailable, 1 not investigated |
| V18 Local Impact | `tai-v18-local-1.0.0`, radii 50/100/250/500 km, cap 500 km, engine SHA-256 recorded |
| Rendered tabs | explore, discover, atlas, local, compare, scenarios, trajectory, method, data, lab; plus `#terms`, `#privacy` |
| Non-browser tests | `npm test` exit 0: Python 139/139; Phase III 132; Phase IV 74, 26, 37, 53; i18n 52 and 63; extension 39 and 36; V17 35 and 24; V18 23 and 24 |
| Browser tests | 19 suites, all passing at V18 (`docs/v18/TEST_REPORT.md`) |

## Network access at the start of V19

From the cloud build environment, on 2026-11-10, one probe each of 30 official primary and alternative routes failed:

- Every provider, cloud bucket and STAC catalogue failed with `CONNECT tunnel failed, response 403`, a policy refusal by the egress proxy. This includes NASA POWER, CMR, GIBS, Earthdata Login, LP DAAC (classic and cloud), LAADS, NSIDC, the PDS nodes, ODE, USGS Astrogeology and mrdata, Macrostrat, GBIF, SoilGrids, the AWS Copernicus DEM and WorldCover buckets, the JRC Global Surface Water bucket, Planetary Computer, Earth Search and CMR-STAC.
- PyPI does not resolve.
- github.com answered with 400, the git proxy.

A refusal by this environment's proxy says nothing about the providers themselves. The user was asked to allow a short list of public domains for the session.
