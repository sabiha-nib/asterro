# ASTERRO V19 data extension: test report

All results come from runs on the final build in the build environment (headless Chromium through Playwright, Node,
Python). No test was skipped and no assertion was weakened. The two test changes are described in §3.

## 1. Non-browser tests (`npm test`, exit code 0)

| Suite | Result |
|---|---|
| Python, including `tests/test_v19x.py` (16 new) and the V19 baseline check | 167/167 |
| JS ↔ Python parity, Phase II | pass |
| Phase III engine | 132/132 |
| Phase IV registry / trajectory / method / journey | 74/74, 26/26, 37/37, 53/53 |
| i18n / extension / extension i18n | 52/52 + 63/63, 39/39, 36/36 |
| V17 engine and i18n; V18 engine and i18n; V19 engine and i18n | 35/35, 24/24; 23/23, 24/24; 36/36, 25/25 |
| **V19 data-extension engine (`test_v19x_engine.mjs`)** | **19/19** |
| **V19 data-extension i18n (`test_v19x_i18n.mjs`)** | **17/17** |

The 16 tests in `tests/test_v19x.py`:

- **POWER parsing:**
  - the fill value stays missing;
  - points shared by two boxes must agree;
  - a hash mismatch is refused;
  - HTTP 429 responses are kept out of the data;
  - units and physical bounds are checked;
  - the 1° grid (with its ambiguous points) is recognised, and all-zero aerosol depth becomes missing.
- **Grid join:** cell ids and cell centres; an off-grid point is refused.
- **GIBS decoding:**
  - transparent pixels never take an opaque colour's meaning;
  - an unknown opaque colour fails;
  - open-ended top bins are flagged as lower bounds.
- **Cube:**
  - the manifest hash, size and cell order match;
  - every variable carries its metadata;
  - missing stays missing (EVI over Antarctica; every missing POWER aerosol value is missing in the cube);
  - the Atacama facts hold.
- **Temporal metadata:** the POWER period is 2001–2025.
- **Inventory:**
  - states are allowed values and the counts add up;
  - downloaded datasets carry a raw hash;
  - attribution is NASA / non-NASA;
  - every row that needs authentication cites Earthdata.
- **Provenance:**
  - every raw file matches the hash in the manifest;
  - the 39 GVP transcriptions and the 16 Macrostrat/GBIF transcriptions agree with the downloads.
- **Reproduction:** the land-cover shares are re-derived from the raw PNG and match the cube bit for bit.
- **CMR:** each found record has an identifier, a version and its access conditions.

## 2. Browser regression (21 suites, all pass)

`ui_smoke`, `ui_lab_smoke`, `ui_atlas_smoke`, `ui_phase4_smoke`, `ui_trajectory_smoke`, `ui_methods_smoke`,
`ui_journey_smoke`, `ui_global_smoke`, `ui_routes_i18n_smoke`, `ui_journal_persist_smoke`,
`ui_responsive_smoke` (113), `ui_ext_smoke`, `ui_design_smoke`, `ui_design_audit` (165), `ui_layout_sweep` (351),
`ui_v17_smoke`, `ui_v18_local_smoke`, `ui_v19_smoke` (39) and **`ui_v19x_smoke` (32)**.

`ui_v19x_smoke` includes a real offline run: the network is disabled and the page reloaded. It checks:

- **Integrity and storage:** the cube loads, passes its integrity check and is stored in IndexedDB.
- **Data tab:**
  - all 129 datasets are listed, with NASA / non-NASA attribution, every required field, filters and state counts;
  - the earlier V19 registry is still shown.
- **Values:** the values shown equal the cube decoded independently in Python.
- **Domains:** seven domains, each stating what it cannot say.
- **Local Impact (Atacama):**
  - 15 Holocene volcanoes within 100 km, nearest Cerro Tujle, from the full catalogue;
  - Barren land cover;
  - the analysis is saved offline;
  - privacy is unchanged.
- **Baseline:** the six-dimensional result is unchanged.
- **Offline:**
  - the layers come from the stored copy and are labelled "not live";
  - a refresh keeps the valid copy;
  - a corrupted stored copy is refused.
- **Languages and phone:** four languages; no sideways scroll on a phone.

## 3. Failures found and fixed

| Suite | Failure | Fix |
|---|---|---|
| `ui_responsive_smoke` | Phone 390 px, German and Bengali: the Data tab was 12 and 7 px too wide | A long dataset name in an inventory summary did not wrap. It now wraps; both languages measured exactly 390 px. |
| `ui_v19_smoke` | "the V19 section sits directly before the report" | The new data-layer section sits between them, as `ui_v19x_smoke` requires. The check now accepts exactly that one section in between, and nothing else. |

## 4. Found and fixed during data processing

| Problem | Fix |
|---|---|
| Transparent pixels decoded as opaque values: GIBS draws transparent pixels as (0,0,0,0), and the EVI colormap's opaque black means 0.95–0.975 | Matching uses colour and opacity together; tested. |
| "0 % snow" and "no data" are the same transparent pixel in GIBS snow imagery | Snow is reported as a detected lower bound and labelled as such. |
| The open-ended top dust bin (≥ 90 µg/m³) was treated as missing, which erased the Sahara | Kept at the bin's lower bound and flagged; tested. |
| POWER parameters on two grids (MERRA-2 native, CERES 1°), with 1° centres that also fall on the 0.625° grid | The grid is decided per response; tested. |
| POWER labels albedo units "dimensionless" | The unit check accepts POWER's own declaration. |
| 60 POWER boxes refused (HTTP 429) | Recovered by a slower gap-fill pass (60/60). |
| USGS Astrogeology products counted as NASA by a name match | Only PDS-delivered products count as NASA. |

## 5. Not tested

- Real devices: emulated by Playwright.
- Screen readers.
- Translation quality: machine-assisted, not reviewed by native speakers.
- The planetary datasets beyond those already retained (none acquired in this pass).
