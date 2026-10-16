# ASTERRO Phase III — Test report

Every result below was executed and observed in the build workspace on 2026-10-15/16.

**Environment:** Linux, Python 3.11, numpy 2.4, Node 22, Playwright Chromium with SwiftShader.
`pytest` is not installable offline, so Python tests use `scripts/run_tests_offline.py`, which is
what `npm test` runs.

**Pipeline environment:** the network jobs ran in a separate Linux sandbox with Python 3, rasterio
1.5.2, GDAL 3.12.2, numpy 2.5.4, netCDF4 1.7.5 and pyshp. Before use, the md5 of each script there
was checked against the repository copy.

## `npm test` (19.7 s, exit 0)

| Suite | Result |
|---|---|
| Python | **65 / 65** = 36 baseline + 14 Phase II + **15 Phase III** |
| JS ≡ Python baseline parity | all checks passed (unchanged test) |
| Phase II engine | **65 / 65** (unchanged test) |
| Phase III engine (`tests/phase3/test_atlas_engine.mjs`) | **126 / 126** |

## Phase III engine checks (Node, real stack + atlas)

1. **Catalogue integrity**
   - 33 targets (18 Mars, 15 Moon), built for this stack.
   - Every criterion has a status.
   - A value exists exactly when the status is DIRECT or PROXY.
   - Readiness follows the rule, and proxies never count.
   - Baseline targets are identical to `data/targets.json`.
   - No fingerprint copies a baseline fingerprint.
   - Mars LST without a product stays MISSING.
   - Moon annual range is INCOMPATIBLE; Reiner Gamma is MISSING.
   - Pipeline recomputation of Jezero and the south pole agrees with the baseline to within rounding.
2. **Baseline parity:** in the baseline configuration, the atlas path equals `TAIEngine` **bitwise**
   for 2 targets × 6 profiles. Distinct candidates equal the baseline distinct sites.
3. **JS ≡ Python:** for all 33 targets, the per-target normalisation table and the top-20 candidates
   (index and score to 1e-12) equal the Python `src/compute` reference.
4. **Eligibility and missing data**
   - L1 is excluded from ranking; L2 is labelled partial.
   - MISSING and PROXY criteria are not scored by default.
   - A missing Earth value gives no similarity and no contribution.
   - The coverage rule makes such a cell ineligible.
5. **Normalisation alternatives:** each table follows its documented rule. Equatorial lunar ΔT is
   flagged as outside Earth's range.
6. **Comparison analytics**
   - Proxy, missing and incompatible criteria are reported correctly.
   - The shared score equals the minimum of the per-target scores.
   - The complementary set is ≥ 300 km apart.
   - Stability uses a 3⁴ factorial for Gale.
   - Measurement impact never fills the target's value.
7. **Window classes:** connected components and bin area are verified on synthetic grids.
8. **Contract v2:** the v1 → v2 adapter is lossless on the Phase II fixture; malformed records are
   rejected.
9. **Workflow and copilot**
   - An L1 target stops after "target"; without a candidate the workflow waits.
   - An unanswerable question gets the exact refusal sentence.
   - Safety questions are refused.
   - Citations are correct.
10. **Integration safety:** 0 top-level name clashes with baseline or Phase II names, and no
    duplicates. `renderLeft` is wrapped, not redeclared.
11. **Performance:** candidate search for 33 targets takes 864–896 ms (about 27 ms per target).

## Phase III Python tests (`tests/test_phase3.py`)

| Test | Establishes |
|---|---|
| catalogue_matches_specification | Atlas order and kinds equal `target_catalog.py`; exactly 2 baseline targets. |
| anchors_equal_gazetteer_or_published_coordinates | 12 anchors equal the independently verified gazetteer, NSSDCA and LROC coordinates. Gazetteer features are IAU-adopted. The Olympus Mons offsets are exactly 150 and 450 km on the great circle. |
| every_value_traces_to_pipeline_outputs | Every atlas value equals the raw pipeline output it came from. MISSING means no value. |
| rems_aggregate_recomputed_from_per_sol_files | The unchanged baseline `aggregate()` applied to the 306 per-sol files reproduces both REMS variants. Per-sol Ls is recomputed from the label times. |
| mars24_solar_longitude_validated | Mars24 worked example, and the Mars 2020 PDS4 label Ls (sol 100). |
| diviner_polar_grid_convention | South and north lon/lat conversion equals the provider's `.txt` rows. |
| diviner_gcp_layout | File naming, and the record-offset formula checked against 4 verified records. |
| grids_and_files_checksums | Grid file, per-grid layout, raw npz grids, sub-cell file and basemaps match their SHA-256. |
| subcell_reproduces_baseline_slope | The histogram-pass mean slope equals the baseline slope for 76,781 cells (max abs Δ = 0.0). |
| atlas_normalisation_and_reference_recomputed | `compute_ranges` reproduces `atlas-norm-1`. Python per-target tables and candidates equal the shipped reference for 4 targets. |
| no_secrets_or_signed_urls | No credentials or presigned-URL fragments in atlas or raw files. |
| readiness_rule_and_level1_exclusion | Every level equals `readiness()`; only L ≥ 2 targets have reference rankings. |
| replay_browser_records | Two records exported from the browser (atlas-candidates for Gale · Elysium · Shackleton; atlas-stability for Gale) are **REPRODUCED** by independent Python code. |
| replay_detects_tampering | An edited record gives **NOT REPRODUCED** (exit 1). |
| baseline_and_phase2_files_unchanged | 79 protected files equal commit `6cc403c`. |

## Browser walk-throughs (Playwright)

**Phase III (`tests/phase3/ui_atlas_smoke.py`): exit 0, no page errors**

- Atlas tab present; 18 Mars cards and 15 Moon cards; search "apollo" returns 4.
- The Target view renders 3 rasters for Shackleton (relief, slope, ΔT).
- Compare on the user's example (Gale · Elysium · Shackleton):
  - 3 columns;
  - stability for 3 targets in 1.4–1.5 s;
  - measurement impact in 1.4 s;
  - comparison record saved.
- Workflow on Gale reaches 7 of 8 stages DONE and 1 READY (requirements, which are optional).
- All 14 views render.
- Copilot: correct evidence answer, safety refusal, and the exact refusal sentence for an
  out-of-scope question.
- Records: browser replay of both replayable records is **REPRODUCED**.
- After every action, the baseline `S.res.eff`, weights, target and ranges are unchanged, and the
  Explore top site is unchanged.
- Mobile overflow: 0 px.

**Baseline walk-through (`tests/ui_smoke.py`):** Phase II build vs Phase III build gives **identical**
output. Pixel comparison is in CHANGES.md.

**Phase II Lab walk-through (`tests/phase2/ui_lab_smoke.py`) on the Phase III build:** exit 0, no
errors. Three browser replays are REPRODUCED, the baseline is unchanged, and the Spatial Atlas shows
the new sub-cell block.

## Not tested

- The optional language-model copilot mode, because it needs a Claude viewer with the `sample`
  capability. Only the deterministic core was tested.
- localStorage behaviour, which was exercised in Chromium only.
- Scientific validation against field measurements, which was not performed.
- The planetary data pipeline is not re-run by `npm test`, because it needs network access. Its
  outputs are checked for internal consistency, checksums and reproduction of the baseline values.
