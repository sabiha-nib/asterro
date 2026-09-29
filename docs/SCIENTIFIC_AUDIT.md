# ASTERRO — Scientific audit record

Audit of the existing application (formerly "Terraform Analogue Intelligence") under the
*ASTERRO surgical scientific + branding modifier*. The interface was treated as locked; this file
records what was checked, what was found, what was changed, and what remains **unverified**.

Nothing in this audit validates the analogue rankings scientifically. It checks that the code
does what the documentation says, that proxies are labelled as proxies, and that results are
reproducible.

Algorithm version is unchanged: `tai-sim-1.0.0`. No target value or Earth value changed. The
target vectors were compared against a snapshot taken before the audit, and the predictor-stack
SHA-256 (`cfbe1bf5…72e63`) is the same before and after.

## 1. Findings and fixes

| # | Area | Finding | Action | Effect on results |
|---|------|---------|--------|-------------------|
| F1 | Aridity documentation | The criterion registry said PET used POWER `TOA_SW_DWN`. The code uses FAO-56 extraterrestrial radiation (Ra), because TOA_SW_DWN is missing on about 69 % of cell centres. | Registry text corrected. | None (text only) |
| F2 | Target status | Proxy status was stored as free text only (`comparison`) plus boolean `proxy_flags`. | Added a machine-readable `status` (DIRECT / PROXY / N/A), `proxy_method` and `interpretation` to each target. `annotate()` asserts that status, flags and null values agree. | None (metadata only) |
| F3 | Diviner time bins | The claim that "hour14" means 13:00–14:00 local time had not been checked. | **Verified.** The summer hour14 map equals the mean of the PDS 0.25-h products LTIM53–56. RMS difference is 6.9e-6 K over 794,601 pixels; the hour13 alternative gives 28 K. | None |
| F4 | Weight validation | The Python and JS engines rejected negative weights but accepted NaN and ±Infinity. | Both engines now reject non-finite weights and undefined or degenerate normalisation ranges. | None for valid inputs |
| F5 | Zero-weight drag | While dragging the weight dial, the live preview could briefly have a total weight of 0. | Guarded: all-zero weights show a message and are never scored. | None |
| F6 | Integrity check | A predictor-stack SHA-256 mismatch was only flagged. | A mismatch now stops loading with an explicit error. No scores are shown from unverified data. | None for intact data |
| F7 | Cross-planet labelling | In Cross mode the temperature-range weight carried no note. It applies to Jezero only (N/A for the Moon). | "Mars only" tag added to that weight card. | None |
| F8 | Score terminology | The UI said "similarity" in places where it presents the ranked score. | Renamed "Analogue Score" and suffixed "under <profile>". | None |
| F9 | Zarr claim | The README described `data/predictor_stack.zarr`, but it was never written, because zarr-python was not installed in the build container. | Added a dependency-free Zarr v2 writer (`zarr_v2.py`), used when zarr-python is absent. **Verified**: zarr-python 3.1.6 and xarray 2026.7.0 read the writer's output back exactly. | None |
| F10 | Non-finite Earth values | ±Infinity Earth values were scored as a total mismatch (s = 0) instead of being treated as missing. Found by spec test 14. | Both engines now treat any non-finite Earth value as missing. The shipped stack contains no infinities (checked), so no score changes. | None on shipped data |
| F11 | Cross-planet rule duplicated | The rule `min(S_Mars, S_Moon)`, with −1 when either target is ineligible, was written inline in two places. | Factored into `similarity.cross_planet()` and tested (spec test 10). | None |
| F12 | Reproducibility record | The export omitted the scoring formula, coverage definition, tie-break and distinct-site rule. | These are now included, together with target status, active criteria, product name and creation time. | None |
| F13 | Accessibility | Dialogs did not trap or restore keyboard focus, and the weight dials lacked readable values. | Focus trap and restore added; weight dials got `aria-valuetext`. | None |

## 2. Rule checks (spec §§ 7–18)

| Rule | Implementation | Test |
|------|----------------|------|
| d = \|e−t\|/(max−min); s = clip(1−d,0,1); S = Σw·s/Σw | `similarity.py`, `engine.js` | spec 1, 2, 14; JS parity |
| Normalisation fixed and independent of target | One range table: min–max over Earth cells ∪ all target values | spec 12 |
| Missing Earth value → excluded and renormalised; coverage reported | same | spec 4 |
| N/A target → excluded everywhere, coverage not reduced | same | spec 5 |
| Coverage < 0.80 → not ranked; = 0.80 → ranked | `MIN_COVERAGE − 1e-12` tolerance | spec 6, 7 |
| Tie-break: score descending, then cell id ascending | `ranking.order` | spec 8 |
| Distinct sites ≥ 300 km, greedy haversine, R = 6371.0088 km | `ranking.distinct_sites` | spec 9 |
| Cross-planet = min of the two scores | `similarity.cross_planet` | spec 10 |
| Invalid weights rejected | both engines | spec 13; JS parity |
| Evolution: STABLE if yearly score range ≤ 2 pts | `03_compute.js`, threshold in `app.json` | UI (not unit tested) |
| Constellations deterministic | farthest-point k-means init, k ∈ {3, 4, 5} chosen by silhouette | `test_similarity`; JS parity |

## 3. Independent reproduction

* **Cross-environment rebuild.** The stack was rebuilt from the four raw Earth inputs in a separate
  environment (Higgsfield sandbox, numpy 2.4.6, zarr-python 3.1.6; the repository used numpy 2.4.4).
  The raw inputs were downloaded by URL, and their SHA-256 values matched. The rebuild reproduced
  `stack.bin` with the identical SHA-256 `cfbe1bf5fab5497b3d16bfc368eb4202ffaf2b5a1257bfd85f6834e735f72e63`
  (6,449,606 bytes). Its zarr-python store equals the npz for all 16 arrays.
* **Reproduce round trip.** Exported Moon and Cross configurations, and a Mars custom-weight record
  exported from the rebranded UI (new record format), reproduce with
  `scripts/reproduce.py`, checking stack hash, selected-cell score and rank, and top-3 distinct
  sites (spec test 11).
* **Browser vs Python.** For both targets, all 76,781 effective scores are bitwise identical.
  Ranking, the 20 distinct sites and the constellation labels are also identical.

## 4. Visual regression

The UI smoke walk-through (16 screenshots, desktop 1512 × 900 and mobile 390 × 844) was run on the
pre-audit build and on this build, and the frames were compared pixel by pixel.

* **What differs:** the brand block and the right-rail caption, which now names the weighting
  profile. In settled frames, about 0.5 % of pixels change. The Data view also gained a
  "✓ verified in this browser" integrity note, which offsets its dataset table by about 1 px.
* **Brand block:** its width is pinned to the old wordmark width (157 px), so the tab bar keeps its
  x position (235 px). The subtitle wraps onto two lines inside the unchanged 58 px bar.
* **Rail caption:** shortened so it stays at two lines for every profile at ≥ 1280 px. At 1024 px
  it wraps to three lines for "Science instrument testing" only.
* **Timing:** the opening reveal animation is timing-dependent under software WebGL, so frames
  captured mid-reveal differ. Settled frames of the globe are identical (0.007 % of centre pixels).
* **Mobile:** page height and horizontal overflow (0 px) are unchanged.

## 5. Not verified / open limitations

* The Diviner hour02 bin is assumed to follow the same numbering as hour14; it was not checked
  separately.
* MODIS LST was decoded from NASA GIBS imagery through the published colormap, which has 0.6 K
  bins and open-ended extremes. It was not cross-checked against the MYD11C3 HDF science files.
* NASA POWER values are used as served by the API; they were not cross-checked against MERRA-2
  granules.
* No ranking has been compared against field-validated or expert-listed analogue sites. The
  scores measure variable similarity only.
* Two of six criteria are PROXY for both targets (aridity, elevation), and one is N/A for the Moon
  (temperature range). A lunar score therefore rests on three direct criteria.
* Direct thermal comparisons are cross-instrument: MEDA TIRS or Diviner against MODIS
  split-window LST. The Mars annual temperature range (air) is a rover point measurement set
  against 55 km Earth cell means.
* Gravity, radiation, atmospheric composition and pressure, day length, regolith and mineralogy
  are not modelled.
* Licence summaries follow each provider's published data policy and have not been legally
  reviewed.
