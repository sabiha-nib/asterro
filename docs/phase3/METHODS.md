# Phase III — Methods

## 1. Target universe

`src/phase3/target_catalog.py` defines where each of the 33 targets is and how its location is
anchored. It contains no environmental value. There are 18 Mars windows and 15 Moon windows.

**Anchors**

| Type | Rule | Targets |
|---|---|---|
| `gazetteer` | Looked up at build time in the USGS/IAU Gazetteer of Planetary Nomenclature center-point shapefiles. Exact name match; for Schrödinger the lookup falls back to `clean_name`. Approval status, diameter, extent and link are recorded. | — |
| `mission` | Published coordinate. | Apollo LM sites (NSSDCA, from LRO images); Marius Hills Pit (LROC Pits Atlas); Curiosity landing (Wikipedia — a **secondary** source, flagged as UNVALIDATED in the location claim). |
| `offset` | Great-circle destination from a gazetteer centre. | Olympus Mons flank (150 km E) and plains (450 km E). |
| `baseline` / `pole` | Fixed definition. | The two baseline targets, unchanged; the lunar north pole, defined like the south pole. |

**Kinds** are kept distinct: named feature, defined region, mission region and observation site.

**Limits of the catalogue**

- "Aristarchus Plateau" and the "Marius Hills" dome field are not IAU features. They are represented
  by Aristarchus crater and the Marius Hills Pit, and the text says so.
- Valles Marineris and Orientale are represented by a single window. The text says they are not
  characterised as a whole.

## 2. Fingerprint pipeline (`src/phase3/pipeline/`)

### Terrain (all targets)

- Uses the **unchanged** baseline `terrain.planet_window`. The file was fetched from the user's GitHub
  baseline commit `3073a87`, and its md5 is identical to the repository copy.
- Method: a 55.6 km window, binned to an azimuthal-equidistant grid of 926.6 m; Horn slope; roughness
  as the standard deviation (SD).
- Sources: MOLA 463 m for Mars and LOLA 118 m for the Moon.
- Near the poles, the read takes a full-longitude band. This is the baseline's own `rows_lat` path,
  with the corner-covering extent 1.45 × half-window.
- Across the antimeridian, a band read is also used.
- Every window recorded `bins_filled = 3600 / 3600`.
- **Checksum**: the SHA-256 of the 60 × 60 elevation and slope grids, plus the object ETag and
  Last-Modified of the DEM.

**Reproducibility check.** Jezero and the lunar south pole were recomputed with the baseline
parameters.

| Target | Criterion | Recomputed | Baseline |
|---|---|---|---|
| Jezero | slope | 2.41338° | 2.413 |
| Jezero | roughness | 263.205 m | 263.2 |
| South pole | slope | 10.2918° | 10.292 |
| South pole | roughness | 958.002 m | 958.0 |
| South pole | Diviner ΔT | 54.6821 K | 54.682 |

The atlas keeps the baseline values for these two targets.

**Heterogeneity.** Features larger than 300 km get 8 extra windows on a ring of radius 0.25 × the
gazetteer diameter. This applies to Elysium, Utopia, Hellas, Arcadia, Amazonis, Noctis, Schiaparelli
and Oceanus. The fingerprint uses the centre window; the ring is reported as between-location spread.

### Thermal: Moon, polar

Applies to the south pole, Shackleton, Cabeus, Malapert and the north pole.

- **Data**: Diviner level-4 polar hourly bolometric maps (Williams et al. 2019): `hour14` (13–14 h)
  and `hour02` (01–02 h) local time, summer and winter.
- **Grid convention**, verified against the provider's `.txt` rows:
  - polar stereographic, with x, y normalised by R = 1737.4 km;
  - colatitude = 2·atan(r/2);
  - south: lon = atan2(x, y); north: lon = atan2(x, −y).
- **Window**: the azimuthal-equidistant square around the target. For the baseline south pole, the
  baseline |x|, |y| ≤ h definition is used.
- **Value**: the mean of the two seasonal window means of T14 − T02, using only bins valid at both
  local times.
- **Grid**: a 60 × 60 ΔT grid on the terrain bins is shipped.
- **Validity rule**: DIRECT only if at least 50 % of bins are valid. All five targets passed (minimum
  86.8 %).

### Thermal: Moon, non-polar (Diviner GCP, Williams et al. 2017)

- **Record layout**, verified by reading records at computed offsets: 0.5° × 0.5° × 0.25 h records
  of 113 bytes; record k = (ilon·20 + ilat)·96 + ilt; 1 header record. HTTP Range reads fetch only
  the 96 records of each bin, and every read asserts its clon, clat and ltim.
- **Per bin**: the mean of the valid quarter-hour `tbol` records with 13 < LT < 14 minus those with
  1 < LT < 2.
- **Bin rule**: a bin counts only if at least 2 of its 4 records are valid at **both** local times.
  This rule was fixed before the data were seen and was not tuned.
- **Window value**: the mean over bins whose centres lie inside the 55.6 km azimuthal-equidistant
  square.
- **Result**: Reiner Gamma has 0 valid bins, so its value is **MISSING**. It is not interpolated.

### Thermal and annual range: Gale / Curiosity (MSL REMS MODRDR)

**Data and filters**

- Every second available sol of sols 1–669, which is one Mars year: 306 sols, all with data.
- Ground temperature: GTS brightness temperature, filtered on GTS confidence bytes 2 and 3 (rover
  still, no shadow). This mirrors the MEDA filter used for the baseline.
- Air temperature: `AMBIENT_TEMP`, filtered on confidence bytes 7 and 8 (error within 5 K, reliable).
- A **strict** variant adds the remaining quality bytes. It gives 69.09 K and 21.81 K, against
  69.11 K and 21.82 K for the primary filter.

**Solar longitude (Ls)**

- Ls is not in the REMS label. It is computed with the **Mars24** algorithm (Allison & McEwen 2000)
  at the midpoint of the label's START_TIME and STOP_TIME.
- The implementation was validated three ways:
  - the Mars24 worked example (2000-01-06: 277.18759° vs 277.18758°);
  - the Mars 2020 MEDA sol-100 PDS4 label (52.735° / 53.171° vs 52.734° / 53.17°);
  - Curiosity's landing (150.70°).

**Aggregation.** The baseline's `mars_meda.aggregate()` is imported **unchanged**:

- `lst_diurnal_range` is the mean over 12 Ls bins of T(13–14 LTST) − T(01–02 LTST) = **69.11 K**;
- `annual_temperature_range` is the max − min over 12 Ls bins of the diurnal-mean air temperature =
  **21.82 K**.

### Other Mars targets

Thermal and annual range are **MISSING**. No Mars surface-temperature product at 13–14 h and
01–02 h local true solar time was assembled. TES and THEMIS observe at other local times. Nothing is
filled in.

### Proxies

Aridity (0) and elevation (5702 m, the highest valid Earth cell) are **PROXY** for every planetary
target, exactly as in the baseline. They never count toward readiness and are excluded from atlas
scoring unless the viewer includes them explicitly.

## 3. Statuses and readiness

**Statuses**

| Status | Meaning |
|---|---|
| DIRECT | Same or documented-compatible definition as the Earth criterion. |
| DERIVED | Extra modelling step. Defined; currently unused. |
| PROXY | Rule, not a measurement. |
| MISSING | Compatible product not assembled. |
| INCOMPATIBLE | No physical counterpart; e.g. the Moon has no air, so it has no air temperature. |
| UNVALIDATED | Computed but failed a quality rule; never scored. |

**Readiness levels**

| Level | Rule |
|---|---|
| L1 | 0 DIRECT criteria. Excluded from every ranking. |
| L2 | 1–2 DIRECT criteria. Partial comparison, explicitly labelled. |
| L3 | At least 3 DIRECT criteria. |
| L4 | L3, and no UNVALIDATED value. Every value comes from a documented script and checksummed source data. |

**Result**

| Body | L2 | L4 |
|---|---|---|
| Mars | 16 (terrain only) | 2 (Jezero, Gale/Curiosity) |
| Moon | 1 (Reiner Gamma) | 14 |

No target is L1, because every target has measured terrain.

## 4. Atlas comparison score

**Formula.** The baseline formula is reused through `AsterroLab.prepare` and `fieldScore`, in the
same accumulation order:

- s = clip(1 − |e − t| / span, 0, 1);
- S = Σ w·s / Σ w;
- coverage ≥ 0.80;
- distinct sites ≥ 300 km apart;
- tie-break: score descending, then cell id ascending.

The target vector holds DIRECT values only. The score is labelled an *atlas comparison score*. It is
never presented as the baseline Analogue Score.

**Normalisation (default: Earth ∪ this target).** The span is the range of valid Earth cells
extended by this target's own values, which is the same rule as `compute_ranges`. A target's ranking
therefore never depends on which other targets are catalogued.

The catalogue-wide table `atlas-norm-1` (Earth ∪ all targets) is shipped and offered in the
Counterfactual Laboratory. It shows why it is not the default: the non-polar lunar ΔT values (185–285 K) widen the thermal
span from 76 K (Earth ∪ Gale) to 292 K. That compresses every Mars thermal comparison; for example,
a 69 K ΔT difference would score s = 0.76 instead of about 0.1.

**Parity checks**

- In the baseline configuration (proxies included, baseline table), the atlas path reproduces the
  baseline engine **bitwise** for both baseline targets and all six profiles.
- JS candidates equal the Python reference (`src/compute`) for all 33 targets.

**Saturation flag.** When more than 40 cells score within 0.1 pt of the best, the list is flagged as
saturated. This is typical of terrain-only comparisons: the order is then set by the tie-break, not
by evidence. Stability classes are marked as not informative in that case.

## 5. Analyses

**Stability.** Uses the Phase II factorial design:

- 3^k configurations with factors 0.5, 1 and 2;
- for k ≤ 2, factors 0.5, 0.75, 1, 1.5 and 2, so that at least 10 configurations exist;
- classified with `AsterroLab.rankStats` (top 1 %).

**Distinguishing dimensions.** For each criterion, the spread is (max − min) / span over targets
with a DIRECT value. Missing and incompatible targets are listed. Proxies are reported as not
distinguishing.

**Shared candidates.** Uses the minimum of the per-target scores, which is the baseline
cross-planet rule.

**Complementary set.** Greedy: the best site for each target that is at least 300 km from the sites
already chosen.

**Discriminating measurements**

- For each MISSING criterion, Earth is re-ranked with **scenario values**. These are values measured
  at *other targets on the same body*, explicitly labelled as such and never presented as estimates.
- Reported:
  - the overlap with the current list;
  - the agreement between scenarios. Below 0.5 means the actual value decides which sites are
    preferred.

**Extremes**

- Robust z = (x − median) / (1.4826·MAD).
- Regimes are tercile codes (L / M / H) per criterion.
- Extremes are distinct sites. No place is selected by name or reputation.

**Terrain (landing-site) explorer**

- Slope classes and 4-connected areas of 926.6 m bins that meet a **user-chosen** slope threshold,
  optionally combined with a Diviner ΔT band.
- The explorer states its resolution limit. It has no safety score and gives no landing advice.

**Mismatch Cartographer.** Shows the criterion similarity for each cell. Missing Earth values are
hatched rather than coloured, and data-quality conditions (MODIS coverage, land fraction, gaps) are
listed separately from differences.

**Translator**

- Verdicts per criterion: analogous (s ≥ 0.85), partially analogous (s ≥ 0.60), not analogous, not
  comparable, no counterpart, proxy only.
- Context facts are quoted from the NASA NSSDCA fact sheets: gravity, pressure, atmosphere, day
  length. They are never compared.

**Expedition Designer.** Gives field objectives and generic measurement methods for each chosen
site. Geographic grouping is by great-circle distance only. Access, travel, cost, permits, hazards
and safety are listed as **not assessed**.

**Knowledge Constellation.** Columns are fixed by node type and rows by a fixed order; distance has
no meaning. The edges are:

- dataset → target (provenance);
- target → criterion (status);
- target → candidate (top 3).

**Copilot**

- The deterministic core only looks up the evidence index built from atlas values, statuses,
  readiness and locations, and it cites the entries it used.
- It refuses safety, certification, habitability, cost, travel and permit questions.
- Otherwise it answers exactly *"I cannot determine that from the available evidence."*
- Optional mode: Claude through the artifact `sample` capability, on the viewer's own usage. Its
  answer is accepted only if every citation is a valid evidence id. It is screened by the Phase II
  guardrails and labelled as a draft.

## 6. Experiment contract `asterro.experiment/2`

A record contains:

- `{schema, contract, module, context, params}`;
- `context`: targets, workflow stage, atlas version, normalisation kind and ranges per target,
  profile, weights, proxy flag, target vectors, predictor stack SHA-256, algorithm version;
- `id` = sha256(canonical(config))[:16];
- `outputs` and `outputs_sha256`, plus claims, limitations, parents and software versions.

The `adaptV1` adapter converts v1 records losslessly. Browser replay is available for
`atlas-candidates` and `atlas-stability`. Independent Python replay is
`scripts/replay_atlas_record.py`, which uses `src/compute` and `src/phase2/analysis`.

## 7. Earth sub-cell terrain

The same GMTED2010 30″ product, pixel-to-cell mapping and Horn slope as the baseline are used.

For every cell, the pass computes:

- the fraction of pixels with slope ≤ 2, 5, 10, 15, 20 and 30°;
- p10, p50 and p90 from a 0.25° histogram.

**Check.** The histogram-pass mean slope equals the baseline cell slope for all 76,781 cells
(max |Δ| = 0.0).

This closes the Phase II *Spatial Atlas* sub-cell gap **for terrain only**. MODIS and POWER source
pixels were not retained, so climate and thermal sub-cell distributions remain unavailable.

## TLS

Certificate verification stayed **on**. Two hosts serve incomplete chains:

- `luna1.diviner.ucla.edu`: verified with the system bundle plus the issuer's AIA intermediate, and
  `SECLEVEL=1` ciphers for its legacy DH key.
- `pds-geosciences.wustl.edu`: verified with the system bundle plus the intermediate and the
  cross-signed Sectigo R46 root.
