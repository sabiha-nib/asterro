# ASTERRO Phase II — Test report

Every test listed below was executed in the build workspace, and its result was observed. The
environment was Linux, Python 3.11, numpy 2.4.4, Node 22, and headless Chromium with SwiftShader
WebGL.

Real `pytest` could not be installed here because the package index was unreachable. The Python
tests were therefore run with the repository's offline runner (`scripts/run_tests_offline.py`),
which is what `npm test` uses.

## Before any change (baseline commit `7e7835a` = GitHub `3073a87`)

| Suite | Result |
|---|---|
| Python (`scripts/run_tests_offline.py`) | 36 / 36 passed |
| JS ≡ Python parity (`tests/test_js_parity.mjs`) | all parity checks passed |
| Baseline UI walk-through (`tests/ui_smoke.py`) | ran; one console error: Google Fonts unreachable in the sandbox (pre-existing) |

## After Phase II (`npm test`, 22.6 s)

| Suite | Result |
|---|---|
| Python | **50 / 50 passed**: the 36 baseline tests plus 14 Phase II tests in `tests/test_phase2.py` |
| JS ≡ Python parity | all checks passed (unchanged test) |
| Phase II engine (`tests/phase2/test_lab_engine.mjs`) | **65 / 65 passed** |

### Phase II engine checks (Node, real 76,781-cell stack)

1. **Baseline parity of the experimental scoring path:** bitwise-identical to `TAIEngine` for all
   6 mission profiles plus a custom weighting, on both targets (14 checks). The cross-planet min
   rule holds. The Python reference fixtures are reproduced bit-for-bit.
2. **Exact candidate ranks:** equal to full-sort ranks, including the last ineligible cell, and the
   tie-break is score descending, then cell id ascending.
3. **Designs:**
   - factorial = 3⁶ configurations, including the baseline, and never zeroes a weight;
   - one-at-a-time changes one weight per configuration;
   - the seeded sampler is deterministic, and its range is respected;
   - out-of-bounds sample counts, seeds and factors are rejected, as are NaN, negative and
     all-zero weights.
4. **Rank statistics:** the classification thresholds are applied as documented. Nearest-rank
   quantiles are correct. Coverage below 1 and fewer than 10 configurations both give
   insufficient evidence. Invalid thresholds are rejected. Pair flips are counted correctly.
5. **Pareto:** dominated points are removed, duplicates are kept, and NaN is not evaluable.
6. **Evidence protocol:** four kinds of invalid claim are rejected, and claims are frozen.
   Canonical JSON sorts keys and maps non-finite values to null.
7. **Requirements:** meets, fails and cannot-evaluate are reported, and missing data is never a
   match. Resolution and temporal requirements give partial. The contiguous-area condition works.
   Invalid requirements are rejected.
8. **Temporal statistics:** Theil–Sen is robust to an outlier. Mann–Kendall gives the expected
   results for monotonic and constant series. Insufficient points return null. The harmonic fit
   recovers the amplitude.
9. **Neighbourhood:** the window is centred on the candidate, the poles are marked off-grid, and
   only valid cells are used.
10. **Language guardrails:** flags the problem phrases and accepts the preferred phrasing.
11. **Performance:** factorial robustness took 3.9–4.5 s for 729 configurations × 20 candidates;
    ablation took 0.3–0.45 s.
12. **Integration safety:** no Phase II top-level name redeclares a baseline name (107 new names),
    and `renderLeft` is wrapped, not redeclared.

### Phase II Python tests (`tests/test_phase2.py`)

| Test | What it establishes |
|---|---|
| `mulberry32_and_sampled_design_parity` | The JS and Python samplers give identical sequences, and the sampled weights agree to 1e-15 relative. |
| `canonical_json_parity` | Canonical JSON is identical in JS and Python, including exponent formats. |
| `temporal_statistics_parity` | Theil–Sen, Mann–Kendall and the harmonic fit agree (p within 2e-7; JS uses an erf approximation). |
| `pareto_parity` | The JS and Python Pareto fronts are identical. |
| `rank_stats_and_bounds` | Classification and bound rejection work. |
| `replay_browser_robustness_record` | A 729-configuration factorial record exported from the browser is replayed by independent Python code: 20 of 20 candidates identical. |
| `replay_browser_ablation_record` | An ablation record replays identically for all 6 criteria. |
| `replay_detects_tampering` | An edited record is reported NOT REPRODUCED (exit status 1). |
| `record_integrity_and_no_secrets` | Record ids equal the Python canonical-JSON hash, and the records contain no credential-like strings. |
| `series_checksum_and_values_match_raw_inputs` | The series checksum matches. Monthly T2M equals the raw POWER values within int16 rounding (≤ 0.005 °C), and its range reproduces the baseline criterion. The MODIS yearly counts equal the raw counts, and Σ n_year = n_clim. |
| `target_window_stats_match_targets` | The window mean slope equals the target slope, the elevation SD equals the target roughness, and the MEDA per-sol mean is consistent. |
| `catalog_consistency` | Every requirement field exists in the stack. No UNMODELED factor claims evidence. Activity checklists carry no numeric thresholds. |
| `baseline_files_unchanged` | SHA-256 of 21 baseline files equals the baseline commit. |
| `app_registry_scientific_content_unchanged` | Version, ranges, profiles, thresholds, criteria and stack checksum equal the baseline. |

## UI walk-throughs (Playwright)

- **Baseline walk-through on the Phase II build:** output identical to the baseline build (JSON
  diff of results and errors). An exported reproduce record verified with
  `scripts/reproduce.py`.
- **Pixel comparison, 16 screenshots:**
  - Header: the only changed pixels are at x = 734–756 px, the new "LAB" tab label.
  - Left panel: 0.00 %.
  - Right rail: 0.00 %.
  - Globe: up to 0.38 %, from animation timing.
  - Mobile: 0.00 %.
- **Lab walk-through (`tests/phase2/ui_lab_smoke.py`):** exit 0, no page errors.
  - Every module was opened for Jezero, Lunar South Pole and Cross-planet.
  - Robustness ran: factorial, 5.2 s in the browser, 20 candidate rows.
  - Ablation produced 6 rows; Pareto found 462 / 800 non-dominated.
  - Counterexamples, evidence graph (67 nodes, 122 edges, all 12 node types and all 10 edge
    types), series load, requirements evaluation, plan generation and review all ran.
  - **Browser replays of the robustness, ablation and requirements records: REPRODUCED.**
  - After all experiments, the baseline `S.res.eff`, top site and weights were unchanged.
  - Mobile horizontal overflow: 0 px.
- **Start-up time:** baseline build 0.75–1.09 s vs Phase II build 0.86–0.90 s (4 runs each). No
  Phase II data is requested at start-up.

## Not tested

- Multi-objective, failure-mode, planner and review outputs have no independent second
  implementation; they are checked through unit logic and the UI walk-through only.
- The Vault's localStorage behaviour was exercised in Chromium only.
- No scientific validation against field data was performed.
