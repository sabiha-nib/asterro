# V17 test report (2026-11-10, final build)

## Regression and new tests

**`npm test`: all passing.**

| Suite | Result |
|---|---|
| Python (`scripts/run_tests_offline.py`, includes `tests/test_v17.py`) | 139/139 (116 existing + 23 V17) |
| JS parity | passing |
| Phase II engine | 65 |
| Phase III engine | 132/132 |
| Phase IV registry, trajectory, methods, journey | 74, 26, 37, 53 |
| i18n, routes, extension, extension languages | 52, 63, 39, 36 |
| **V17 engine** (`test_v17_engine.mjs`, new) | 35/35 |
| **V17 languages** (`test_v17_i18n.mjs`, new) | 24/24 |

**Browser suites (Chromium, SwiftShader): all 18 pass** in one sequential run on the V17 build.

| Suite | Checks |
|---|---|
| `ui_smoke.py`, `ui_lab_smoke.py`, `ui_atlas_smoke.py` | exit 0 |
| `ui_phase4_smoke.py` | 75 |
| `ui_trajectory_smoke.py` | 24 |
| `ui_methods_smoke.py` | 19 |
| `ui_journey_smoke.py` | 70 |
| `ui_global_smoke.py` | 39 |
| `ui_routes_i18n_smoke.py` | 27 |
| `ui_journal_persist_smoke.py` | 16 |
| `ui_responsive_smoke.py` | 113 |
| `ui_ext_smoke.py` | 45 (see below) |
| `ui_design_smoke.py` | 23 |
| `ui_design_audit.py` | 165 |
| `ui_layout_sweep.py` | 316 (seven viewports, now including the V17 views) |
| **`ui_v17_smoke.py`** (new) | 49 |

`ui_ext_smoke.py` asserted the exact list of Discover views. V17 adds four views, so the expected list now names the
six Phase IV views in their original order plus the four new ones; the assertion is still exact. Small text and data
fixes made after the full run (unit typography in the limitations table, legend label) were followed by reruns of the
V17 Python, engine, language and browser suites, all passing.

**Protected files.** 79 of 79 byte-identical. `scripts/v17_baseline.py` finds no difference from the pre-V17 commit in
protected files, reference results, stack, engine configuration, datasets or routes.

## What the new tests check

- **Data pipeline** (`tests/test_v17.py`): the cube, novelty, registry and limits rebuild offline to the published
  documents; inputs match their SHA-256; the patterns rebuild exactly with the recorded scikit-learn version.
- **Scientific safeguards**: missing values stay missing (aridity zone, interannual SD, novelty gate); counts are whole
  months; no polar night equatorward of 65°; tropics receive the most top-of-atmosphere sunlight; twelve freezing
  months imply a mean below zero; UNEP and relief class boundaries; hidden combinations meet their rule; no source is
  integrated without retained, verified data; unreachable sources carry the recorded error; blocked modules have no
  inputs; proxies are labelled; Mars pressure equals the MEDA data.
- **Engine** (`test_v17_engine.mjs`): decoding; modules read the stack; completeness drops instead of zero-filling;
  custom distance, one-per-country and MMR diversity (MMR with weight 1 equals the plain order); Surprise me draws are
  deterministic, follow their rules, and modes without data are unavailable; challenges; the report has 20 sections.
- **Browser** (`ui_v17_smoke.py`): Atlas card to Science domains; ten modules; five separate measures; nine
  limitations; Explore/Research mode; module value equals the stack value; diversity methods with distances checked;
  patterns; Surprise me card, three levels, reproduction download, points for correct readings only once, journal,
  results unchanged by the game; unavailable mode; Inspect the evidence → Lab step 3; challenges pass and fail;
  Lab step 6 link and the 20-section report download; registry in the Data tab; Science layer legend, polar-night
  painting on every valid cell and aridity zones left blank where missing; four languages without raw keys;
  baseline unchanged; phone layout without horizontal scroll; prohibited-element audit on every new view.
- **Layout** (`ui_layout_sweep.py`): at 2048 × 1331, 1920 × 1080, 1440 × 900, 1280 × 800, 1024 × 768, 768 × 1024 and
  390 × 844, the Atlas with the Science layer and a selected place, Science domains in Research mode and a Surprise me
  card show no overlap, clipping, squeezed text or horizontal scroll, and panel text meets WCAG AA contrast.

## Failures found while testing, and fixed

- Polar-night threshold first set at 1 MJ m⁻² day⁻¹ marked months at 63–64.5° as polar night; lowered to 0.25 so dark
  months start at 65–66.5°, next to the polar circles.
- "Strong in one condition only" found nothing while restricted to above-median scores; the restriction was removed.
- The candidate card became taller and overlapped the layer row and the panel toggle at 1024 × 768 and 1280 × 800;
  on tablets the card now sits under the globe, and on short desktop screens it is compact.
- The Science legend sat under the candidate card; the Atlas legend moved to the right.
- The open layer row pushed the Expedition chip and Layers button under the ranking toggle on tablets; the toggle moves
  down when the row is open.
- The Data tab's "source ↗" link arrow counted as a pictograph; the arrow is dropped from rendered text.
- The five-measures table was cramped in the narrow panel; the V17 views now use the wide research layout and the
  table has two columns.

## Performance (1440 × 900, SwiftShader, one run)

Page ready 4.4 s (page size 5.8 MB, was 3.7 MB). Render times: Science domains 237 ms, Novelty and diversity 25 ms,
Patterns 9 ms, Surprise me 7 ms, environmental-variety diversity 33 ms. Draws: unexpected Mars analogue 46 ms, polar
39 ms, under-represented region 38 ms, one-condition 230 ms. Products are precomputed at build time and decoded once.

## Not run

No test against field data or independent reference data exists for any module. No native-speaker review.
