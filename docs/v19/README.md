# ASTERRO V19: Planetary Intelligence Frontier

"Find Earth's environmental analogues for worlds beyond Earth."

V19 adds a modular planetary-intelligence layer around the unchanged engine (`tai-sim-1.0.0`):

- sixteen independently versioned science domains;
- nine analytical measures kept separate;
- a "why this candidate ranked" interpretation;
- fourteen objective profiles gated by data;
- the most important physical differences for each analogue;
- validation of the V17 machine-learning patterns;
- a nine-state Data Integration Registry with per-dataset access diagnostics and an acquisition catalogue;
- **the first new datasets since V17**: geological map units (Macrostrat), Holocene volcanoes (Smithsonian Global Volcanism Program) and biological records (GBIF) at 16 analysed cells, with an Earth–Moon–Mars material-evidence view.

**What limits the release.** This build environment's own network still refuses every data provider (egress policy 403; PyPI and npm do not resolve). The allowed-domains change requested earlier in the session never reached it. A second, official route was found: the WebFetch service, which reaches public APIs. Through it, three providers answered: Macrostrat, the Smithsonian GVP WFS and GBIF. NASA POWER and SoilGrids refuse that service in their robots.txt, and Wikidata's SPARQL URLs exceed its length limit. That route returns *structured transcriptions* of each response, not files, and it is one request at a time. So V19 holds a **sample of 16 cells, not coverage**, and its sources are "integrated, awaiting full validation". Nothing global was acquired, and no wind, aerosol, mineral, soil, land-cover, water, glacier, permafrost or cave data exist in ASTERRO.

## 1. Baseline (Phase 1)

`docs/v19/BASELINE.md` and `data/v19/baseline.json` (`scripts/v19_baseline.py cab7a0c`) record what V19 must preserve:

- the engine configuration and the 79 protected files;
- the reference results and the stack hash;
- the V17 products, the V17 registry and the V18 Local Impact engine;
- the rendered tabs and the test totals.

After V19 the script still reports **no differences** (`--check` mode is part of the Python suite).

## 2. Data access (Phase 2)

| Step | Result |
|---|---|
| Probe of 30 official primary and alternative routes from the build environment (APIs, DAACs, PDS nodes, AWS/Google open-data buckets, Planetary Computer, Earth Search, CMR-STAC) | all refused by this environment (`CONNECT tunnel failed, response 403`); re-checked at the start of this pass: unchanged |
| Per-dataset diagnostics (`scripts/probe_v19.py`): 63 route attempts over 71 datasets | 63 `env_policy`; 0 provider answers |
| User-assisted route | the user agreed to allow 18 public provider domains; the change never reached this session. The user's computer (its shell and the desktop browser) was not connected during the first pass and did not respond during the second, and the user chose to finish V19 in the cloud |
| **Second route: WebFetch service** | Macrostrat, Smithsonian GVP (WFS 2.0) and GBIF answered (HTTP 200). NASA POWER and SoilGrids: `robots_disallowed`. Wikidata SPARQL: URL too long, and a shortened query returned `url_not_found`. These refusals are recorded per dataset (`data/v19/fetch_attempts.json`) and say nothing about the providers |
| Global Holocene volcano layer (GVP), same route, 2026-11-10 | The provider answered: 1,214 Holocene volcanoes (WFS `numberMatched`, layer time stamp 2026-10-12) with 20 attributes. A full copy could not be retained. A zipped shapefile returned HTTP 200 as binary, but the fetch service saved no file. `startIndex` paging returned a client error. Adding `sortBy` or a field list pushed URLs past the service's length limit (≈ 250 characters). The service restates rather than copies this site's responses (125-character quote limit), so 1,214 records would be unverifiable transcriptions. **Not acquired.** Recorded here; the registry state for GVP is unchanged (16-cell sample) |
| Registry (`src/v19/registry.py`) | nine states; each dataset judged on its own routes; the V17 rows for Macrostrat, GVP and GBIF point to the V19 acquisitions |
| Catalogue (`src/v19/catalogue.py`) | 15 candidates with every field of §3.1. `doc_status`: `verified_retained` (POWER route, proven by retained data), `verified_response` (Macrostrat, GVP, GBIF: route, field names and licence confirmed by the providers' responses), `unverified` (the rest) |
| Acquisition (`src/v19/acquire_power.py`) | NASA POWER wind pipeline on the proven route. **Not run**: both routes are refused |

Registry counts:

- 12 integrated and validated;
- 10 integrated, awaiting full validation (the 4 from V17, Macrostrat, GVP and GBIF, and their 3 V17 rows);
- 48 access blocked;
- 1 not investigated.

Full list: `docs/v19/DATASETS.md`.

### 2.1 Site samples (`src/v19/samples.py`, `public/data/v19/site_samples.json`)

**Cells.** The 10 top distinct candidates for Jezero Crater, the 5 for the Lunar South Pole (General analogue, default weights), and the V18 Atacama example cell 76787.

**Queries per cell, at its own centre:**

- Macrostrat `geologic_units/map`: map units, lithology, age range, map scale, source map.
- GVP `Smithsonian_VOTW_Holocene_Volcanoes` in a box enclosing a 100 km radius. Volcanoes are kept within 100 km of the cell centre by great-circle distance.
- GBIF occurrence counts inside the cell: all records, Archaea and Bacteria. Up to 3 Archaea records are kept, with their dataset's title, licence and DOI.

**Retained:** `data/v19/samples/requests.json` (exact URLs), `data/v19/samples/site_samples_raw.json` (transcribed values) and the product. Their SHA-256 hashes are in the acquisition manifests (`data/v19/acquired/*.json`).

**Validation.** The build stops if any check fails:

- every volcano lies inside the box that returned it;
- every map unit has top age ≤ base age;
- every listed record lies inside its cell;
- counts are non-negative integers;
- listed records never exceed the count;
- repeat fetches agree:
  - the Atacama Macrostrat units, 3 fetches;
  - the Atacama GBIF counts, 2 fetches;
  - the Atacama volcanoes, 2 fetches with different boxes;
  - volcanoes returned for two different sites, with identical attributes.

A test also proves that a corrupted transcription is rejected.

**Open questions:**

- 16 cells are a sample, not coverage.
- Values are transcriptions, not byte-verified files.
- Map units at 1:5M ("small") or coarser ("tiny") are regional classes, not field observations.

**Totals:** 25 map units, 39 Holocene volcanoes, 16 cells of record counts, and 6 Archaea records with dataset metadata.

## 3. Architecture

| Domain | Version | State | Inputs held | Waiting for |
|---|---|---|---|---|
| Terrain and geomorphology | 1.0.0 | partial | elevation, slope, roughness, share ≤ 5°, relief class | NASADEM, SRTM, Copernicus DEM, ASTER GDEM |
| Geology | 0.2.0 | **sampled at 16 cells**, "not sampled" elsewhere | Macrostrat units, GVP volcanoes ≤ 100 km | USGS SGMC; Mars/Moon USGS maps; coverage of all cells |
| Mineralogy | 0.1.0 | waiting for data | – | ASTER L2, MRDS, Landsat, Sentinel-2; CRISM |
| Surface materials | 0.1.0 | waiting for data | – | ESA WorldCover, SoilGrids |
| Thermal environment | 1.0.0 | partial | LST day/night, diurnal range, interannual SD | MODIS HDF, VIIRS, ECOSTRESS |
| Solar illumination | 1.0.0 | available | TOA insolation, polar-night months | (Moon: LOLA illumination) |
| Hydrology and water history | 1.0.0 | partial | rainfall, P/PET, UNEP zone, dry months, seasonality | JRC Global Surface Water |
| Cryosphere and ice | 1.0.0 | partial | freeze months, freeze–thaw (proxy), surface freeze–thaw (proxy) | MODIS snow, RGI 7, ESA CCI permafrost |
| Atmospheric environment | 1.0.0 | partial | air temperature, annual range (reanalysis) | POWER wind, ERA5, MERRA-2, MCS |
| Dust and aeolian processes | 0.1.0 | waiting for data | – | POWER wind, GIBS AOD, MERRA-2 aerosol, CALIPSO |
| Biology and astrobiology | 0.2.0 | **sampled at 16 cells**, "not sampled" elsewhere | GBIF record counts and Archaea records | MODIS vegetation, WorldCover; coverage of all cells |
| Caves and subsurface | 0.2.0 | waiting for data | – | Wikidata caves (fetch refused), cave inventories |
| Processes | 1.0.0 | partial | conditions: freeze–thaw, thermal swing, aridity, dry months | JRC GSW, POWER wind |
| Robotic operations | 1.0.0 | available | existing operation rules | – |
| Human operations | 1.0.0 | available | existing operation rules | – |
| Resources and infrastructure | 0.1.0 | waiting for data | – | MRDS, ASTER L2, permafrost (map units alone are not resource evidence) |

Rules (engine `tai-v19-domains-1.1.0`, tests `tests/phase4/test_v19_engine.mjs`, `tests/test_v19.py`, `tests/phase4/ui_v19_smoke.py`):

- **No value without data.**
- **Site-sample evidence only where sampled.** Geology and biology show evidence only at the 16 sampled cells. Elsewhere they say "not sampled", never a zero or a guess. A domain with no per-cell input stays blocked even if one of its sources is integrated but unused (resources).
- **Missing stays missing**, and every value carries its evidence kind, dataset, resolution and period.

**Nine separate measures, never combined:**

- environmental similarity (the engine's score);
- geological relevance: *shown, never scored*. Map units and volcanoes are listed where sampled; "not sampled" otherwise;
- mineralogical relevance: not assessed, no data;
- process relevance and operational relevance (V17 definitions);
- data completeness;
- evidence strength;
- novelty (V17 rarity);
- spatial diversity.

**Material evidence (Earth–Moon–Mars).** At a sampled cell, the Earth map classes and the volcano count are listed beside published observations of the target:

- Jezero:
  - CRISM orbital detection of Fe/Mg smectite in the delta (Ehlmann et al. 2008);
  - Perseverance's finding of aqueously altered igneous rocks on the crater floor (Farley et al. 2022).
- Lunar South Pole:
  - M3 detection of surface-exposed water ice in permanently shadowed areas (Li et al. 2018);
  - the existence of the USGS 1:5M unified geologic map (Fortezzo et al. 2020; not acquired).

Each item is labelled with its evidence class. **No similarity is computed**, because a regional map class and an orbital spectrum are different kinds of measurement. The citations were located on 2026-11-10 (bibliographic records only; the papers' contents were not re-read).

**Fourteen objective profiles.** A profile is evaluated only where every domain it needs has data:

- At an unsampled cell, 6 can be evaluated, as in V19.0.
- At a sampled cell, geological fieldwork and astrobiology field research can also be evaluated. They point to the sampled evidence and add no score.
- Operations without data are not listed as assessed.

**Placement.** No new top-level tab:

- Discover › Science domains, which adds the material evidence;
- Discover › Patterns;
- Local Impact: domains, material evidence and objectives before the report. The V18 "volcanoes not shown" note gains the V19 count at a sampled cell;
- Data (V19 registry).

## 4. Machine-learning validation (`src/v19/mlval.py`, `data/v19/ml_validation.json`)

Unchanged from the first V19 pass. The V17 models are unsupervised, so no accuracy is claimed. Results on the 62,013 complete cells:

| Test | Result |
|---|---|
| k-means (k = 8), seeds 1–5 | adjusted Rand index vs seed 0: 0.987–1.000 |
| Isolation forest, seeds 1–5 | Spearman ≥ 0.976; top-2 % Jaccard 0.87–0.89 |
| Feature ablation (12 features) | the top 2 % changes most without elevation (0.68), roughness (0.72) and slope (0.73) |
| Geographic bias of the top 2 % | 30° S–0°: × 1.85; 30–60° N: × 1.51; 60–90° N: × 0.13; 90–60° S: × 0.48 |
| Hidden-combination persistence | 5 of 12 stay in the top 2 % under all 5 other seeds, 2 under none |
| Missing data | incomplete cells have no label and no anomaly score; 0 cells with a missing rarity criterion are scored |

## 5. Scientific examples (only where evidence exists)

| Example | Evidence | Status |
|---|---|---|
| **Geological analogue** | Altiplano, Bolivia (cell 77940, the top Jezero candidate, 85.0 %). Macrostrat lists Quaternary siliciclastic deposits (Geological Map of South America 2018, 1:5M) over Cenozoic intermediate–felsic volcanic rocks (Chorlton 2007, world scale). There are 8 Holocene volcanoes within 100 km, the nearest Putana at 37 km (last eruption 1810). Beside it, Jezero's orbital and rover observations: smectite clay in the delta, and altered igneous floor rocks | Reproducible in Discover › Science domains. *Shown, not compared*: there is no geological similarity score |
| **Geology across similar scores** | The top 10 Jezero candidates score 79.7–85.0 %, yet: 4 of the 5 Andean candidates have young volcanic or siliciclastic units (1:5M) and 5–8 Holocene volcanoes within 100 km (the Andes cell at 28.5° S has none). The 5 Central Asian candidates have older units, mapped only at world scale (four Paleozoic or Mesozoic sedimentary, one Cretaceous–Tertiary volcanic), and no Holocene volcano within 100 km | Shows why geology is kept separate from environmental similarity |
| Mineralogical comparison | Earth: map lithology classes only. Mars: CRISM smectite (orbital). Not equivalent measurements | **Not possible** as a comparison: no Earth spectral data |
| Thermal comparison | Atacama cell 76787: MODIS LST diurnal range 35.3 K vs Jezero 75.9 K (s = 0.51, different) | Reproducible (V18) |
| Water or ice comparison | Earth side only (freeze months, freeze–thaw proxies). Lunar side: M3 surface-ice detection (literature). Not comparable | Partial |
| Atmospheric or dust comparison | – | **Not possible**: POWER wind refused on both routes |
| **Local location comparison** | Atacama cell 76787 (position from the device): 78.6 % similar to Jezero, rank 182. Map units: Neogene–Quaternary siliciclastic (1:5M). 15 Holocene volcanoes within 100 km (nearest Cerro Tujle maar 41 km, Lascar 43 km). GBIF has 9,994 records in the cell, 44 of them Archaea, all from *Metagenomics of Brava and Tebenquiche lakes microbial mats* (2013 samples; CC BY 4.0; doi 10.15468/uft5fu): hypersaline-lake microbial mats, a documented astrobiology research setting. Presence records only: they say nothing about habitability | Reproducible in Local Impact |
| Unexpected multivariate pattern | Northern Ellesmere Island cluster (V17 isolation forest, stable under all seeds) | A pattern for inspection, **not a discovery** |
| Record pattern for inspection | Lunar South Pole candidate #3 (Kunlun Mountains, cell 146728): 47 Archaea records, including haloalkaliphilic genera (*Halalkalicoccus*, *Natronorubrum*, *Halogranum*) from INSDC environmental sequences (2022). Their coordinates are given in whole degrees (37° N, 85° E), so the sampling place is imprecise and flagged | A lead for inspection, **not a discovery** |

## 6. Challenge compliance (changes since `docs/phase4/CHALLENGE_COMPLIANCE.md`)

| Requirement | V19 feature | Data | Method | Evidence | Status | Remaining limitation |
|---|---|---|---|---|---|---|
| Use open NASA and other agency data | nine-state registry, catalogue, per-route diagnostics on two routes | 16 V17 sources plus Macrostrat, GVP and GBIF samples | explicit states from probes, fetch attempts and hashed manifests | `public/data/v19/registry.json`, tests | implemented and tested | no new NASA dataset acquired (POWER refused on both routes) |
| Explain what makes a place analogous / where it breaks down | why-it-ranked, physical differences, geology shown separately | engine, V17 limits, site samples | engine thresholds | `ui_v19_smoke.py` | implemented and tested | – |
| Similarity metrics and ML | nine separate measures; ML validation | engine, V17 patterns | stability, ablation, bias, missing-data checks | `ml_validation.json`, `test_v19.py` | implemented and tested | unsupervised: no accuracy possible |
| Geology | map units and Holocene volcanoes at 16 cells | Macrostrat, GVP | point queries, box and age checks, repeat-fetch agreement | `site_samples.json`, tests | implemented, **awaiting full validation** | 16 cells; transcribed values; regional map scale |
| Mineralogy, surface materials | material evidence side by side (literature), no score | literature (located citations) | evidence classes | tests | partial | no Earth spectral, soil or land-cover data |
| Dust, wind, aerosols | domain defined; POWER pipeline written | – | – | `acquire_power.py` | **not implemented (dependency)** | POWER refused on both routes |
| Water, ice | hydrology and cryosphere (proxies labelled) | POWER, MODIS (retained) | existing indicators | domain tables | indirect indicator | JRC GSW, snow, glaciers, permafrost |
| Biology | GBIF record counts and Archaea records at 16 cells | GBIF | counts and records inside cells, dataset metadata | `site_samples.json`, tests | implemented, **awaiting full validation** | sampling bias; presence ≠ habitability; 16 cells |
| Caves | domain defined, gated | – | – | – | **not implemented (dependency)** | Wikidata refused on the fetch route |
| Exploration applications | operation domains, objective profiles (two more at sampled cells) | existing rules, site samples | gated profiles | tests | implemented and tested | metre-scale hazards out of scope |

## 7. Regression

See `docs/v19/TEST_REPORT.md`.

## 8. Final implementation status

| Category | Items |
|---|---|
| Implemented and validated (tests pass) | baseline and check; nine-state registry; per-route diagnostics on two routes; acquisition catalogue; sixteen-domain architecture with gating; nine separate measures; candidate interpretation; objective profiles; physical differences; ML stability/sensitivity/bias/missing-data validation; Local Impact domains section; five languages |
| Implemented, awaiting full validation | geology (Macrostrat, GVP) and biology (GBIF) at 16 sampled cells; material-evidence view; POWER acquisition pipeline (written, not run) |
| Partially implemented | terrain, thermal, hydrology, cryosphere, atmosphere and process domains (retained data only); multi-resolution analysis (cell scale only) |
| Blocked by access | global coverage of geology and biology; wind and aerosols (POWER refused on both routes); soils (SoilGrids refused); caves (Wikidata refused); minerals, land cover, surface water, glaciers, permafrost, Mars/Moon geological maps, MCS, CRISM (environment refusal) |
| Not implemented | spatial tiling, raster pyramids and COG/STAC ingestion (nothing to ingest, no geospatial libraries installable); new Surprise me modes for geology, water, atmosphere and subsurface (16 cells are too few for a fair discovery mode); the brief's report extension (the V17 20-section and V18 14-section reports are unchanged) |

**What would unlock the rest.**

- Run ASTERRO's build in an environment that reaches the providers. Either the allowed domains apply to a *new* session, or the scripts run on a computer with open network.
- Then:
  1. `src/v19/acquire_power.py`: wind.
  2. A Macrostrat, GVP and GBIF pass over all land cells, with polite rate limiting.
  3. NASA Earthdata Login for MERRA-2 aerosols, MODIS snow and vegetation. The credential stays on the user's side.

ASTERRO is not claimed to be complete against the V19 brief. No NASA endorsement, approval or scientific validation is claimed.
