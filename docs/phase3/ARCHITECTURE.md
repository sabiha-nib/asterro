# Phase III — Architecture

```
            network job (USGS / PDS / UCLA)                         offline build                       browser
 target_catalog.py ──► build_atlas.py resolve/terrain/polar/gcp ─┐
 terrain.py, mars_meda.py (baseline, unchanged) ──► rems_gale.py ─┼─► data/raw/phase3 ─► build_phase3_data.py ─► public/data/phase3 ─► atlas_engine.js ─► 14 views
 gmted_subcell.py ───────────────────────────────────────────────┘     (checksummed)      (compute_ranges,       atlas.json             (AsterroLab +      (ui_*.js)
                                                                                           similarity, unchanged)  grids, subcell, PNG    contract v2)
```

## Layers

1. **Target universe.** `target_catalog.py` holds locations and anchors only; `atlas.json` holds the
   fingerprints, statuses, readiness and provenance.
2. **Shared evidence infrastructure**
   - status vocabulary;
   - variable-compatibility registry;
   - dataset provenance records (dataset, product, provider, URL / DOI, version / ETag, retrieval
     time, period, CRS, resolution, units, processing, quality flags, checksum, licence statement,
     limitations);
   - evidence claims (the Phase II `AsterroLab.claim` protocol), built for every value.
3. **Shared analytical engine** (`atlas_engine.js`, pure, Node-testable)
   - target vectors and eligibility;
   - normalisation alternatives;
   - scoring through `AsterroLab.prepare` / `fieldScore` (the baseline formula);
   - candidates, explanation, stability (`AsterroLab.runDesign` / `rankStats`);
   - distinguishing dimensions, shared and complementary candidates;
   - missing evidence and measurement impact;
   - extremes, window classes;
   - contract v2 with the v1 adapter;
   - workflow state;
   - the deterministic copilot.
4. **Shared research context** (`A3` in `ui_01_core.js`)
   - active target, selection, candidate per target;
   - profile, normalisation, proxy flag;
   - a result cache keyed by all of these.

   Every view reads the same context, so a choice made in one view carries through all the others.
5. **Views.** These are listed in `README.md`. They are rendered into the existing left panel by the
   wrapped `renderLeft`. The globe and right rail remain the baseline's.
6. **Records.** Stored in `asterro.experiment/2` with id = sha256(canonical config)[:16]. Browser
   replay and Python replay (`scripts/replay_atlas_record.py`) are available. Phase II v1 records are
   read through `adaptV1`.

## Data loading

- `atlas.json` (247 KB) is loaded only when the Atlas tab opens. It is rejected if it was built for a
  different predictor stack.
- The grids (1.0 MB binary) and the sub-cell data (1.1 MB) are loaded lazily, and their SHA-256 is
  verified in the browser before use. On a mismatch the data are not used.
- Basemaps are PNG files referenced by the SVG maps.
- Everything is served from `public/`, so the app works offline from a static host.
