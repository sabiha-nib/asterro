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
| `app/frontend/phase4/journey_engine.js`, `ui_14_journey.js`, `p7_journey.css` | Discovery Journey: live discoveries, 7-step Reveal, Difference Lens, Change my mind?, Missing pieces, Trust view (no combined score), Other worlds, Through time, Team of places, Earth Analogue Passport (JSON / PNG / print / collections). Entry points added beside the existing ones (landing button, "Explain this place", Discover door); the globe pauses its idle rotation while the dialog is open |
| `app/frontend/phase4/i18n_00_core.js`, `i18n_10_en.js`, `i18n_20_bn.js`, `i18n_30_es.js`, `i18n_40_fr.js` | Interface languages: core (fallback, Intl formats, `html lang`, Bengali font, header language control) and the dictionaries. bn / es / fr / de drafted by Claude, not yet reviewed by native speakers |
| `tests/phase4/test_journey_engine.mjs`, `tests/test_journey.py`, `tests/phase4/test_i18n.mjs`, `tests/phase4/ui_journey_smoke.py`, `tests/phase4/fixtures/journey_reference.json` | Journey engine tests, independent numpy re-scoring, language completeness, browser walk-through in four languages, fixture |
| `docs/phase4/JOURNEY_I18N.md` | Method, translation status and tests of the journey and the languages |
| `app/frontend/phase4/ui_15_dimensions.js` | Six-dimension panel: plain-language line, unit, target / place scale, active state and an ⓘ explanation with the engine's numbers (additive DOM layer over the baseline console) |
| `app/frontend/phase4/ui_16_globe.js` | Explorable landing globe (click on land opens that place), the narrated "Where on Earth should we look?" reveal, Coverage and Dimension layers |
| `app/frontend/phase4/ui_17_journal.js` | Same Earth / Different Mission, the user portfolio, the Exploration Journal (steps, achievements, challenges) |
| `app/frontend/phase4/ui_99_i18n_dom.js`, `i18n_50_de.js`, `p8_global.css` | Workspace translation over the baseline views (exact phrase catalogue + templates), German, styles |
| `tests/phase4/ui_global_smoke.py` | Browser walk-through of the globe-first workspace in five languages |
| `docs/phase4/GLOBE_WORKSPACE.md` | Method, rules and tests of this step |
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
| `package.json` | Adds `test:phase4`, `build:phase4` and `test:ui`; `test` now includes Phase IV (and the journey and language checks); `test:ui` includes the journey and globe-workspace walk-throughs |
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

## Completion pass (five languages on every route, header, tablets, data inventory, journal)

| Path | Change |
|---|---|
| `app/frontend/phase4/i18n_60_seg.js`, `i18n_65_places.js`, `i18n_71`–`74_routes_*.js` | Added: research-route translator, CLDR country table, route catalogues (2,571 keys × 4) |
| `app/frontend/phase4/ui_18_nav.js`, `ui_19_inventory.js`, `ui_20_journal_store.js`, `ui_97_i18n_report.js`, `ui_98_i18n_routes.js`, `data_inventory.js`, `p9_complete.css` | Added (see ARCHITECTURE.md) |
| `app/frontend/phase4/i18n_00_core.js` … `i18n_50_de.js` | New keys (header, inventory, journal store, quotation label, language section) in all five languages; the English-only notice retired |
| `app/frontend/phase4/ui_99_i18n_dom.js`, `ui_14_journey.js` | Country names through CLDR in the workspace; the per-screen review note retired (status kept in the Method view) |
| `scripts/i18n_harvest.py`, `i18n_catalogue.mjs`, `i18n_build_routes.mjs`, `i18n_check_routes.mjs`, `i18n_seg_node.mjs`, `i18n_terms_check.mjs` | Added: harvest, catalogue and checking tools |
| `scripts/build_inventory.py`, `scripts/probe_data_sources.py`, `data/inventory/*`, `docs/data/DATA_INVENTORY.md` | Added: data inventory from project state and a recorded reachability probe |
| `docs/i18n/TRANSLATION_REGISTER.md`, `glossary.json`, `TRANSLATOR_BRIEF.md`; `docs/phase4/COMPLETION_QA.md` | Added |
| `tests/phase4/test_routes_i18n.mjs`, `ui_routes_i18n_smoke.py`, `ui_journal_persist_smoke.py`, `ui_responsive_smoke.py`, `tests/test_inventory.py`, fixtures | Added |
| `tests/phase4/ui_journey_smoke.py` | The "English only notice" assertion now asserts the translated research view and the notice's absence (the requirement changed) |
| `package.json` | `test:phase4` adds the route-catalogue test; `test:ui` adds the routes, journal and responsive walk-throughs |
| `public/index.html`, `public/sw.js` | Regenerated |

Unchanged: the protected baseline files, the predictor stack, `tai-sim-1.0.0`, the six criteria, every score.
