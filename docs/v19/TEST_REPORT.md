# ASTERRO V19: test report

All results come from runs in the build environment (headless Chromium through Playwright, Node, Python) on the
final build, starting from the V18 commit `cab7a0c`. Nothing was skipped, and no assertion was weakened.

## 1. Baseline and preservation

| Check | Result |
|---|---|
| `scripts/v19_baseline.py --check` (engine configuration, reference results, stack hash, V17 products and registry, V18 Local Impact engine, rendered tabs) | **no differences** |
| `scripts/v17_baseline.py` | no differences |
| 79 protected files (`tests/phase3/fixtures/protected_sha256.json`) | byte-identical |
| Baseline result in the browser before and after V19 views (top site, score, weights, target, eligible cells) | unchanged (`ui_v19_smoke`, `ui_v18_local_smoke`) |
| Top-level navigation | unchanged: 10 tabs; V19 lives inside Discover, Local Impact and Data |

## 2. Non-browser tests (`npm test`, exit code 0)

| Suite | Result |
|---|---|
| Python (incl. 12 V19 tests) | 151/151 |
| JS ↔ Python parity, Phase II | pass |
| Phase III engine | 132/132 |
| Phase IV registry / trajectory / method / journey | 74/74, 26/26, 37/37, 53/53 |
| i18n / extension / extension i18n | 52/52 + 63/63, 39/39, 36/36 |
| V17 engine, V17 i18n | 35/35, 24/24 |
| V18 Local Impact engine, V18 i18n | 23/23, 24/24 |
| **V19 domains engine (`test_v19_engine.mjs`)** | **36/36** |
| **V19 i18n (`test_v19_i18n.mjs`)** | **25/25** |

The 12 V19 Python tests:

- baseline has no differences;
- catalogue complete and honest;
- each dataset judged on its own routes;
- environment refusals are not provider failures;
- integration needs retained, hashed files;
- ML validation and the missing-data rule;
- nine states, every row in one;
- registry rebuild matches the published file;
- site-sample manifests hash their files;
- site-sample rebuild is reproducible;
- a corrupted transcription is rejected;
- V17 registry preserved and mapped.

## 3. Browser regression (20 suites, all pass on the first full run)

`ui_smoke`, `ui_lab_smoke`, `ui_atlas_smoke`, `ui_phase4_smoke` (75), `ui_trajectory_smoke` (24),
`ui_methods_smoke` (19), `ui_journey_smoke` (70), `ui_global_smoke` (39), `ui_routes_i18n_smoke` (27),
`ui_journal_persist_smoke` (16), `ui_responsive_smoke` (113), `ui_ext_smoke` (45), `ui_design_smoke` (23),
`ui_design_audit` (165), `ui_layout_sweep` (351), `ui_v17_smoke` (49), `ui_v18_local_smoke` (59) and
**`ui_v19_smoke` (39)**. Numbers are PASS lines; the first three suites report JSON summaries with no errors.

After the screenshot review (§5), `ui_v19_smoke`, `ui_layout_sweep`, `ui_design_audit` and `ui_v18_local_smoke` were
run again on the changed build.

## 4. What `ui_v19_smoke` covers

- **Discover › Science domains:**
  - why the candidate ranked;
  - nine separate measures (similarity equals the engine's);
  - 16 domains, with blocked domains showing no value;
  - 14 objective profiles gated by data;
  - physical differences;
  - material evidence at a sampled cell, with no similarity computed;
  - "not sampled" at an unsampled cell.
- **Discover › Patterns:** ML validation (stability, sensitivity, bias, missing data, no accuracy claimed, "not a discovery").
- **Data:**
  - nine states with counts equal to the registry;
  - every dataset listed, with the V17 registry still shown;
  - each blocked dataset says where it was refused (this environment or the fetch route), not that the provider failed;
  - Macrostrat, GVP and GBIF shown as "integrated, awaiting full validation".
- **Local Impact:**
  - the 16 domains and 14 objectives before the report;
  - at the Atacama cell, 15 Holocene volcanoes within 100 km, and the V18 "not shown" note updated with that count;
  - Archaea records named with their dataset;
  - nothing stored without consent.
- **Baseline:** unchanged.
- **Languages and phone:** Bengali, Spanish, French and German with no raw keys; no horizontal scroll at 390 px; no page errors.

## 5. Screenshot review: issues fixed

- Local Impact and Science domains listed waiting datasets by internal id ("nasadem", "copernicus_dem"). They now
  show the registry title ("NASADEM", "Copernicus DEM GLO-30").
- Science domains shows the V17 "Five separate measures" above the V19 "Nine separate measures". The V19 introduction
  now says that its list extends the five V17 measures, in all five languages. The V17 text is unchanged.

## 6. Not tested

- Real devices: browsers were emulated by Playwright.
- Translation quality: the translations are machine-assisted and have not been reviewed by native speakers.
- Screen readers: semantics were checked, but no screen reader was run.
- The NASA POWER acquisition pipeline (`src/v19/acquire_power.py`): it has never run, because both routes refuse POWER.
