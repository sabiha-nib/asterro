# ASTERRO V17: Global Planetary Analogue Discovery

V17 adds analytical capability on top of the unchanged Phase IV application. Everything new is computed from data
already retained in the repository, because no data provider could be reached from the build environment
(see [DATA_REGISTRY.md](DATA_REGISTRY.md)). Nothing in V17 changes the baseline score, ranking, thresholds, profiles,
fingerprints, datasets or routes.

Contents: 1 baseline · 2 architecture · 3 feature cube · 4 domain modules and validation plans · 5 novelty ·
6 unsupervised patterns · 7 spatial diversity · 8 Surprise me · 9 explanations · 10 Earth's limitations · 11 report ·
12 interface · 13 compliance matrix · 14 implementation status. Real example analyses: [EXAMPLES.md](EXAMPLES.md).
Tests: [TEST_REPORT.md](TEST_REPORT.md).

## 1. Baseline

`scripts/v17_baseline.py` snapshots, from the pre-V17 commit `5fa654a`, everything V17 must preserve, and compares it
with the working tree. The result is in `data/v17/baseline.json`.

- 79 protected files: SHA-256 equal to `tests/phase3/fixtures/protected_sha256.json` before and after.
- Reference results used by the parity tests (`tests/fixtures/reference.json`, `ext_reference.json`,
  `ref_*.f64`, `repro_*.json`): unchanged.
- Engine: `tai-sim-1.0.0`; thresholds 0.85 / 0.60, 80 % coverage, 300 km separation, 800 candidates; six criteria;
  seven profiles; normalisation ranges: unchanged.
- Earth stack `public/data/stack.bin`: unchanged (same SHA-256).
- Dataset inventory, routes (6 tabs plus `#terms` / `#privacy`) and Discover hub list in source: unchanged.
- Test baseline before V17: all `npm test` suites and all 16 browser suites passing (V15 final run,
  `docs/phase4/TEST_REPORT.md`).

**Differences found after V17: none.**

## 2. Architecture

```
data/raw/*.npz, data/predictor_stack.npz  (retained, checksummed inputs; unchanged)
        │
src/v17/features.py   tai-v17-features-1.0.0   feature cube: 11 derived variables per valid Earth cell
src/v17/novelty.py    tai-v17-novelty-1.0.0    novelty indicator (rarity, distance to listed sites, classes)
src/v17/ml.py         tai-v17-ml-1.0.0         k-means groups, isolation-forest anomalies, hidden combinations
src/v17/registry.py   asterro.v17.registry/1   8-state Data Integration Registry (+ scripts/probe_v17.py)
src/v17/modules.py    asterro.v17.modules/1    10 domain modules: inputs, evidence kinds, validation plans
src/v17/limits.py     tai-v17-limits-1.0.0     Earth Analogue Limitations framework
        │  scripts/build_v17.py (deterministic; same SHA-256 on rebuild)
public/data/v17/*.json  +  app/frontend/phase4/data_v17.js (ASTERRO_V17, embedded with the SHA-256)
        │
app/frontend/phase4/engine_v17.js   AsterroV17: modules, novelty, diversity, Surprise me, challenges, report
app/frontend/phase4/ui_29_v17.js    Discover hubs, Data registry, Atlas card links, Lab links, Science layer, report
app/frontend/phase4/ui_30_surprise.js  Surprise me, challenges, journal
app/frontend/phase4/i18n_85–89_v17_*.js  five languages
```

Dependencies on existing code (read only): `ENG.detail` / `simFor` (baseline engine), `jnCtx`, `xcOps`,
`xcSlopeShare`, `xtProcEval` (process rules), `dsfStep` and `dsaCard` (wrapped to add links), `viewDiscover`,
`viewData`, `paintField` / `setLayer` / `renderLegend` (wrapped for one new layer). The baseline engine file and all
protected files are untouched.

## 3. Feature cube (tai-v17-features-1.0.0)

Per valid 0.5° × 0.625° cell (76,781 cells), alongside the existing stack. Missing stays missing.

| Variable | Definition | Source | Evidence | Valid cells |
|---|---|---|---|---:|
| `freeze_months` | months with mean 2 m air temperature < 0 °C | NASA POWER T2M (MERRA-2) 2001–2020 | reanalysis | 76,781 |
| `ft_air_months` | months with mean daily minimum < 0 °C < mean daily maximum | POWER T2M_MIN/MAX | proxy for freeze–thaw crossings | 76,781 |
| `dry_months` | Bagnouls–Gaussen dry months, P (mm) < 2 T (°C) | POWER PRECTOTCORR, T2M | derived | 76,781 |
| `precip_cv` | coefficient of variation of the 12 monthly totals | POWER PRECTOTCORR | derived | 76,763 |
| `maat_below_zero` | mean annual air temperature < 0 °C | POWER T2M | proxy (permafrost-favourable climate) | 76,781 |
| `polar_night_months` | months with top-of-atmosphere insolation < 0.25 MJ m⁻² day⁻¹ | POWER TOA_SW_DWN (1°, by latitude) | geometry | 76,781 |
| `toa_annual_wm2` | annual mean top-of-atmosphere insolation | POWER TOA_SW_DWN | geometry | 76,781 |
| `lst_dr_iav_k` | interannual SD of the yearly MODIS LST diurnal range (≥ 5 of 10 years) | MODIS Aqua via GIBS 2016–2025 | derived | 76,768 |
| `lst_dr_years` | number of valid years behind `lst_dr_iav_k` | same | count | 76,781 |
| `aridity_class` | UNEP zones from P/PET (< 0.05, 0.2, 0.5, 0.65) | POWER P/PET (existing) | derived | 62,031 |
| `landform_class` | ASTERRO relief classes from cell relief (50 / 200 m) and elevation (500 / 2500 m) | GMTED2010 | derived, provisional | 76,781 |

Effective scale: every value is a cell statistic (~55 km); TOA insolation is a 1° latitude product. Temporal
coverage differs between POWER (2001–2020) and MODIS (2016–2025); the report discloses it.

## 4. Domain modules and validation plans

Each module is versioned separately and shows its inputs with the kind of evidence, completeness for the place,
what blocks the rest, its limits and its validation plan. A blocked module gives no value and no score.

| Module | Version | Status | Question | Inputs (kind) | Blocked by | Validation (implemented as tests) |
|---|---|---|---|---|---|---|
| Terrain and landforms | 1.0.0 | available | height, steepness, relief vs target | elevation (direct), slope, roughness, share ≤ 5° (derived), relief class (derived, provisional) | NASADEM, SRTM, Copernicus DEM, ASTER GDEM, HiRISE, SLDEM2015 | class boundaries reproduced; sub-cell product unchanged |
| Geology | 0.0.0 | blocked | rock units, settings | none | USGS SGMC, Macrostrat, GVP | gives no score |
| Mineralogy | 0.0.0 | blocked | spectral mineral-group signs | none | ASTER L2, MRDS, Landsat, Sentinel-2, CRISM | gives no score |
| Thermal environment | 1.0.0 | available | heating, cooling, year-to-year stability | LST day/night (direct, decoded), diurnal range, interannual SD (derived), air temperature (reanalysis) | MODIS HDF, VIIRS, ECOSTRESS, THEMIS, TES | SD missing below 5 years; values equal the stack |
| Sunlight and illumination | 1.0.0 | partial | top-of-atmosphere sunlight, polar night | TOA annual, polar-night months (geometry), noon Sun (geometry) | LOLA illumination | no polar night equatorward of 65°; tropics brightest |
| Water and ice | 1.0.0 | partial | dryness, rain seasonality, freezing | UNEP zone, dry months, rain CV (derived), freeze months (reanalysis), freeze–thaw and permafrost climate (proxy) | JRC GSW, MODIS snow, RGI, ESA CCI permafrost | zone missing where P/PET missing; 12 freezing months ⇒ MAAT < 0 |
| Dust and atmosphere | 0.0.0 | blocked | dust, wind | none (target side: MEDA pressure, measured) | MERRA-2 aerosol and wind, MODIS AOD, CALIPSO, ERA5 | gives no score |
| Biological context | 0.0.0 | blocked | life, vegetation | none | MODIS VI, GBIF, ESA WorldCover | gives no score; never infers extremophiles or biosignatures |
| Caves and subsurface | 0.1.0 | partial | caves, lava tubes, pits | Earth: none; Moon: catalogued Marius Hills Pit | cave inventories (not investigated) | no Earth cell carries a subsurface value |
| Exploration operations | 1.0.0 | available | which activities to rehearse | existing operation rules, share ≤ 5° | – | operation means equal `xcOps` |

For every module the plan records: scientific question, inputs and provenance (registry ids), preprocessing (in
`src/v17/features.py` and the Phase III/IV builders), spatial alignment (all on the 0.5° × 0.625° MERRA-2 grid; TOA
assigned by latitude), temporal alignment (climatologies, periods listed), units, algorithm, assumptions, uncertainty,
limitations, validation method, expected output and test cases (`modules.json`, `tests/test_v17.py`,
`tests/phase4/test_v17_engine.mjs`). Where no validation data exist the module is marked provisional; no module has
field validation.

**Safeguards enforced by tests.** Missing values are never zero (aridity zone, interannual SD, novelty); proxies are
labelled (freeze–thaw, permafrost climate); similarity is never shown without the not-a-probability statement; coarse
data are labelled with their scale; the temporal mismatch is disclosed in every report; physical quantities are never
compared across kinds (Earth air temperature is not compared with lunar surface temperature).

## 5. Novelty (tai-v17-novelty-1.0.0)

- **Rarity:** mean distance to the 16 most similar cells on Earth over the six baseline conditions (engine ranges),
  as a percentile.
- **Distance to listed sites:** great-circle distance to the nearest of the frequently cited analogue sites in
  `data/ext/known_analogues.json` (compiled from general knowledge; not a literature review).
- **Environmental difference from listed sites:** feature distance to the nearest listed site's own cell, percentile.
- **Gate:** a cell with any of the six conditions missing is "not enough data" and gets no component values.

Classes and counts: not enough data 14,750; near a listed site 1,431; elsewhere, like a listed site 29,940;
elsewhere, unlike listed sites 26,014; elsewhere and rare 4,646. Novelty is not importance and not a discovery claim.

## 6. Unsupervised patterns (tai-v17-ml-1.0.0)

Twelve standardised variables (six baseline conditions, LST day and night, mean air temperature, freeze months, dry
months, rain CV) over 62,013 complete cells.

- **k-means** (scikit-learn 1.9.1, n_init 10, random_state 0): k = 8 by silhouette (6: 0.305, 7: 0.318, **8: 0.323**,
  9: 0.289, 10: 0.290, 11: 0.286, 12: 0.287).
- **Interpretable baseline:** agreement with Köppen–Geiger main groups: adjusted Rand index 0.419, normalised mutual
  information 0.512 (30 classes: ARI 0.404, NMI 0.532). The groups resemble climate zones but also separate terrain
  and surface-temperature regimes.
- **Isolation forest** (300 trees, 4096 samples, random_state 0) against a nearest-neighbour rarity baseline:
  Spearman ρ = 0.608.
- **Hidden combinations:** 12 cells in the top 2 % of anomaly scores with every value within 2 SD of the mean.

The deterministic baseline engine is not replaced. Labels describe statistical groupings of coarse variables; they
do not identify landforms, rocks or ecosystems. Rebuilding with the same scikit-learn version reproduces the labels
exactly (tested).

## 7. Spatial diversity

The baseline 300 km rule is unchanged and remains the default. Novelty and diversity adds, for research workflows:
a custom minimum distance (100–3000 km), environmental variety (maximal marginal relevance over the six normalised
conditions; weight 1 reproduces the plain similarity order, tested) and one place per country.

## 8. Surprise me

Eleven modes; seven run on data, four say plainly that their data could not be acquired and name the sources:

| Mode | Rule (real data) |
|---|---|
| Unexpected Mars / Moon analogue | top 2 % for the target, > 300 km from and environmentally unlike every listed site |
| Unusual thermal environment | top 1 % LST diurnal range, away from listed sites |
| Unexpected polar environment | ≥ 2 months of polar night and ≥ 10 months below freezing, compared with a Moon target |
| Hidden combination | the 12 ML hidden-combination cells |
| Under-represented region | strong candidates with the fewest other strong candidates within 1,500 km |
| Strong in one condition only | exactly one condition with s ≥ 0.85, all others < 0.60 |
| Geology, water history, dust or wind, subsurface | unavailable: no data (no invented result) |

Draws are deterministic for a draw number and 300 km apart. Each card: what, where, target, why surprising (with
numbers), measurements, matches, mismatches, missing conditions, sources, reliability (coverage, direct/proxy count,
novelty components, ML group), what to investigate next, and three explanation levels.

**Game rules.** Points reward reading, not scores: naming the condition that differs most (checked against the
lowest similarity), reading what the score means, counting the target's proxies, downloading a reproduction record,
writing a research question. Each card can earn each point once. Seven discovery challenges are checked against the
data. Badges and five levels follow from points. Points and the journal live only in the browser and never change a
result (tested).

## 9. Explanations at three levels

Beginner (plain sentences), Scientific (measurements, coverage, evidence kinds, novelty, ML group, limits) and
Advanced (units, sources, target status per condition, missing conditions, reproduction record). Every sentence is a
template filled from the structured analysis; no language model is used.

## 10. Earth's limitations

`tai-v17-limits-1.0.0` lists gravity, atmospheric pressure, composition, radiation, dust, regolith, thermal
extremes, day length and life, with whether an Earth field site can reproduce each (no / partly). Mars pressure is
measured (Mars 2020 MEDA, 20 sols, 634.5–803.1 Pa medians, retained in the repository); gravity, composition and
day length are reference values transcribed from the NASA NSSDCA fact sheets (not re-retrieved: hosts unreachable);
the rest is descriptive and carries no numbers. Shown in Science domains and in every report.

## 11. Research report (20 sections)

Laboratory step 8 (and the Lab link from Surprise me) downloads a Markdown report with: title, question, target, Earth
analogue, coordinates, spatial scale, data sources, data versions (including the V17 document SHA-256), measurement
characteristics, method, results, similarities, differences, uncertainty, missing data, exploration relevance, Earth's
limitations, conclusion, reproduction record, references. Trace and Reproduce this result are unchanged.

## 12. Interface

- **Discover:** four new hub entries (Surprise me, Science domains, Novelty and diversity, Patterns) in the wide
  research layout.
- **Data:** the Data Integration Registry with every source's state, resolution and probe result.
- **Atlas:** the candidate card adds the novelty class and a Science domains button; on tablets and phones the card
  sits under the globe; a "Science" layer (11 variables) with legend, source, units, scale and limits; the legend
  moved to the right so the card never covers it.
- **Laboratory:** step 6 links to Science domains; step 8 adds the 20-section report.
- Explore and Research modes keep working: sources, validation notes and method details appear only in Research
  mode. All new strings in five languages (machine-assisted; not reviewed by native speakers). Method, limitation
  and validation notes inside modules are in English, and the page says so.

## 13. Compliance matrix (V17 requirements)

| Requirement | Feature | Dataset | Integration status | Method | Validation | Remaining limitation | Evidence |
|---|---|---|---|---|---|---|---|
| Audit and regression baseline | `scripts/v17_baseline.py` | repository | n/a | snapshot + diff | no differences | – | `data/v17/baseline.json` |
| Data ingestion architecture with metadata | registry, probe, sources | 55 sources | 16 integrated (12 validated, 4 incomplete), 38 endpoint unavailable, 1 not investigated | 8 explicit states | tests: no integration without checksums | network blocked | `public/data/v17/registry.json`, `data/v17/probe.json` |
| New Earth datasets (terrain, thermal, water, cryosphere, dust, vegetation, geology, caves) | – | – | **blocked** (0 of 47 endpoints reachable) | – | – | needs network and, for several, Earthdata credentials | DATA_REGISTRY.md |
| Richer Moon and Mars fingerprints | – | – | **blocked** | – | – | needs PDS / Trek access | DATA_REGISTRY.md |
| Environmental feature cube with metadata | feature cube | POWER, MODIS, GMTED (retained) | integrated (derived) | §3 | tests: rebuild identical, ranges, missing | cell scale only | `public/data/v17/cube.json` |
| Multi-resolution and temporal analysis | interannual SD, monthly indicators, scale labels | POWER, MODIS | partial | §3 | tests | no sub-cell data beyond Phase III slope shares | §3 |
| Domain modules with evidence and limits | 10 modules | as §4 | 3 available, 3 partial, 4 blocked | §4 | tests per module | 4 blocked by access | `modules.json` |
| Objective-specific profiles | existing 7 baseline profiles + 13 extended profiles (Phase IV: 5 available, 8 listed as unavailable with what they need) | – | unchanged | – | existing tests | the geology, dust, resource, subsurface, lava-tube, ice, sampling and human-factors profiles stay unavailable: their key data are missing | `data/ext/profiles_ext.json` |
| Separate similarity from operational relevance | five separate measures | engine, operations, processes | implemented | side by side, never combined | browser test | – | Science domains |
| Process discovery | existing 17 processes; process relevance per place | existing | unchanged + linked | existing rules | existing tests | – | Processes hub |
| Global discovery beyond famous sites | novelty, Surprise me, diversity | stack | implemented | §5, §7, §8 | tests | listed sites from general knowledge | §5 |
| Novelty indicator not driven by missing data | novelty gate | stack | implemented | §5 | tests | not importance | tests |
| Spatial diversity alternatives | 3 methods | – | implemented | §7 | tests | – | Novelty hub |
| Surprise me with modes, cards, challenges, gamification | Surprise me | V17 products | implemented (7 data modes, 4 unavailable) | §8 | tests | 4 modes need data | `ui_30_surprise.js` |
| Explanations at three levels | cards | – | implemented | templates | browser test | – | §9 |
| Exploration relevance per analogue | operations, report §16 | existing rules | implemented | existing | existing tests | not mission readiness | report |
| Earth's limitations explicit | limitations framework | MEDA (measured) + references | implemented | §10 | tests | reference constants transcribed | `limits.json` |
| Workflow and Explore/Research modes preserved | Lab links | – | preserved | – | V15 suites pass | – | TEST_REPORT.md |
| Atlas layers with legend, source, units, resolution, period, limits | Science layer | V17 cube | implemented | §12 | browser test | coarse scale | Atlas |
| Reports with 20 sections and reproducibility | research report | – | implemented | §11 | tests | – | Lab step 8 |
| Accessibility, five languages | all new views | – | implemented | – | audits, contrast sweep | translations not native-reviewed | TEST_REPORT.md |
| Machine learning only with value, compared with baselines | patterns | stack + cube | implemented | §6 | tests | statistical groups only | §6 |
| Performance | precomputed products, typed arrays, lazy decoding | – | implemented | – | render and draw times measured (TEST_REPORT.md) | page grew from 3.7 MB to 5.8 MB | TEST_REPORT.md |

## 14. Implementation status

| Requirement | Status |
|---|---|
| Baseline, dependency map, preservation | Implemented and validated |
| Data Integration Registry (8 states, probe) | Implemented and validated |
| Acquiring new NASA and other agency datasets (all §3 and §4 categories) | Blocked by access (egress proxy refused every provider; registries unreachable) |
| Feature cube from retained data | Implemented and validated (internal checks; no external validation data) |
| Terrain, thermal, illumination, water-and-ice modules | Implemented but awaiting validation (no field or independent reference data) |
| Geology, mineralogy, dust and atmosphere, biology modules | Blocked by access |
| Caves and subsurface registry | Partially implemented (planetary catalogue entry only; Earth inventory not investigated) |
| Multi-resolution analysis | Partially implemented (cell scale plus Phase III sub-cell slope shares) |
| Temporal fusion | Partially implemented (monthly climatology indicators, MODIS interannual variability) |
| Novelty indicator, spatial diversity | Implemented and validated (deterministic tests) |
| Unsupervised learning with interpretable baselines | Implemented and validated (reproducible; compared with Köppen–Geiger and kNN rarity) |
| Surprise me (data modes, cards, challenges, journal, gamification rules) | Implemented and validated; 4 modes blocked by access |
| Three-level explanations | Implemented and validated |
| Earth limitations framework | Implemented; reference constants transcribed, not re-retrieved |
| 20-section report | Implemented and validated |
| Science globe layer | Implemented and validated |
| New objective-specific profiles (geology, mineralogy, dust, ice, caves, astrobiology, resources) | Not implemented: each depends on blocked data. Eight such profiles already exist in Phase IV as "unavailable" with what they need, rather than being approximated |
| Richer lunar and Martian fingerprints (craters, illumination, mineralogy, dust) | Blocked by access |
| Native-speaker review of translations | Not done |
