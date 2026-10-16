# Phase III — Files added and modified, and how the baseline is protected

Starting point: the Phase II commit `6cc403c` (= baseline `7e7835a` / GitHub `3073a87` + Phase II).

## Phase II audit (actual status before Phase III)

All 13 Phase II modules were present and their tests passed:

- Python: 50 / 50;
- JS parity: passed;
- Phase II engine: 65 / 65;
- Lab walk-through: exit 0.

The audit found one documented gap: the *Spatial Analogue Microclimate Atlas* was "partially
implemented" because Earth sub-cell data were not retained. Phase III closes that gap for terrain
(see METHODS §7). Climate and thermal sub-cell data remain unavailable.

## Modified files (6)

| File | Change | Reason |
|---|---|---|
| `scripts/build_web.py` | +5 lines | Append `app/frontend/phase3/*.js` after Phase II and `*.css` after the Phase II css. This is the same mechanism Phase II used. |
| `public/index.html` | regenerated | Output of `build_web.py`; it now contains the Phase III code. |
| `package.json` | +2 scripts; `test` extended | Adds `test:phase3` and `build:phase3`, and `npm test` now also runs the Phase III engine checks. |
| `app/frontend/phase2/ui_04_atlas.js` | +13 / −3 | Completes the Phase II Spatial Atlas: shows the Earth sub-cell slope distribution when Phase III data are present. It falls back to the original message otherwise. |
| `app/frontend/phase2/ui_01_core.js` | 1 line | The module status text for the Spatial Atlas now reflects the completed terrain sub-cell analysis. |
| `README.md` | section appended | Documents Phase III. |

No baseline file is modified, and no Phase II engine file (`lab_engine.js`) or Phase II data file is
modified.

## Added files

| Area | Files |
|---|---|
| Catalogue and pipeline | `src/phase3/{__init__.py, target_catalog.py}`, `src/phase3/pipeline/{build_atlas.py, rems_gale.py, gmted_subcell.py}` |
| Pipeline outputs (raw, checksummed) | `data/raw/phase3/`: `resolved.json`, 33 × `terrain/*.json` + `.npz`, `thermal_polar.json`, 5 × `thermal_*.npy`, `thermal_gcp.json`, `rems_gale.json`, `rems_index.json`, `rems/sol_*.json` (306), `earth_subcell.npz`, `basemap_{mars,moon}.npz`, `terrain_provenance.json` |
| Build and replay | `scripts/build_phase3_data.py`, `scripts/replay_atlas_record.py` |
| App data | `public/data/phase3/`: `atlas.json`, `grids.b64.txt`, `subcell.b64.txt`, `basemap_{mars,moon}.png` |
| Front end | `app/frontend/phase3/`: `atlas_engine.js`, `ui_01_core.js` … `ui_12_copilot.js`, `atlas.css` |
| Tests | `tests/test_phase3.py`, `tests/phase3/test_atlas_engine.mjs`, `tests/phase3/ui_atlas_smoke.py`, `tests/phase3/fixtures/{protected_sha256.json, record_atlas-candidates_*.json, record_atlas-stability_*.json}` |
| Docs | `docs/phase3/*` |

## Integration points with the running app

The only integration points are these:

1. **Tab.** One tab button ("Atlas") is appended at runtime.
2. **Render wrapper.** `renderLeft` is wrapped by assignment, the same pattern as Phase II. When
   `S.tab !== "atlas"`, the previous function (Phase II's wrapper, then the baseline) runs unchanged.
3. **Namespaced events.** All events use `data-a3*` attributes.
4. **Names.** All Phase III top-level names are new. A test enforces this: 0 clashes with baseline or
   Phase II names.
5. **CSS.** Phase III uses its own classes. One early clash with the baseline `.mk` marker class was
   found by screenshot review and renamed (`.atmk`).
6. **Storage.** Phase III records use their own storage key (`asterro.phase3.vault.v2`). Phase II
   records are read through an adapter and never written.

## Baseline preservation evidence

| Check | Result |
|---|---|
| SHA-256 of 79 baseline and Phase II files, taken from commit `6cc403c` (`tests/phase3/fixtures/protected_sha256.json`) | all identical |
| `app.json`: ranges, profiles, thresholds and stack checksum | unchanged (existing Phase II test) |
| Atlas scoring path in baseline configuration vs `TAIEngine` | bitwise identical: 2 targets × 6 profiles |
| Baseline UI walk-through (`tests/ui_smoke.py`), Phase II build vs Phase III build | output identical (JSON diff) |
| Pixel comparison, 16 baseline screenshots, run-matched | left panel and right rail 0 changed pixels. Header: only x = 782–823 px (the new "ATLAS" label). Hero and globe frames vary between runs of the *same* build (animation timing). |
| Baseline `S.res.eff`, weights, target and ranges after every Phase III action (`ui_atlas_smoke.py`) | unchanged |
| Start-up time (4 runs each) | Phase II 0.66–0.94 s; Phase III 0.74–0.78 s. No Phase III file is requested at start-up. |
