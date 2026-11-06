# Planetary Analogue Intelligence expansion: implementation report

This report covers the expansion added on top of the Phase IX application (GitHub `main` = `60e0c16`). Everything in
it is additive:

- The six-dimension engine `tai-sim-1.0.0` is unchanged.
- Its thresholds are unchanged: weight coverage 80 %, similar ≥ 0.85, partial ≥ 0.60, distinct sites ≥ 300 km apart.
- The seven baseline profiles, all routes and every protected file (`tests/phase3/fixtures/protected_sha256.json`)
  are byte-identical.

Each new feature below is classified with one of the four requested labels:

- **Fully implemented and tested**
- **Implemented but awaiting validation**
- **Partially implemented**
- **Not implemented (documented dependency)**

Features from earlier phases that the request lists are marked *preserved*, with the suite that still exercises them.

## 1. What was added

| Area | Where |
|---|---|
| Extended thermal fingerprint `tai-ext-thermal-1.0.0` and configuration `explore-ext-thermal-v1` | `src/ext/thermal_absolute.py`, `src/ext/engine.py`, `app/frontend/phase4/ext_engine.js`, `public/data/ext/thermal_ext.json` |
| Dimension registry (28 dimensions, 8 families) | `data/ext/dimensions.json` |
| Processes (12) | `data/ext/processes.json` |
| Frequently cited analogue sites (17) | `data/ext/known_analogues.json` |
| Extended profiles (5 available, 8 not buildable) | `data/ext/profiles_ext.json` |
| Generated bundle | `scripts/build_ext.py` → `app/frontend/phase4/data_ext.js` (with SHA-256 of every input) |
| Discovery hub, in the Discover tab: Constellations (original) · Temperature extremes · Processes · Beyond the familiar · Mission profiles · Learn | `ui_21_ext_core.js`, `ui_22_discover_hub.js` |
| Research queue, report editions, Lens thermal rows | `ui_23_research.js` |
| Data view: dimension table and the challenge's five status labels | `ui_24_datacenter.js` |
| Catalogues in five languages (495 keys each), loaded without overwriting any original key | `i18n_79_extend.js`, `i18n_80_ext_en.js`, `i18n_81`–`84_ext_{bn,es,fr,de}.js` |
| Tests | `tests/test_ext.py`, `tests/phase4/test_ext_engine.mjs`, `tests/phase4/test_ext_i18n.mjs`, `tests/phase4/ui_ext_smoke.py`, `tests/fixtures/ext_reference.json` |

No new top-level tab was added. The hub sits above the original Discover content. Constellations, the first view, is
exactly what the tab showed before.

## 2. Extended fingerprint: the scientific content

These are three new conditions, all computed from data already retained in the repository:

- surface temperature at about 13:30 local solar time;
- surface temperature at about 01:30 local solar time;
- mean near-surface air temperature.

| Side | Source of the three values |
|---|---|
| Earth (76,781 cells) | `lst_day_k`, `lst_night_k` (MODIS/Aqua, clear-sky monthly means) and `t2m_mean_c` (NASA POWER), from `data/predictor_stack.npz` |
| Mars, Jezero and Gale | MEDA / REMS ground temperature at hour 13 and hour 1, binned per Ls exactly as the baseline swing; air = the mean of the 12 Ls-bin diurnal means |
| Moon, 14 targets | LRO Diviner hour 14 and hour 2, by the same rules as `src/registry/verify.py`; air = **N/A** (no atmosphere: not zero, not estimated) |

How the extended score is computed:

- It reuses the unchanged formula over nine conditions: the six baseline conditions plus these three.
- The new ranges are Earth ∪ target.
- With the three new weights at 0 the ranking equals the baseline ranking exactly. Both suites test this (Python and
  browser).
- Every configuration has an identifier: FNV-1a 64 over canonical JSON, written `cfg-…`.

Findings, recomputed from the retained inputs:

- **Mars nights are beyond Earth.** Jezero night surface is 196.8 K. The coldest Earth cell is 212.9 K, so Jezero is
  16.1 K colder than anywhere on Earth. Gale night is 199.7 K.
- **Mars mean air touches Earth's coldest cell.** Jezero mean air is 218.57 K, and Earth's coldest cell is 218.60 K: a
  0.03 K gap. Gale mean air is 222.8 K.
- **Every lunar day and night value is outside Earth's range.** Earth day is 216.7–327.2 K and Earth night is
  212.9–302.2 K. For example, Apollo 14 is 384 K by day and 99 K at night; Shackleton is 124 K by day and 63 K at night.
- **The leading Earth place under the nine conditions** (all weights 1) is the Kunlun Mountains (China) for 13 of the
  16 targets. Its score is 75.0 % for Jezero.

## 3. Feature status

### Discovery, characterisation and similarity

| Feature | Status | Evidence / dependency |
|---|---|---|
| Multi-dimensional fingerprint, families A–H | **Partially implemented** | All 28 dimensions have a definition, unit (translated where it is words), status, Earth source or candidate sources, planetary side and limitation, shown by family in the Data view. A per-dimension method, resolution and quality grade is documented only for the 9 scored dimensions (README §9–12, this report §2), not for the 19 others. |
| Extended fingerprint (3 thermal dimensions, versioned) | **Fully implemented and tested** | `test_ext.py` (7), `test_ext_engine.mjs` (39), `ui_ext_smoke.py`. Python/JS parity on 4 targets, zero-weight equivalence, config ids. |
| Multi-target support / target explorer | Fully implemented and tested (*preserved*, Phase IV Atlas) | 33 analytical targets. The extension covers the 16 targets with direct thermal data and states that the other 17 have none. |
| Global discovery engine | Fully implemented and tested (*preserved* + extended field) | Baseline search over 76,781 cells is unchanged. The extended field is ranked over the same cells. |
| Candidate characterisation | Fully implemented and tested | The place view and Lens now also show day, night and air temperature, with "outside Earth's range" notes. |
| Difference Lens | Fully implemented and tested (*preserved* + 3 rows) | `ui_journey_smoke.py`, `ui_ext_smoke.py` |
| Versioned, explainable similarity | **Fully implemented and tested** | `tai-sim-1.0.0` unchanged. Extension `tai-ext-thermal-1.0.0`. Every extended result carries its config id and exports as JSON. |
| Machine learning | **Not implemented (documented dependency)** | There are no validated positive or negative reference sites to train or test against (the Phase IV validation workspace ships none). A learned model would only be fitted to the deterministic score itself. The prompt allows ML "only if justified", and it is not justified yet. |

### Exploration views

| Feature | Status | Evidence / dependency |
|---|---|---|
| Planetary Process Explorer | **Partially implemented** | 12 processes. 6 are searchable with a rule applied to every Earth cell (counts below). Hyper-arid is only partly searchable because wind and dust are not measured. The other 6 are described only: aeolian, evaporites, volcanic / lava tubes, impact, glacial and fluvial have no dataset in ASTERRO. |
| Beyond the familiar | **Implemented but awaiting validation** | Of the leading 100 distinct places for Jezero (general profile), 90 lie more than 300 km from all 17 frequently cited analogue sites. The list was compiled from general knowledge (approximate centres, ±50 km), not from a literature review. The view says so, makes no novelty claim and shows no novelty score. |
| Mission profiles (12 requested) | **Partially implemented** | 5 built from measured conditions: landing site, autonomous navigation, environmental monitoring, construction testing, cold-night testing. The weights are editable, reset restores them, and each edit gets a new config id. 8 cannot be built without approximating missing data, and the view names the missing conditions: geological field research, dust / aeolian, resource prospecting, subsurface, lava tubes, ice / volatiles, robotic sampling, human factors. |
| Robustness Lab | **Fully implemented and tested** | Phase II robustness is *preserved*. New: weights 0–3 on the three new conditions (0 disables one) and a coverage-threshold sweep (60–100 %). The 80 % row is marked standard, and the original is never overwritten. |
| Globe and maps | Partially implemented | The globe, map, coverage and dimension layers are *preserved*. No globe layer for the extended score was added. Extended results are tables, and each place opens in the place view. |
| Visual storytelling / Analogue Reveal | Fully implemented and tested (*preserved*) | 7-step Reveal, story-led discoveries. |
| Trajectory workflow | Fully implemented and tested (*preserved*) | `ui_trajectory_smoke.py` |
| Cross-planetary atlas | Fully implemented and tested (*preserved*) | `ui_phase4_smoke.py`, `ui_atlas_smoke.py` |

Rule counts for the six searchable processes:

| Process | Cells matching | Notes |
|---|---|---|
| Thermal cycling | 769 | 99th percentile of the day–night swing; China, Iran and Chile lead |
| Freeze–thaw | 10,551 | |
| Hyper-arid | 4,002 | |
| Cold high desert | 6,112 | 5,689 in Antarctica |
| Extreme cold | 15,231 | Antarctica only |
| Rugged terrain | 769 | |

### Research tools, reports and data centre

| Feature | Status | Evidence / dependency |
|---|---|---|
| Multi-site portfolio | Fully implemented and tested | Phase II portfolio and Team of places are *preserved*. New: the multi-site report has one row per queued place and a JSON reproducibility record. |
| Earth Analogue Passport | Fully implemented and tested (*preserved* + report buttons) | |
| Advanced report editions | **Fully implemented and tested** | Concise, detailed, comparative, mission-profile and multi-site. Each is Markdown in the interface language, built from engine numbers. References come only from the dataset and target records. Each ends with the limitations, the "not a probability" statement and a reproducibility block. |
| Data Source Intelligence Center | **Fully implemented and tested** | Five challenge labels assigned by a fixed rule over the inventory: 12 integrated and verified, 4 integrated with validation pending (NASA POWER, MODIS decoding, Diviner hour 02 and polar), 20 available for future integration, 0 unsuitable, 0 unavailable. |
| Ingestion and validation architecture | **Partially implemented** | The existing pipeline is *preserved*: ingestion, manifests, checksums, probe and inventory, now with `RETENTION.json` for non-input files. HiRISE, CTX, CRISM, MCS and Sentinel-2 were added to the probe. **No new external dataset was ingested.** Every data-provider host refused the build environment's connections (re-probed 2026-11-06), so those sources stay "available for future integration". |
| Data Gaps explorer | Fully implemented and tested | Missing pieces (*preserved*), plus the "No data in ASTERRO" dimensions, the missing data per process and the missing conditions per profile. |
| Trust centre | Fully implemented and tested (*preserved*) | |
| Journal and Research Queue | **Fully implemented and tested** | Queue statuses: to investigate, waiting for data, under review, set aside. None claims confirmation. The queue also holds notes, open questions, a history, export and import, and the completeness now. It is stored in this browser only and survives a reload (tested). |
| Learn modules | **Fully implemented and tested** | Seven modules: what an analogue is, why use them, how the Moon and Mars are measured, landing-site analogues, similarity, look-alikes, limits. |
| Localisation (5 languages, Bengali font, header selector) | **Implemented but awaiting validation** | 495 extension keys in each of bn, es, fr and de. Key and placeholder parity, French spacing, Bengali script and no clash are all tested. The translations are machine-assisted, and **no native-speaker review has taken place**. |

## 4. Honesty rules applied

- **Similarity is not a probability.** This statement appears in every report and in the Temperature extremes view.
- **No discovery claim.** Beyond the familiar shows no novelty score and says a literature review is needed.
- **Indicators are not resources.** Ice and mineral dimensions say "indirect indicators are never presented as
  resources".
- **Habitability analogues are not life evidence.** The extremophile dimension says it is "never evidence of
  extraterrestrial life".
- **Non-comparable dimensions are marked.** Pressure, precipitation and freeze–thaw are marked as not comparable, with
  the reason. Gravity, vacuum and radiation are marked as a permanent limit of every Earth analogue.
- **Moon air is N/A.** It is never 0 and never estimated.
- **No approval claim.** No NASA endorsement or approval is claimed, and no site is called safe or approved.

## 5. Remaining work

1. Ingest the 20 sources labelled "Available for future integration" once network access to their providers is
   available. Do this through the existing ingestion pipeline, with checksums, and record them in the inventory.
   Wind and dust, surface materials, ice, caves and impact structures would unlock 6 processes and 8 profiles.
2. Do a literature review of the known-analogue list, with citations, before any statement about how familiar a
   place is.
3. Add a globe layer for the extended score.
4. Arrange native-speaker review of the bn, es, fr and de extension catalogues.
5. Add a per-dimension method, resolution and quality grade for the 19 dimensions that are not scored.

## 6. Update: challenge-compliance and design pass

This pass supersedes the matching rows above. The full matrix is in `CHALLENGE_COMPLIANCE.md`.

- **Planetary Process Explorer.** Now 17 processes, covering the twelve the brief names. 14 are searchable: 6 observed
  and 8 indirect indicators. 3 are described only. Status: **partially implemented**, because volcanic, impact and
  water-driven alteration need data not in ASTERRO.
- **Fingerprint.** Now 30 dimensions. Two context dimensions were added (climate class, environment type).
  Illumination, ice / permafrost and landing terrain moved from "no data" to "context" or "evidence". The text was
  corrected where the data changed.
- **Exploration operations.** Added for 11 operations: 8 are assessable from measured conditions and 3 are marked
  "cannot be assessed".
- **Design layer.** Added: see `DESIGN.md`.
