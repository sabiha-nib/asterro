# Phase IV — Files added and changed

## Added

| Path | Purpose |
|---|---|
| `data/registry/catalog.json` | Canonical, hand-curated catalogue: bodies, 20 regions, membership, aliases, missions |
| `data/raw/phase4/` | Gazetteer export, retained Diviner polar values and GCP reads, `MANIFEST.json` (SHA-256 of every file) |
| `src/registry/{readiness,verify,schema,build}.py` | Readiness model 3.0.0, offline regeneration, schema validation, registry build |
| `src/phase4/pipeline/extract_raw_support.py` | Network job: gazetteer export and raw-value retention |
| `app/frontend/phase4/*` | Registry engine and the Phase IV UI modules (see ARCHITECTURE.md) |
| `app/frontend/sw.src.js` | Service-worker template |
| `public/data/registry.json`, `public/data/registry/thumbs/*.png`, `public/sw.js` | Generated |
| `scripts/reproduce_registry.py` | Reproduces Explore records for registry targets (`explore-target-v1`) |
| `scripts/replay_scenario.py` | Replays Scenario Lab sets (`asterro.scenario-set/1`) with the Python reference engine |
| `app/frontend/phase4/trajectory_engine.js`, `ui_12_trajectory.js`, `p5_trajectory.css` | Discovery Trajectory (signature interaction): engine, Trajectory tab, styles. Also restores keyboard focus to the weight slider after the console re-renders (additive fix of a baseline accessibility defect) |
| `app/frontend/phase4/methods_engine.js`, `ui_13_methods.js`, `p6_methods.css` | Mismatch signatures (families, Earth ceiling, "fails the same way") and Method Arena (3 alternative rules beside the baseline, agreement, method-robust sites, leave-one-source-out). Views appended to the existing Compare and Research groups |
| `tests/phase4/test_methods_engine.mjs`, `tests/test_methods.py`, `tests/phase4/ui_methods_smoke.py`, `tests/phase4/fixtures/methods_reference.json` | Engine tests, independent numpy re-implementation, browser walk-through, reference fixture |
| `docs/phase4/METHOD_ARENA.md` | Method of both views |
| `scripts/replay_trajectory.py` | Replays `asterro.trajectory/1` files with the Python reference engine |
| `docs/phase4/TRAJECTORY.md` | Method of the Discovery Trajectory |
| `tests/test_phase4.py`, `tests/phase4/*` | Registry tests (Python), engine tests (Node), UI smoke (Playwright), scenario fixture |
| `docs/phase4/*` | This documentation |

## Changed

| Path | Change |
|---|---|
| `scripts/build_phase3_data.py` | Calls the registry build. Writes readiness 3.0.0 into the atlas (keeping the Phase III rule as `readiness_v1`), plus the registry SHA-256 |
| `scripts/build_web.py` | Appends `app/frontend/phase4/*` and writes `public/sw.js` |
| `scripts/replay_atlas_record.py` | Ranking thresholds for model 3.0.0, which are the same as v1 |
| `app/frontend/phase3/atlas_engine.js` | `eligibility()` documents model 3.0.0 (L1 none, L2 partial, L3+ full, as in v1); the workflow boundary uses it |
| `app/frontend/phase3/ui_02_catalog.js` | "Not rankable" uses the engine's eligibility |
| `tests/test_phase3.py`, `tests/phase3/test_atlas_engine.mjs`, `tests/phase3/ui_atlas_smoke.py` | See TEST_REPORT.md |
| `package.json` | Adds `test:phase4`, `build:phase4` and `test:ui`; `test` now includes Phase IV |
| `.github/workflows/ci.yml` | Validates the published registry schema |
| `public/data/phase3/atlas.json`, `public/index.html` | Regenerated |
| `README.md` | Phase IV section |

## Unchanged (verified)

- **Protected files.** Every file in `tests/phase3/fixtures/protected_sha256.json` keeps its
  SHA-256. These are the 79 baseline and Phase II files, including:
  - `engine.js`, `js/*`, `styles.css` and `index.src.html`;
  - `data/targets.json` and `app.json`;
  - the stack;
  - `scripts/reproduce.py`.
- **Predictor stack.** It rebuilds from the raw inputs to `cfbe1bf5…72e63`.
- **Legacy results.**
  - The Jezero, Lunar South Pole and cross-planet fields are bit-identical (Node and browser).
  - The baseline #1 for Jezero is still Altiplano, at 85.0 %.
