# Phase IV — Architecture

## Data flow

```
data/registry/catalog.json ───────────┐  (hand-curated: bodies, regions, membership, aliases, missions; no numbers)
data/raw/phase4/gazetteer_catalog.json ┤  (pipeline: IAU/USGS names, coordinates, extents, quadrangles)
src/phase3/target_catalog.py ─────────┤  (window definitions)
data/raw/phase3/*, data/raw/phase4/* ──┤  (fingerprint inputs; retained raw values; MANIFEST.json)
data/targets.json, public/data/app.json┘  (legacy targets and Earth stack registry, unchanged)
            │
            ▼  scripts/build_phase3_data.py → src/registry/build.py
               ├─ verify.regenerate()  offline regeneration of every DIRECT value
               ├─ readiness.evaluate() explicit checks → level
               └─ schema.validate()    the build aborts on any error
            │
            ├─ public/data/registry.json          (asterro.registry/1)
            ├─ public/data/registry/thumbs/*.png  (hillshades of the real DEM windows)
            └─ public/data/phase3/atlas.json      (readiness 3.0.0 + readiness_v1; registry SHA-256)
            │
            ▼  scripts/build_web.py
               ├─ public/index.html  (baseline js/ + phase2/ + phase3/ + phase4/, concatenated)
               └─ public/sw.js       (versioned offline cache)
```

## Integrity chain in the browser

Each link is checked when the file loads:

1. The stack is checked against `app.json` by SHA-256.
2. `atlas.json` must name that stack.
3. `registry.json` is checked against the SHA-256 recorded in the atlas, and must name the same
   stack.
4. The explore ranges of every L3+ target are recomputed from the stack and must equal the
   registry's ranges.

## Frontend modules (`app/frontend/phase4/`)

| File | Role |
|---|---|
| `registry_engine.js` | Pure functions (browser and Node), exposed as `AsterroRegistry`. Covers index, search, filters, sorting, counts, quick actions, compatibility, aggregates, Pareto, validation metrics, weight sensitivity, mismatch, collections and provenance export. |
| `ui_01_core.js` | Registry loading and verification, storage helpers, grouped module bar, location ↔ target state sync |
| `ui_02_atlas.js` | Hierarchical atlas: tree, search combobox, browse / regions / list / table modes, location summary, quick actions |
| `ui_03_lab.js` | Comparison Lab |
| `ui_04_validation.js` | Validation workspace |
| `ui_05_mismatch.js` | Mismatch Explorer |
| `ui_06_readiness.js` | Readiness & Provenance centre, with JSON export |
| `ui_07_collections.js` | Research collections |
| `ui_08_explore.js` | Explore adapter. Registers L3+ targets and wraps `simFor`, `detailFor`, `setTarget` and `reproConfig` so that ranges belong to the target being computed. Adds the quick-switch, the Lab notice and the hero call to action. |
| `ui_09_offline.js` | Service-worker registration, status and cache clearing |
| `ui_10_scenarios.js` | Scenario Lab: up to four scenarios, rank-change chart, robust candidates, contributions, export and replay |
| `ui_11_expedition.js` | Research objectives added to the Phase III expedition designer |
| `p4.css` | Cartographic layer. Raises `--ink-3` inside the workspace for contrast ≥ 4.5:1 |
| `trajectory_engine.js`, `ui_12_trajectory.js` | Discovery Trajectory (see TRAJECTORY.md) |
| `methods_engine.js`, `ui_13_methods.js` | Mismatch signatures and Method Arena (see METHOD_ARENA.md) |
| `i18n_00_core.js`, `i18n_10_en.js` … `i18n_40_fr.js` | Interface languages. They load first among the Phase IV files (`i18n_` sorts before the others). `tx()` with English fallback, Intl formats, `setLang` / `asterro:lang`. They wrap `renderLeft` (formerly the English-only notice, now retired), `renderConsole` and `a4ExploreControl` (quick-switch prompt). See JOURNEY_I18N.md |
| `ui_15_dimensions.js`, `ui_16_globe.js`, `ui_17_journal.js` | Six-dimension panel (wraps `renderConsole`, `updateConsoleNumbers`, `select`); landing globe, narrated reveal and the Coverage / Dimension layers (wraps `pick`, `paintField`, `setLayer`, `renderLegend`); missions, portfolio and journal (wraps `runSearch`, `setTarget`, `applyProfile`, `select`, `jnRender` and the passport exports to record real actions). See GLOBE_WORKSPACE.md |
| `ui_99_i18n_dom.js` | Loads last, so its wrappers are outermost: re-translates the baseline views after every render (`renderRight`, `renderLeft` on Explore, `renderLegend`, `renderStatus`, `renderConsole`, `updateConsoleNumbers`, `hover`, `announce`) |
| `journey_engine.js`, `ui_14_journey.js` | Discovery Journey: a pure engine (`AsterroJourney`) over `TAIEngine` that returns data only, plus the dialog. They wrap `selectedHeader` ("Explain this place"), `viewDiscover` (door) and `a4Load` (refresh when the registry arrives). See JOURNEY_I18N.md |
| `i18n_60_seg.js`, `i18n_65_places.js`, `i18n_71`–`74_routes_<lang>.js` | Segment translator for the research routes (keys with `{0}` / `{nK}` / `{pK}` placeholders; identifier detection; quoted source text with its original; user text kept), the Natural Earth → ISO table for CLDR country names, and the four harvested route catalogues. See COMPLETION_QA.md |
| `ui_18_nav.js` | Header fit: the tab bar takes its own row when the labels do not fit; arrow-key movement; chip placement beside the globe controls |
| `ui_19_inventory.js`, `data_inventory.js` | Data-inventory statuses in Missing pieces and the Data view (generated by `scripts/build_inventory.py`) |
| `ui_20_journal_store.js` | Journal persistence: merge on save, cross-tab merge, corrupt-value guard, confirmed reset with `resetAt`, export / import, progress summary |
| `ui_97_i18n_report.js`, `ui_98_i18n_routes.js` | The Markdown report in the active language; the `MutationObserver` that runs the segment translator on `#left` (research routes) and `#sheet` |
| `p9_complete.css` | Header row, Bengali typography, quoted-source disclosure, inventory chips, narrow-screen wrapping |

## Integration with the earlier layers

Phase IV is additive. It touches the earlier layers only in the ways listed here.

**Phase III router.**

- The new views are registered in `A3_VIEWS`.
- `viewAtlas` is redefined to draw a two-level module bar: groups first, then the modules in the
  current group. Every Phase III module keeps its view id.
- The Atlas tab now opens on the hierarchical atlas. The Phase III catalogue is the
  "Target cards" view.

**Phase III engine.**

- `eligibility()` applies readiness model 3.0.0: L1 none, L2 partial, L3+ full. These are the same
  thresholds as the Phase III v1 rule, so old records keep their meaning.

**Baseline wrappers.**

- `simFor` / `detailFor` run each target with its own ranges, and legacy targets with the legacy
  table.
- `setTarget` sets `S.ranges` for the selected target.
- `reproConfig` adds the scoring configuration (plus the fingerprint hash for registry targets).

**Baseline files.**

- Untouched; every file in `tests/phase3/fixtures/protected_sha256.json` keeps its hash. Records for
  registry targets are reproduced by the new `scripts/reproduce_registry.py`.
- `scripts/build_web.py` appends the Phase IV assets and writes `sw.js`.
