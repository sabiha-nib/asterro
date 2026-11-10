# ASTERRO V19 data extension: NASA and partner data, environmental cube, offline store

Version `tai-v19-data-2.0.0`. It extends V19 without changing the original six-dimensional engine:

- the profiles, thresholds and 300 km rule are unchanged;
- the fingerprints and rankings are unchanged;
- V18 Local Impact and the V19 domains are unchanged.

The exact lists and numbers for every dataset are in `docs/v19x/DATASETS.md`, which is generated from the data
(`scripts/v19x_dataset_report.py`). Test results are in `docs/v19x/TEST_REPORT.md`.

## How the data were obtained

| Route | Result |
|---|---|
| This build environment (cloud) | Every provider refused (egress proxy, HTTP 403 to CONNECT). Not retried. |
| The user's computer, shell | Every provider refused: the shell has its own proxy, which also answers 403. |
| WebFetch service | Only transcriptions (no files); POWER refused by robots.txt; GIBS images failed; ~250-character URL limit. Used in the first V19 pass only. |
| **The user's computer, the Claude desktop browser** (with the user's permission) | **Works.** `fetch()` runs from a page on each provider's own web origin. Each response is hashed (SHA-256) in the page and saved byte for byte to `Downloads/asterro_data`, then copied into the build. Save mechanics and their verification are below. |

**Saving.** The browser allows one automatic file save per page load. Larger outputs are kept in the page's cache
storage and saved one per reload of an export page. Every saved file was checked against the hash computed in the
page before saving.

**Rate limiting.** POWER refused some boxes with HTTP 429 ("too many requests"). A slower second pass re-requested
exactly those URLs (`asterro_power_<P>_fill.json.gz`). The parser replaces a failed response only with a successful
response for the same URL.

**Where the files are.** Raw files: `data/v19/raw/` in the build, and the user's `Downloads/asterro_data/`. They are
not committed, because of their size (≈ 200 MB). Their SHA-256 values are in `public/data/v19/env/cube.json` →
`sources`, in `inventory.json` → `raw_sha256`, and in `data/v19/x/build_report.json`.

**Credentials.** None were used. No API key, Earthdata password or token is used, stored or logged.

## 1–4. NASA datasets

| | |
|---|---|
| Discovered | NASA Common Metadata Repository (CMR) UMM-C records for 33 short names (32 found, `GGD318` not found under that name), the NASA POWER parameter catalogue (1,634 climatology parameters), the NASA GIBS capabilities (1,330 layers), and the earlier V19 registry entries. |
| Downloaded, validated, processed, integrated, cached | **NASA POWER, 15 climatology parameters** (2001–2025, regional API, 450 boxes each). Sources: MERRA-2 at the native 0.5° × 0.625° grid (identical to the ASTERRO grid), or CERES SYN1deg at 1°. Parameters: wind at 10 and 50 m, maximum wind, U and V wind components, aerosol optical depth, surface pressure, humidity, cloud, surface and root-zone soil wetness, snow depth and snow fraction, albedo, and surface solar irradiance. **Six NASA GIBS layers**, decoded with their published colormaps: MERRA-2 dust surface concentration (120 months), MODIS snow cover (120 months), MODIS EVI (60 months), MISR aerosol optical depth (120 months), MODIS IGBP land cover (2024) and the MODIS land/water mask. |
| Requires authentication | The CMR science collections (MODIS HDF, MERRA-2 NetCDF, NASADEM, SRTM, ASTER GDEM, ASTER emissivity, EMIT minerals, ECOSTRESS, VIIRS, SMAP, GLDAS, IMERG, CALIPSO, OPERA, RGI, GLIMS…). Their own access constraints require a NASA Earthdata Login, which ASTERRO does not hold. They are recorded as `REQUIRES_AUTHENTICATION`, never as integrated. |
| Planetary (Moon, Mars) | The earlier retained products are unchanged: MOLA, LOLA, Diviner, MEDA, PDS gazetteer. No new planetary data were acquired in this pass. HiRISE, CTX, CRISM, THEMIS, MCS, REMS and LROC remain as recorded in the V19 registry (blocked from the build environment). |

## 5. Non-NASA datasets (each labelled "not NASA" in the Data tab)

| Provider | Data |
|---|---|
| Smithsonian Institution, Global Volcanism Program | Complete Holocene (1,214) and Pleistocene (1,452) volcano lists. All 39 volcanoes transcribed in the first V19 pass agree with the download. |
| Macrostrat (University of Wisconsin–Madison) | Geological map units at 101 cells. The 16 cells transcribed earlier agree exactly. |
| GBIF | Occurrence counts (all records, Archaea, Bacteria) at 101 cells. The 16 earlier cells agree exactly. |

## 6. Domains and their actual coverage

Seven data-layer domains are shown in Discover › Science domains and in Local Impact. Each states what its data
cannot say:

- **Wind and atmosphere**: global (POWER).
- **Aerosols and dust**:
  - global modelled surface dust (MERRA-2);
  - column aerosol optical depth: CERES (global except where it is missing) and MISR (sparse);
  - this is not a surface dust measurement.
- **Surface water and soil**: the MODIS water mask and MERRA-2 soil wetness. Wetness is missing over land ice.
- **Snow and ice**:
  - MODIS-detected snow, a lower bound;
  - MERRA-2 snow depth and fraction, missing over land ice;
  - MODIS permanent snow and ice class.
- **Surface cover**: the MODIS IGBP land-cover classes and the albedo. A class is not a mineral composition.
- **Vegetation**: MODIS EVI, with gaps under snow, cloud and darkness. It is not evidence of life.
- **Volcanic context**: global distances and counts from the Smithsonian lists. These are not hazard ratings.

The earlier V19 domains still apply in full:

- **Geology and biology:** at the 16 sampled cells, now verified, and as site queries at 101 cells.
- **Mineralogy, caves and resources:** blocked; mineral and spectral data need an Earthdata Login (EMIT, ASTER).
- **Wind and dust:** previously "waiting for data", these now have data through the data-layer domains above.

## 7. Offline capabilities (tested with the network disabled)

- **App shell:** the existing versioned service worker precaches the shell and every data product, including the
  cube and the inventory.
- **Scientific data:** an IndexedDB store `asterro-data` holds the cube with its manifest, plus the inventory,
  volcano list and site results.
  - A copy is used only if its byte length, SHA-256 and cell order match.
  - A corrupted copy is refused.
  - A refresh never replaces a valid copy until the new copy has been verified.
- **Offline analyses:**
  - Science domains and Local Impact read the stored cube.
  - Each analysis is saved with the cube hash, the datasets used and the domains without data.
  - Re-running reproduces it exactly (tested).
- **Synchronisation:**
  - a manual "Check for updated data";
  - "Verify stored data";
  - online/offline detection;
  - cache date and provider query dates;
  - clear messages when the server cannot be reached.
- **Never live:** the stored data are always labelled with where the copy came from and when the providers were
  queried. They are climatologies and catalogues, not live data.

## 8. Tests

See `docs/v19x/TEST_REPORT.md`.

## 9. Blocked providers and authentication

- **Blocked routes:** listed in `inventory.json` → `routes`, with the class of each failure (network policy,
  service limit, rate limit).
- **Authentication needs:** each CMR collection's access constraint is stored verbatim in its inventory row.
- **What would unlock the science files:** a NASA Earthdata Login, used on the user's own machine (for example with
  `earthaccess` and a `.netrc` the user creates). The credential would never pass through chat or the repository.

## 10. Scientific limitations

- **Imagery, not science files.** GIBS imagery is a visualisation product:
  - values are quantised to the colormap bins;
  - open-ended bins become lower bounds (dust at 90 µg/m³ and above, MISR AOD at 1.0 and above);
  - transparent pixels cannot be told apart (this is why snow is a lower bound).
- **Reanalysis.** MERRA-2 variables (POWER, dust) are model output constrained by observations. They are labelled as
  such and never as direct measurements.
- **Climatology.** POWER values are a 2001–2025 climatology. GIBS climatologies use the years stated per layer.
  Temporal mismatches between layers are stated in every row.
- **Mixed resolutions.** 1° CERES values are sampled at each ~55 km cell centre and labelled as 1°. Nothing is shown
  at a finer scale than its source.
- **Samples.** Site queries cover 101 cells, not the globe. GBIF counts reflect sampling effort; presence is not
  habitability.
- **No new scores.** No new scientific score is added. The original engine is unchanged and nothing is combined with
  it. The unsupervised V17 patterns still claim no accuracy.
- **No certification.** No site is certified, and no NASA endorsement is claimed.
