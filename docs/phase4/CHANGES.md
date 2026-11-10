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

## Planetary Analogue Intelligence expansion (after Phase IX)

See `docs/phase4/EXPANSION.md` for the feature-by-feature implementation report.

| Path | Change |
|---|---|
| `src/ext/thermal_absolute.py`, `src/ext/engine.py`, `src/ext/__init__.py` | Added: absolute day / night / air temperatures for Earth and the 16 targets with direct thermal data (`tai-ext-thermal-1.0.0`); Python reference of the extended field (`explore-ext-thermal-v1`) |
| `data/ext/dimensions.json`, `processes.json`, `known_analogues.json`, `profiles_ext.json` | Added: dimension registry (28), processes (12), frequently cited analogue sites (17), extended profiles (13: 5 buildable) |
| `scripts/build_ext.py`, `scripts/export_ext_reference.py` | Added: generate `public/data/ext/*` and `app/frontend/phase4/data_ext.js`; write `tests/fixtures/ext_reference.json` |
| `app/frontend/phase4/ext_engine.js`, `ui_21_ext_core.js`, `ui_22_discover_hub.js`, `ui_23_research.js`, `ui_24_datacenter.js`, `p10_ext.css` | Added: extension engine (UMD), Discover hub, Lens thermal rows, research queue, report editions, Data-view tables |
| `app/frontend/phase4/i18n_79_extend.js`, `i18n_80_ext_en.js` … `i18n_84_ext_de.js` | Added: catalogue extension mechanism (never overwrites a key) and 495 keys in each of five languages |
| `scripts/probe_data_sources.py`, `scripts/build_inventory.py`, `data/inventory/*`, `docs/data/DATA_INVENTORY.md` | HiRISE, CTX, CRISM, MCS and Sentinel-2 added to the probe (all refused on 2026-11-06); inventory rebuilt |
| `data/raw/phase4/RETENTION.json`, `tests/test_phase4.py`, `.gitignore` | A non-input log that `*.log` kept out of git is recorded as not retained; the regeneration test reads that record instead of failing on a fresh clone |
| `tests/test_ext.py`, `tests/phase4/test_ext_engine.mjs`, `tests/phase4/test_ext_i18n.mjs`, `tests/phase4/ui_ext_smoke.py` | Added |
| `package.json` | `test:phase4` adds the two extension Node suites; `test:ui` adds the extension walk-through |
| `public/index.html`, `public/sw.js`, `public/data/ext/*` | Regenerated |

Unchanged: the protected baseline files, `tai-sim-1.0.0`, the six criteria, thresholds, the seven profiles and every score.

## Challenge-compliance and design pass (after `c15fb5b`)

See `docs/phase4/CHALLENGE_COMPLIANCE.md` (one row per brief item) and `docs/phase4/DESIGN.md`.

| Path | Change |
|---|---|
| `src/ext/context.py`, `public/data/ext/context_ext.json` | Added `tai-ext-context-1.0.0`, computed from retained inputs and never scored: Köppen–Geiger class per cell (Peel et al. 2007, NASA POWER climatology), Natural Earth environment type, noon solar-elevation geometry, kilometre-scale slope shares for Earth and targets |
| `data/ext/processes.json` | 17 processes (6 observed, 8 indirect indicators, 3 described). This covers the twelve the brief names: sedimentation, dust storms, aeolian erosion, volcanic, impact, thermal weathering, water-driven alteration, glacial, permafrost, salt deposition, fluvial, surface erosion |
| `data/ext/dimensions.json`, `data/ext/operations.json` | Added climate class and environment type; new "context" status; 11 exploration operations with their measured conditions |
| `app/frontend/phase4/ui_25_context.js` | Added: the site profile in the place view (location, environment, climate class, permafrost indicator, illumination geometry, slope shares, operations, kinds of evidence, where the analogy breaks down); process rules by environment and climate class; environment filter in Beyond the familiar |
| `app/frontend/phase4/q1_design.css`, `ui_26_design.js` | Added the design layer: tokens, typography, glass surfaces, grouped navigation, landing promise with three ways in, plain-language summary card, Simple / Advanced view, focus rings, reduced motion |
| `app/frontend/phase4/i18n_80`–`84_ext_*.js` | 206 new keys in each language, plus 16 updated where the data changed (701 extension keys per language) |
| `tests/test_ext_context.py`, `tests/phase4/ui_design_smoke.py`; `tests/phase4/ui_ext_smoke.py`, `test_ext_i18n.mjs` | Added; extended for the site profile, the environment filter, the indirect processes and `ui_25` / `ui_26` keys |
| `package.json` | `test:ui` adds the design walk-through |

Unchanged: the protected baseline files (including `tests/ui_smoke.py` and `tests/phase2/ui_lab_smoke.py`), `tai-sim-1.0.0`, the thresholds, the seven profiles and every score.

## Atlas and Research Laboratory redesign

See `docs/phase4/DESIGN.md`.

| Path | Change |
|---|---|
| `app/frontend/phase4/q1_design.css` | Rewritten as a restrained design system. The previous pass's gradients, shadows, translucent surfaces, violet accents, 14–22 px radii and hover motion are removed. Additions: Atlas layout, Laboratory workflow, legal dialog |
| `app/frontend/phase4/ui_26_design.js` | Landing entries are a numbered list (no symbols). Adds Terms of Service and Privacy Policy (links, dialog, `#terms` / `#privacy`), `#app[data-tab]`, and em-dash and checkmark normalisation of rendered text |
| `app/frontend/phase4/ui_27_lab_flow.js` | Added: the seven-step Research Laboratory workflow |
| `app/frontend/phase4/ui_28_atlas.js` | Added: Atlas context card, Layers button, 3D globe on entering the Atlas |
| `app/frontend/phase4/p10_ext.css` | Status colours use the palette tokens |
| `app/frontend/phase4/i18n_80`–`84_ext_*.js` | 91 keys added in each language; `ext.proc.p` reworded |
| `tests/phase4/ui_design_audit.py`, `tests/phase4/test_ext_i18n.mjs`, `package.json` | New audit and walk-through; key checks extended to `ui_26`–`ui_28`; `test:ui` runs the audit |

## Version 15: layout, two modes, interpretation

See `docs/phase4/DESIGN.md`, section "Version 15".

| Path | Change |
|---|---|
| `app/frontend/phase4/q1_design.css` | Two-tone geological palette (stone panels, ocean chrome). Container queries on the side panels. Small-laptop Atlas columns. Collapsible panels. Compact console in Explore mode. Phone card moved under the globe. Comparison table fits the panel. Light colour scheme, link colour and tertiary ink in the panels |
| `app/frontend/phase4/ui_27_lab_flow.js` | Eighth step "Interpret and apply". Second-place column, target status and Earth dataset with resolution in step 3. Glossary of seven terms |
| `app/frontend/phase4/ui_28_atlas.js` | On phones the card is placed under the globe. Card adds dimensions assessed, weight coverage, direct and proxy counts, closest exploration operation and the not-a-probability note. Panel toggles. Configuration summary and "Reset weights" in the console |
| `app/frontend/phase4/ui_22_discover_hub.js` | `xtProcEval` also returns the set of matching cells, so a place can list the process settings it falls in |
| `app/frontend/phase4/i18n_80`–`84_ext_*.js` | 37 keys added or reworded in each language: modes renamed Explore mode and Research mode, with a hint explaining the difference; the Laboratory intro says eight steps |
| `tests/phase4/ui_layout_sweep.py` | New: seven viewports, overlap, clipping, squeezed text, globe dominance, contrast |
| `tests/phase4/ui_design_audit.py` | Eight steps; second place, glossary, Research-mode columns, interpretation step, panel toggle, configuration summary and weight reset |
| `package.json` | `test:ui` also runs the layout sweep |

No engine file, dataset, threshold, profile, fingerprint, report format or route changed. The 79 protected files are
byte-identical.

## V17: global discovery layer

See `docs/v17/README.md`. Added: `src/v17/` (features, novelty, ml, registry, modules, limits), `scripts/build_v17.py`,
`scripts/probe_v17.py`, `scripts/v17_baseline.py`, `scripts/v17_examples.mjs`, `data/v17/` (sources, probe,
baseline), `public/data/v17/`, `app/frontend/phase4/{data_v17.js, engine_v17.js, ui_29_v17.js, ui_30_surprise.js,
i18n_85–89_v17_*.js}`, `tests/test_v17.py`, `tests/phase4/{test_v17_engine.mjs, test_v17_i18n.mjs, ui_v17_smoke.py}`.
Changed: `ui_28_atlas.js` (card under the globe on tablets too), `ui_26_design.js` (the pictographic link arrow is
dropped from rendered text), `q1_design.css` (V17 styles, Atlas overlays), `tests/phase4/ui_layout_sweep.py` (V17 views),
`package.json` (V17 tests and builds), `README.md`. Unchanged: the engine, all 79 protected files, datasets, routes.

## V18: Local Impact

See `docs/v18/README.md`. Added: `app/frontend/phase4/{engine_v18.js, ui_31_local.js, i18n_90–94_v18_*.js}`,
`tests/phase4/{test_v18_local.mjs, test_v18_i18n.mjs, ui_v18_local_smoke.py}`, `docs/v18/`. Changed: `q1_design.css`
(Local Impact styles, tab order, link-button colour on light panels), `tests/phase4/ui_layout_sweep.py` (Local Impact
at seven viewports), `package.json`, `README.md`. Unchanged: the engine, V17 products, the registry, all 79 protected files.
