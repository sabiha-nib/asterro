# ASTERRO V18 Local Impact: test report

All results below come from runs in the build environment (headless Chromium through Playwright, Node, Python),
on the final build. Nothing was skipped, and no assertion was weakened.

## 1. Non-browser tests (`npm test`, exit code 0)

| Suite | Result |
|---|---|
| Python (incl. inventory reproducibility, published parity) | 139/139 |
| JS ↔ Python parity, Phase II | pass |
| Phase III engine | 132/132 |
| Phase IV registry / trajectory / method / journey | 74/74, 26/26, 37/37, 53/53 |
| i18n / extension / extension i18n | 52/52 + 63/63, 39/39, 36/36 |
| V17 engine, V17 i18n | 35/35, 24/24 |
| **V18 Local Impact engine (`test_v18_local.mjs`)** | **23/23** |
| **V18 i18n (`test_v18_i18n.mjs`)** | **24/24** |

Also checked: `scripts/v17_baseline.py` reports **no differences**, and all 79 protected files in
`tests/phase3/fixtures/protected_sha256.json` are byte-identical.

## 2. Browser regression (19 suites, all pass)

`ui_smoke`, `ui_lab_smoke`, `ui_atlas_smoke`, `ui_phase4_smoke` (75), `ui_trajectory_smoke` (24), `ui_methods_smoke` (19),
`ui_journey_smoke` (70), `ui_global_smoke` (39), `ui_routes_i18n_smoke` (27), `ui_journal_persist_smoke` (16),
`ui_responsive_smoke` (113), `ui_ext_smoke` (45), `ui_design_smoke` (23), `ui_design_audit` (165),
`ui_layout_sweep` (351, now including Local Impact at 7 viewports), `ui_v17_smoke` (49), and
**`ui_v18_local_smoke` (59)**. Numbers are PASS lines; the first three suites report JSON summaries with no errors.

Three suites failed on the first full run and were resolved as follows:

| Suite | Failure | Resolution |
|---|---|---|
| `ui_global_smoke` | "all 10 tabs fully visible": the check required exactly 9 tabs | All 10 tabs were measured fully visible at 1512, 1366 and 1280 px in all five languages; the exact count was updated to 10 (still exact). |
| `ui_design_smoke` | exact navigation order | Local Impact was added after Atlas in the Discover group, the position the brief asks for; the order check stays exact. |
| `ui_phase4_smoke` | "mobile: atlas panel scrolled into view (top 347 px)" | Timing under load, as already seen in V15: in isolation the panel is at 0 px from 1 s onwards in 3 of 3 runs. The suite then passed on rerun. The V18 `setTab` wrapper acts only on the `local` tab. |

## 3. What `ui_v18_local_smoke` covers

| Brief requirement | Tested |
|---|---|
| Permission granted | Atacama position through the browser API, activated with the keyboard; the right cell; accuracy radius and source shown; focus moves to the result |
| Permission denied / unavailable / timeout / unsupported | Each state is shown with a retry and a manual fallback; nothing is recorded |
| Inaccurate location | Accuracy 60 km: analysed with a warning |
| Privacy | No position request before the person asks; exactly one request and no `watchPosition`; no network request carries the position; no external request; page address unchanged; nothing stored without consent |
| Manual search | Region name, coordinates (Iceland), invalid coordinates, ocean point (off the grid), unknown name |
| Radii | 50/100/250/500 km from the keyboard; the cell count grows; named regions and analogues lie within the radius |
| Missing datasets / incomplete coverage | Nine unavailable variables shown with their registry state, never as zero; an Antarctic cell (84.5° S) against the Lunar South Pole shows "not available" and missing dimensions, and states coverage below 100 % |
| Comparison | Per-dimension readings equal the unchanged `ENG.detail`; the Lunar South Pole shows its missing dimension; "not a probability" |
| Discoveries | Measured evidence and a separate hypothesis; every cited cell is inside the radius |
| Report | Each precision (cell, 1°, exact, none) with 14 sections; every precision other than "exact" leaves out the entered position, and "none" states that no coordinates are given; version, radius and data gaps recorded |
| Saved places | Consent tick, save, delete one, delete all; no coordinates stored |
| Baseline unchanged | Ranking, top score, weights and target are identical before and after using Local Impact |
| Mobile, tablet | Phone 390 × 844, tablet 768 × 1024 and 1024 × 768: no horizontal page scroll |
| Keyboard | Native controls only; radius buttons keep focus |
| Languages | Bengali, Spanish, French and German render the view |
| Design audit | No prohibited design element in the view |

## 4. Issues found in screenshot review and fixed

- On phones the profile table was 372 px wide inside a 338 px box, which clipped the evidence badges. Row headers
  now shrink and values wrap on screens ≤ 560 px, with each number kept together with its unit (338/338 px at 390,
  308/308 at 360).
- Discovery evidence showed numbers without units (e.g. "= 41.85"). They now carry the profile's unit ("41.9 K",
  "12 months", "3,491 m"), and counts and percentiles are whole numbers.
- In error states the Try again button sat mid-sentence. It now sits below the message.

## 5. Not tested

- Real devices and real browser permission prompts: geolocation was emulated by Playwright.
- Translation quality: the translations are machine-assisted and have not been reviewed by native speakers.
- Screen readers: semantics were checked (native controls, polite live region, focus), but no screen reader was run.
