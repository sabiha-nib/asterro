# Challenge compliance matrix

This matrix maps each item of the NASA Space Apps brief "Identify Earth Locations that Analog the Permanent Moon Base
Locations and Mars" to ASTERRO.

Status labels:

- **Implemented and tested**: real data and method; an automated test exercises it.
- **Indirect indicator**: the condition is inferred from other measured data and is labelled so in the app.
- **Partially implemented**: part of the requirement works; the rest is listed.
- **Not implemented (dependency)**: needs data ASTERRO could not obtain; the dependency is named.

**Data constraint during this work.** On 2026-11-06 every data-provider host refused connections from the build
environment, and so did npm, PyPI and GitHub. A reachability probe from the user's computer was refused by the session's
permission controls. So nothing new was downloaded. Every result below comes from data already retained and
checksummed in the repository.

## Challenge description and objectives

| Requirement | What ASTERRO does | Data | Where | Test | Status |
|---|---|---|---|---|---|
| Use open Earth, Moon and Mars data from NASA and other agencies | 16 integrated sources, each with provider, product, version, resolution and checksum, and the challenge's five integration labels | NASA POWER, MODIS/Aqua LST, GMTED2010, MOLA, LOLA, Diviner, MEDA, REMS, Natural Earth, IAU gazetteer | Data tab | `test_inventory.py`, `ui_ext_smoke.py` | Implemented and tested |
| Identify and characterise new terrestrial analogues | Every one of 76,781 Earth cells is scored. Leading distinct sites (≥ 300 km apart) are listed, with the ones away from frequently cited sites separated out | Six-dimension stack | Explore, Discover › Beyond the familiar | `ui_smoke.py`, `ui_ext_smoke.py` | Implemented and tested |
| …for candidate permanent Moon-base locations and Mars landing / exploration sites | 33 analytical targets: lunar south pole, Shackleton, Cabeus, Malapert, the north pole window, Apollo sites, Jezero, Gale and others. 16 of them have full thermal data | Registry (`asterro.registry/1`) | Atlas, target selector | `test_phase4.py` | Implemented and tested |
| Deserts, polar regions, volcanic and arid terrain, caves | Deserts, dry climates, polar / tundra, mountains, plateaus, basins, valleys and coasts are filterable (Natural Earth region class and Köppen–Geiger class) | Natural Earth, NASA POWER | Beyond the familiar › Environment | `ui_ext_smoke.py` | Deserts / arid / polar: implemented. Volcanic terrain and caves: **not implemented** (no volcanic or cave dataset) |
| Present as a map, visualisation or tool | Globe and map, similarity field, constellations, change, coverage and dimension layers, Atlas, reports | — | Explore | all UI suites | Implemented and tested |
| Explain what makes a place analogous and where the analogy breaks down | Per-condition similarity (Lens). A plain-language card names the strongest similarities and the important differences. The site profile has a "Where the analogy breaks down" list. Every report states Earth's limits | Engine output | Explore card, place view, reports | `ui_design_smoke.py`, `ui_ext_smoke.py` | Implemented and tested |
| Explain how the analogue helps exploration | 11 exploration operations, each with the measured conditions it depends on and a similarity reading. Operations that need unmeasured data are marked "cannot be assessed" | `data/ext/operations.json` | Place view › Site profile | `ui_ext_smoke.py` | Implemented and tested (8 of 11 assessable) |
| Similarity ranking / metrics; ML approaches | Deterministic, versioned similarity (`tai-sim-1.0.0`), the extended fingerprint (`explore-ext-thermal-v1`) and configuration ids. The Phase IV method arena runs three alternative rules | — | Explore, Compare › Method arena | `test_similarity.py`, `test_ext_engine.mjs` | Similarity: implemented. **ML: not implemented (dependency)**, because there are no validated positive and negative reference sites to train or test against |
| Educate the public / written findings | Seven Learn modules, guided discoveries, the 7-step Reveal, Markdown report editions in five languages | — | Discover › Learn, landing "Discover an analogue" | `ui_ext_smoke.py`, `ui_journey_smoke.py` | Implemented and tested |

## Consideration 2: dimensions of analogy

| Dimension | What ASTERRO does | Status |
|---|---|---|
| Geology, mineralogy, surface materials | Listed with their candidate sources (SoilGrids, ESA WorldCover, CRISM, M³, Landsat). Never inferred from imagery | **Not implemented (dependency)**: no geological, mineral or surface-material dataset could be retrieved |
| Elevation, slope, roughness | Scored (baseline). Kilometre-scale slope distribution (share of ~1 km pixels ≤ 5° and ≤ 15°), Earth cell vs target window | Implemented and tested |
| Craters, crater morphology | Planetary craters are in the Atlas (IAU gazetteer) | Partially implemented: no Earth impact-structure layer, so there is no crater comparison |
| Valleys, ridges, dunes, lava flows, texture | Valleys, gorges and deltas as named-region classes (indirect) | Partially implemented: dunes, lava flows and texture need data not in ASTERRO |
| Temperature (day, night, air, seasonal, diurnal) | Seasonal range and diurnal swing are scored. Absolute day, night and air temperatures are in the versioned extension. Surface vs air is labelled throughout | Implemented and tested |
| Illumination, shadow | Noon solar-elevation geometry for Earth and target latitude, including polar night. Geometry only | Partially implemented: no measured illumination or shadow maps (LOLA illumination not retrieved) |
| Thermal inertia | Listed with candidate sources | **Not implemented (dependency)** |
| Freeze–thaw | Daily crossing of 0 °C from MODIS day / night means | Implemented (evidence, not scored) |
| Water, ice, permafrost | Permafrost climatic indicator: mean annual air temperature, with likely ≤ −6 °C and possible ≤ −1 °C. Ice-cap climate class (EF). Directly observed, indirect, inferred and unknown evidence are kept separate | **Indirect indicator.** Surface water and ground ice are not observed. Never a resource claim |
| Dry lake beds, salt deposits | Dry named basins and lakes (aridity index < 0.2) as indirect settings | Indirect indicator |
| Dust, wind, aerosols | Dust-storm and aeolian settings: desert climate, smooth terrain, aridity | Indirect indicator. Wind and aerosols are not measured (MERRA-2 / ERA5 / MCS not retrieved) |
| Biology, extremophiles, habitability | Described, with the explicit statement that this is never evidence of extraterrestrial life | **Not implemented (dependency)**: no biological dataset |
| Caves, lava tubes, subsurface | Described. Subsurface exploration is marked "cannot be assessed" | **Not implemented (dependency)**: no cave inventory |
| Landing, mobility, navigation, robotics, EVA, construction | Site-profile operations table, mission profiles (7 baseline + 5 extended) and kilometre-scale slope shares | Implemented and tested. Metre-scale hazards are out of scope (~1 km grid) |

## Considerations 1, 3–12

| # | Consideration | What ASTERRO does | Status |
|---|---|---|---|
| 1 | Beyond visual similarity | Every comparison is between measured values. No imagery enters any score | Implemented |
| 3 | Partial analogues | Per-condition readings (similar / partial / different), Difference Lens, plain-language card | Implemented and tested |
| 4 | Processes as well as places | Process Explorer, 17 processes covering all twelve the brief lists, each with its Earth environment, planetary environment, mechanism, similarities, differences, research use, limitations and data. 6 are observed, 8 are indirect indicators with rules applied to every cell, 3 are described only (volcanic, impact, water-driven alteration) | Partially implemented (14 of 17 searchable) |
| 5 | Beyond well-known sites | 17 frequently cited sites, ±300 km exclusion. Two classes: "near a frequently cited analogue" and "candidate requiring further investigation". No novelty claim without a literature review | Implemented, awaiting a literature review |
| 6 | The whole Earth, including below its surface | Every valid land cell, including Antarctica and Greenland | Surface: implemented. **Subsurface: not implemented (dependency)** |
| 7 | Multiple datasets combined | Scores combine NASA POWER, MODIS and GMTED2010. Context combines POWER climate, Natural Earth regions and GMTED2010 sub-cell slope | Implemented and tested |
| 8 | Scale | Global search on a 0.5° × 0.625° grid; regional filters by named environment; per-cell kilometre-scale slope distribution; 55.6 km target windows; Atlas locations | Partially implemented: no sub-kilometre or feature-boundary analysis |
| 9 | Connect to exploration | Operations table, mission profiles, research queue, report editions | Implemented and tested |
| 10 | Creative approaches | Similarity metrics, process rules, method arena, guided story, research queue | Implemented |
| 11 | Earth's limits | Gravity, vacuum, thin CO₂ atmosphere, radiation and history appear in every report, the summary card, the site profile and the dimension table | Implemented and tested |
| 12 | Surprise | Mars nights at Jezero are 16.1 K colder than anywhere on Earth. Jezero's mean air temperature is within 0.03 K of Earth's coldest cell | Implemented (findings from retained data) |
