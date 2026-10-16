# ASTERRO Phase III — Planetary Research Observatory

Phase III adds a **Planetary Target Atlas**: 33 target windows on Mars and the Moon. Each target
has a verified location and a fingerprint, and every value in that fingerprint carries a status and a
provenance. The atlas also includes a shared evidence and experiment infrastructure, and **14 new
views** that run through the atlas.

Phase III is additive. It does not change any of the following:

- the baseline engine, scores, weights, ranges or ranking;
- the two baseline targets;
- the 76,781-cell predictor stack;
- Trace, Reproduce and Report;
- the profiles;
- offline operation.

`CHANGES.md` and `TEST_REPORT.md` give the evidence for this.

> ASTERRO is a research and education tool. It is not NASA-approved, it is not scientifically
> validated against field data, and it does not certify landing sites or field locations.

## Where to find it

In the app, open the **Atlas** tab. It is added at runtime to the right of **Lab**. Its views are:

| View | What it answers |
|---|---|
| Atlas | Catalogue for Mars and the Moon: map, search, filters, cards, readiness, multi-select. |
| Target | Fingerprint and status of every criterion, gazetteer anchor, terrain, slope and ΔT previews from the real grids, heterogeneity, thermal evidence, reproducibility check, missing evidence. |
| Compare | For the selected targets: candidates per target, which rankings are stable, which dimensions distinguish the targets, shared and complementary candidates, missing evidence, and discriminating measurements. |
| Workflow | Target → Candidate → Evidence → Robustness → Requirements → Measurements → Plan → Record. It stops at analytical boundaries. |
| Extremes | Global Environmental Extremes Explorer: single-criterion extremes, robust multivariate outliers, tercile regimes, and target-specific discovery. |
| Terrain | Landing-Site Intelligence Explorer. It is labelled *"Exploratory terrain and environmental assessment."* and computes no safety score. |
| Counterfactual | One analytical choice changed at a time: normalisation table, profile, proxies, or one criterion removed. |
| Mismatch | Mismatch Cartographer: a similarity map for each criterion, where missing Earth data are hatched rather than coloured. |
| Translator | Earth-to-World Analogue Translator. It gives correspondences criterion by criterion, plus the properties that no criterion represents. |
| Expedition | Analogue Expedition Designer: field objectives and measurements. It contains no travel, cost, access or safety content. |
| Constellation | Knowledge Constellation: typed nodes and documented edges only, in a deterministic layout. |
| Copilot | Research Copilot Workspace. The deterministic core works without a language model; an optional Claude mode must cite evidence. |
| Records | `asterro.experiment/2` records with browser replay; Phase II v1 records are shown through an adapter. |
| Provenance | Datasets, the compatibility registry, statuses, normalisation tables and file checksums. |

## Run

```bash
npm test                         # Python (65) + JS parity + Phase II engine (65) + Phase III engine (126)
npm start                        # serves public/ on :8080 → open /index.html → Atlas
python3 tests/phase3/ui_atlas_smoke.py /tmp/shots     # browser walk-through (Playwright)
```

## Reproduce the atlas from source data

The network job needs the USGS, PDS and UCLA hosts. Its Python dependencies are rasterio, netCDF4,
pyshp, numpy and requests.

```bash
cd src/phase3/pipeline && cp ../target_catalog.py ../../data/ingestion/terrain.py ../../data/ingestion/mars_meda.py .
# certificate bundles bundle.pem / pdsb.pem: system CAs + the hosts' intermediates (see METHODS.md §TLS)
python3 build_atlas.py resolve  OUT     # gazetteer lookup, anchors, ring windows
python3 build_atlas.py terrain  OUT     # 33 primary + 64 ring windows (unchanged planet_window)
python3 build_atlas.py polar    OUT     # Diviner polar hourly maps (5 polar lunar targets)
python3 build_atlas.py gcp      OUT     # Diviner GCP range reads (10 non-polar lunar targets)
python3 build_atlas.py basemap  OUT     # MOLA / LOLA decimated relief (context only)
python3 rems_gale.py OUT                # MSL REMS, 306 sols, Mars24 Ls (resumable)
python3 gmted_subcell.py OUT            # Earth sub-cell slope histograms (GMTED 30″)
```

Copy `OUT/` to `data/raw/phase3/`, then run `npm run build:phase3`. This writes `public/data/phase3/`
and rebuilds `public/index.html`.

Replay a record in Python:

```bash
python3 scripts/replay_atlas_record.py record.json
```

The exit status is 0 if reproduced, 1 if not reproduced, and 2 if the record cannot be replayed.
