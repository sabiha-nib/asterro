# Phase IV — Methods

Phase IV adds a canonical registry, a readiness model computed from explicit checks, versioned
scoring configurations, and research modules over them. It changes none of the baseline
behaviour. The baseline formula, coverage rule, tie-break, distinct-site rule, legacy targets,
legacy normalisation table and the cross-planet minimum are all unchanged.

## 1. Record types (`asterro.registry/1`, schema 1.0.0)

| Type | Meaning | Can carry a score? |
|---|---|---|
| `body` | Mars, Moon | no |
| `region` | ASTERRO grouping of locations on one body (`region:*`) | no |
| `catalog_location` | Named feature or study site. Name, centre coordinate and extent come from the IAU/USGS gazetteer, or from a cited mission / LROC source | only through a target |
| `reference_area` | Area defined by ASTERRO, with a written definition (the two 55.6 km polar windows) | only through a target |
| `analytical_target` | 55.6 km analysis window with a fingerprint; refers to exactly one location | yes, by readiness |
| `dataset` | Data product: provider, product, version, URL, licence, resolution, processing, retrieval status | — |
| `scoring_config` | Versioned criteria policy and normalisation strategy | — |
| `earth_search_config` | Earth predictor stack and its SHA-256 | — |
| `comparison_experiment` | Defined multi-target comparison, e.g. the legacy cross-planet experiment | — |

There is one source of truth for each kind of fact:

- **`data/registry/catalog.json`** (hand-curated, holds no numbers): bodies, regions, membership,
  aliases and missions.
- **`data/raw/phase4/gazetteer_catalog.json`** (pipeline export): names, coordinates, types and
  quadrangles.
- **`src/phase3/target_catalog.py`**: window definitions.
- **Pipeline outputs:** the fingerprints.

`scripts/build_phase3_data.py` then calls `src/registry/build.py`. That generates
`public/data/registry.json`, writes readiness 3.0.0 into `public/data/phase3/atlas.json`, and records
the registry's SHA-256 inside the atlas. The browser refuses a registry whose hash differs.

**Schema validation.** `src/registry/schema.py` rejects any of the following:

- **Identifiers:** a duplicate or invalid id.
- **Coordinates and values:**
  - a coordinate that is out of range or non-finite;
  - a DIRECT or PROXY value that is non-finite;
  - a value attached to an N/A or MISSING criterion.
- **Statuses and units:**
  - a status outside DIRECT / PROXY / N/A / MISSING;
  - an invalid unit.
- **Provenance:**
  - a DIRECT value with no provenance;
  - provenance that names an unknown dataset.
- **Readiness:**
  - a readiness level that does not follow from the record's checks;
  - Earth-analogue scoring enabled below L3, or with fewer than three DIRECT criteria, or with no
    processing metadata;
  - a catalogue-only location that is not L1 (catalogued).
- **Comparisons:** a comparison experiment with an invalid aggregate, with no shared DIRECT
  criterion, or with a target that is not scoring-enabled.
- **Datasets:** a dataset with no provider, product, URL or licence.

The build aborts if validation fails.

## 2. Readiness model 3.0.0 (`src/registry/readiness.py`)

The model has four levels, matching the Phase IV brief. They are cumulative: a record is at the
highest level L for which every check at level L and below passes. A record that fails a level-1
check is invalid and is refused by the schema.

| Level | Check | Requirement |
|---|---|---|
| **1 · Catalogued** | `L1.name_source` | Name or definition backed by a cited source (gazetteer feature link, mission coordinate source, LROC atlas, or a documented ASTERRO definition) |
| | `L1.coordinates` | Finite, in range |
| | `L1.hierarchy` | Body and documented region |
| **2 · Partially characterized** | `L2.dataset_record` | Complete dataset record (id, provider, product, version, URL, licence, resolution, processing, retrieval status) |
| | `L2.measured_window` | All 3600 bins of 926.6 m filled; grid SHA-256 recorded; slope and roughness DIRECT |
| **3 · Analytically comparable** | `L3.no_missing_applicable` | No applicable criterion MISSING |
| | `L3.three_direct` | At least three DIRECT criteria |
| | `L3.values_units_provenance` | Finite values, valid units, datasets named for every DIRECT value |
| | `L3.compatibility` | Every DIRECT criterion has an accepted compatibility verdict |
| **4 · Reproducible** | `L4.versioned_fingerprint` | Fingerprint version and content SHA-256 (over variables, units and statuses) |
| | `L4.processing_documented` | Every producing script recorded with its SHA-256 |
| | `L4.offline_regeneration` | Every DIRECT value regenerated **offline** from retained inputs at build time, within tolerance |

A name, a photograph or a dataset link never raises a level on its own. A dataset counts only when
it has been processed into a complete, checksummed measurement window.

**Effect of each level on analysis.**

| Level | What it allows |
|---|---|
| L1 | Never ranked; every analytical action is disabled with its reason |
| L2 | Exploratory partial comparison on DIRECT criteria only, labelled partial |
| L3+ | Full comparison, Explore, the Validation workspace, Scenario Lab and multi-target aggregates |

Readiness says nothing about scientific validity, confidence, habitability or landing safety.

**Model history.**

- **Phase III v1:** L1–L4 by counting DIRECT criteria. It is kept in `atlas.json` as `readiness_v1`.
- **2.0.0 (transitional, never released):** levels 0–4.
- **3.0.0:** adopts the four-level scale. It merges the former terrain level and the former
  "one environmental measurement" level into level 2, and keeps every L3/L4 check unchanged.

The level-3 and level-4 assignments are identical under every version. The ranking thresholds of
model 3.0.0 equal those of v1 (L1 none, L2 partial, L3+ full), so no Phase III result changes.

**Offline regeneration** (`src/registry/verify.py`) recomputes values from inputs retained in the
repository. The inputs and tolerances are:

| Source | What is recomputed | Tolerance |
|---|---|---|
| Terrain | Window mean slope and elevation standard deviation, from the checksummed 926.6 m grids | slope 1e-5°; roughness 1e-3 m |
| MSL REMS | Unchanged baseline `aggregate()` over the 306 retained per-sol files | 1e-9 K |
| Mars 2020 MEDA (legacy Jezero) | Same aggregate over the retained per-sol records | — |
| Diviner polar | Window selection re-derived from the retained grid coordinates and compared with the retained index set, then the seasonal means recomputed | 1e-6 K |
| Diviner GCP | Every retained HTTP range read checked against its SHA-256 and re-parsed, then the means recomputed | 1e-6 K |

Legacy targets are compared against the values in `targets.json`, which are rounded. Their
tolerance is the rounding tolerance: 5e-4, or 5e-2 m for roughness.

A regeneration either matches or fails, and it never patches a value. With an input missing, the
regeneration reports which input, and the target drops to L3; this is tested.

**Result (registry 1.0.0).**

| Readiness | Count | Targets or locations |
|---|---|---|
| L4 | 16 targets | Jezero, Gale / Curiosity and 14 Moon windows |
| L3 | 0 | — |
| L2 | 17 targets | 16 terrain-only Mars windows and Reiner Gamma (no valid Diviner GCP bins) |
| L1 | 38 of 69 locations | Catalogued only |

## 3. Scoring configurations

| Id | Criteria | Normalisation | Use |
|---|---|---|---|
| `legacy-baseline-v1` | DIRECT + PROXY of each target | Legacy table (`app.json`) | Jezero, South Pole, cross-planet: unchanged |
| `explore-target-v1` | DIRECT + PROXY | [min, max] over valid Earth cells ∪ this target | L3+ registry targets in Explore |
| `atlas-direct-v1` | DIRECT only | Earth ∪ this target | Atlas default and Comparison Lab aggregates |
| `atlas-catalogue-v1` | DIRECT only | Earth ∪ every atlas target (atlas-norm-1) | Counterfactual alternative |

**How the browser uses `explore-target-v1`.**

- **Range check before registration.** The browser recomputes the ranges from the stack and
  registers a target only when they equal the registry's ranges exactly.
- **Legacy targets.** Jezero and the South Pole are always computed with the legacy table: the
  wrappers in `ui_08_explore.js` set it around every baseline call for those targets.
- **Where registry targets are added.** They are added to `S.T` only, never to `S.targets` or
  `TARGET_IDS`, so the cross-planet experiment cannot change.
- **Phase II laboratory.** The laboratory depends on legacy-only reference data. For a registry
  target it shows a notice instead of results.
- **Exported records.** A record exported from Explore names its configuration and fingerprint
  hash. `scripts/reproduce_registry.py` (new; the protected baseline `scripts/reproduce.py` is
  unchanged) checks the ranges and the fingerprint hash against the registry and reproduces the score,
  rank and top-3 sites bit for bit.

## 4. Comparison Lab

`RG.compatibility` classifies each criterion across the selected targets into one of four classes:

- shared DIRECT;
- PROXY involved;
- N/A for some target;
- MISSING for some target.

For shared DIRECT criteria it also flags different source products, different spatial support and
different temporal support.

**Aggregates** are computed by `RG.aggregate`:

| Aggregate | What it returns |
|---|---|
| Minimum | Any ineligible target gives −1; otherwise the minimum of the per-target effective scores |
| Mean | The labelled arithmetic mean |
| Pareto | Cells non-dominated on every target's score; no winner is claimed |
| Per-criterion | The minimum of the criterion similarity over the targets, one field per criterion; no cross-criterion sum |

**When an aggregate is blocked.**

- When the targets share no DIRECT criterion.
- For an unsupported aggregate.
- For an L1 (catalogued-only) target.

Otherwise each target is scored on the **shared DIRECT criteria only**, with its own Earth ∪ target
ranges, and the excluded criteria are listed.

**The legacy pair.** Jezero + South Pole + minimum runs `legacy-baseline-v1`, in which each target
uses its own DIRECT + PROXY criteria with the legacy table. It is regression-tested bit for bit
against the baseline cross-planet field and distinct sites, in Node and in the browser.

## 5. Validation workspace

**Reference cases.** These are entered by a researcher; none ship with ASTERRO. Each case needs:

- a name;
- a positive or negative label;
- a coordinate on a valid Earth land cell;
- a citation.

Synthetic fixtures are rejected.

**Metrics.**

- **Rank:** the baseline tie-break over eligible cells, plus a percentile.
- **Recall@k:** computed only with at least 5 cited positive cases.
- **Labelled precision@k:** computed over **labelled** cases only, never over unlabelled cells, and
  only with at least 5 positive and 5 negative cases.
- **Weight sensitivity:** every active weight × {0.5, 2}; the ranks of every case are re-evaluated.
- **Holdout:** declared not meaningful. The score has no parameters fitted to labels, so a split
  would test nothing. It becomes required if weights are ever fitted.

**Evaluation records** (`asterro.validation/1`) state explicitly that they are not claims of
validation. A record containing synthetic cases is labelled "TEST FIXTURE".

## 6. Mismatch Explorer

The classes are deterministic, applied in this order:

1. **N/A** → incompatible.
2. **MISSING** → missing (target).
3. **PROXY** → proxy excluded (unless proxies are included).
4. **Weight 0** → excluded.
5. **No Earth value** → missing (Earth).
6. **Otherwise, by s:**
   - s ≥ 0.85 → agreement;
   - s ≥ 0.60 → partial;
   - below 0.60 → mismatch.

For an included PROXY, the class is "proxy" rather than one of the s-based classes.

Each criterion row states the target's spatial and temporal support and the size of the Earth
cell. A rover point measurement compared with a cell mean is flagged as a scale difference.

## 6b. Scenario Lab (`asterro.scenario-set/1`)

A scenario set has 1–4 scenarios for one L2+ target. Each scenario is defined by:

- weights: a profile or custom values in [0, 5];
- whether proxies are included;
- a normalisation rule: Earth ∪ target (default), or Earth only, where the target is clipped.

**Computation.** Every scenario runs through `AsterroLab.prepare` / `fieldScore`, the baseline
formula, coverage rule and tie-break. The first scenario's field is tested to be bitwise equal to
the Phase III atlas default.

**Outputs.**

- **Distinct sites:** the top 20 per scenario.
- **Ranks:** for every cell in the union of the scenarios' top 10, its rank under each scenario.
- **Robust candidates:** cells with rank ≤ 100 in every scenario.
- **Contribution breakdown:** k_c = w_c·s_c / Σw, for a chosen cell.

**The exported set records**, for each scenario:

- the target vector, the ranges and the active criteria;
- the expected sites, with scores to 1e-12.

It also records the fingerprint hash, registry version and stack hash.

**Replay.**

- `RG.replayScenarios` replays a set in the browser.
- `scripts/replay_scenario.py` replays it with the Python reference engine. Exit codes: 0
  reproduced, 1 not reproduced, 2 cannot replay.
- A tampered weight is detected.

**Interpretation.** These results describe how sensitive the ranking is to analytical choices. They
are not uncertainty about the environment.

## 6c. Expedition objectives

Eight research objectives map, by a fixed table, to one of the existing editorial weighting
profiles and to a list of key criteria. Each objective also has a set of research questions. For
the selected target, the view states whether each key criterion is measured (DIRECT) there.

Geological fieldwork and surface planning use equal weights, because ASTERRO models no geology. The
objective is written into the exported expedition design.

None of this is a safety, access or suitability assessment.

## 7. Collections and preferences

Collections are stored in the browser under `asterro.collections.v1` and use the
`asterro.collections/1` format. Every change increments the collection's version.

A collection can hold any of these item kinds:

- `location`
- `target`
- `earth_cell`
- `scenario_set` (a complete replayable configuration)
- `comparison` (targets, aggregate, configuration, criteria, weights and result)
- `reference` (a citation)

Earth-cell, scenario and comparison items must carry a provenance snapshot: registry version,
readiness model, stack SHA-256 and fingerprint hashes. When a fingerprint has changed since the
item was saved, the item is flagged as such. On import:

- every entry is validated against the registry;
- identical collections are skipped;
- a collection with the same id but different content is reported as a conflict and not
  overwritten.

Favourites, recently selected locations and reference cases are per-browser conveniences. The app
works without storage, and reports a storage-full or storage-unavailable condition.

## 8. Offline

`public/sw.js` is generated by `scripts/build_web.py`.

- **Cache name:** `asterro-<hash>`, where the hash covers every published file.
- **Precache:** 49 core files.
- **Request strategy:** network-first with a cache fallback.
- **Old caches:** deleted on activation.

These files are SHA-256-verified when loaded, so a stale or damaged copy is refused rather than
used:

- the predictor stack;
- the atlas grids;
- the Earth sub-cell data;
- the Phase II series;
- the registry.

The Readiness & Provenance centre shows cache and storage status and can clear the cache.

**What needs the network:**

- web fonts (system fonts are used offline);
- external source links;
- files never opened online. The Phase II series (7 MB) is cached on first use.
