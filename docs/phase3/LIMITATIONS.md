# Phase III — Limitations and blocked or partial features

## Data limitations

- **Mars thermal criteria.** These are measured only at Jezero (MEDA, baseline) and Gale /
  Curiosity (REMS). The other 16 Mars windows are terrain-only (L2), and their atlas comparisons are
  partial. Terrain-only comparisons of flat plains saturate: hundreds of Earth cells tie near 100 %.
  The app flags this case, because the order is then set by the tie-break, not by evidence.
  - **Not done:** an orbital Mars thermal product at local times compatible with 13:30 / 01:30, such
    as THEMIS or TES with a local-time model. It was not assembled, so no proxy was invented.
  - **Possible future path:** InSight TWINS air temperature for western Elysium, which would give
    annual range only. It was not assembled.
- **Lunar thermal**
  - The GCP bins (0.5°) are coarse relative to the 55.6 km window: 3–42 bins per window.
  - Reiner Gamma has no valid bin, so its LST is MISSING.
  - Lunar ΔT is a bolometric brightness-temperature difference over lunar hours, about 29.5 Earth
    hours each. The Translator states this.
  - Lunar annual temperature range is INCOMPATIBLE: there is no air.
- **Proxies.** Aridity and elevation are proxies for every planetary target, as in the baseline.
  They cannot distinguish targets.
- **Window scale**
  - A 55.6 km window represents a named feature. Ring sampling covers features larger than 300 km
    only.
  - Valles Marineris and Orientale are not characterised as wholes.
  - Shackleton and Endeavour are smaller than the window.
- **Curiosity coordinate.** Taken from a secondary source (Wikipedia). It is flagged UNVALIDATED in
  the location claim.
- **Earth side**
  - Climate and thermal values are cell statistics (~55 km). Only terrain has a sub-cell
    distribution, from GMTED 30″.
  - The Earth candidates are cells, not sites.

## Analytical boundaries (by design)

- No safety score, landing certification, hazard probability, habitability, cost, travel, access or
  permit information anywhere. The views say so explicitly.
- Measurement-impact scenarios use values measured at *other* targets. They show sensitivity and are
  not estimates.
- The atlas comparison score is not the baseline Analogue Score, and it is not a suitability rating.

## Partially implemented or blocked

| Item | Status |
|---|---|
| Language-model copilot | **Optional, untested here.** It uses the artifact `sample` capability, which is available only inside a Claude viewer. The deterministic copilot is fully implemented and tested. |
| Phase II UI modules on atlas targets | **Connected at engine level.** Robustness, Pareto, sub-cell, temporal and requirements run on atlas targets inside the Phase III Workflow and Compare views. The original Phase II Lab views still operate on the two baseline targets only. |
| Browser replay | Available for `atlas-candidates` and `atlas-stability`. Other Phase III records (workflow, comparison context) are verifiable by checksum and re-runnable, but not auto-replayed. |
| Sub-cell climate and thermal distributions | **Blocked:** MODIS and POWER source pixels were not retained during Phase I ingestion. |
| Formal value of information | **Not implemented** (as in Phase II). Measurement impact is a scenario sensitivity, not a decision-theoretic VOI. |
| Scientific validation | **Not performed.** No field campaign or expert review is claimed. ASTERRO is not NASA-approved. |
