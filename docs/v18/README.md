# ASTERRO V18: Local Impact

"Discover what your location can teach us about exploring the Moon and Mars."

Local Impact is a new tab (after Atlas). It turns one point on Earth into a local profile, a planetary comparison,
a neighbourhood view, rule-based local discoveries, exploration relevance and a downloadable report. It reuses the
V17 products and the unchanged baseline engine. It is an independent module: `engine_v18.js` (logic, also runs in
Node), `ui_31_local.js` (tab and view) and `i18n_90–94_v18_*.js` (five languages). Nothing in the engine, the V17
products, the protected files, the datasets or the routes changed.

## 1. Audit of what V17 provides

| Need | V17 / existing source reused |
|---|---|
| Earth values per cell | predictor stack (`S.A`): elevation, slope, roughness, LST day/night/range, air temperature, annual range, rainfall, P/PET, aridity |
| Derived local variables | V17 feature cube: freeze months, freeze–thaw months, dry months, rain seasonality, polar night, TOA sunlight, interannual LST variability, aridity zone, relief class |
| Sub-cell terrain | Phase III GMTED2010 sub-cell slope shares (`xcSlopeShare`) |
| Climate class, geography | Köppen–Geiger (tai-ext-context-1.0.0), Natural Earth 1:50m geography regions and countries (`labels.json`) |
| Rarity and patterns | V17 novelty and ML products |
| Comparison | `ENG.detail` with each target's own ranges (`jnCtx`), weights from the console |
| Exploration relevance | Phase IV operations table (`xcOps`) |
| What Earth cannot reproduce | V17 limitations framework |
| Data states | V17 Data Integration Registry |

## 2. Location input and privacy

| Method | How |
|---|---|
| Use my location | `navigator.geolocation.getCurrentPosition` called only when the button is pressed; `enableHighAccuracy: false`, 15 s timeout. No `watchPosition`, nothing in the background. |
| Type a place | Offline search of ASTERRO's own Natural Earth region and country names (522 regions, 242 countries). A match is represented by the cell of that region or country nearest its centroid. |
| Type coordinates | Decimal degrees with signs or N/S/E/W, comma or semicolon separators, decimal commas. |
| Use the place selected on the globe | The current selection. |

States shown, with retry and manual fallback: waiting, permission refused, position unavailable, timed out, browser
without geolocation, invalid coordinates, point off the land grid (more than 60 km from any valid cell), no name match,
and **inaccurate** (accuracy radius above 25 km, half a cell: the cell is analysed with a warning). The accuracy radius
is always displayed when the browser gives it.

**Privacy.** The position never leaves the browser: no request is made with it (tested by watching every network
request), it is not written into the page address, and it is not stored. No external geocoder or map service is used;
the brief's "optional external location processing" is therefore not offered, and the page states this before any
position is used. A saved place is stored in this browser only after an explicit consent tick, and keeps only the grid
cell number, its name, the radius, the target and the date; never coordinates. Each saved place can be deleted, or all
at once. The report is generated in the browser, with coordinates at the precision the person chooses: cell centre
(default), rounded to 1°, exact as entered, or none.

## 3. Local environmental profile

The analysed unit is the 0.5° × 0.625° cell (about 55 km) that contains the point. Every variable shows value, unit,
measurement type and, in Research mode, dataset and provider, resolution, observation period and completeness within
the analysis radius. Missing values show "not available".

| Group | Variables (source) |
|---|---|
| Terrain | elevation (GMTED2010, direct); slope, roughness, share ≤ 5° (derived); relief class (derived, provisional); local relief within the radius (range of cell means) |
| Surface temperature | LST day, night (MODIS Aqua via GIBS, 2016–2025, direct but decoded from rendered imagery); diurnal range, year-to-year variability (derived) |
| Climate and water | annual air temperature range, mean air temperature, rainfall (NASA POWER / MERRA-2 2001–2020, reanalysis); P/PET, UNEP aridity zone, dry months, rain seasonality (derived) |
| Cold | months below freezing (reanalysis); freeze–thaw months (proxy, air); surface freeze–thaw (proxy, MODIS day above / night below 0 °C) |
| Sunlight | months of polar night, top-of-atmosphere sunlight (geometry, POWER TOA) |
| Context | Köppen–Geiger class; Natural Earth region |

**Not available, listed with their registry state rather than shown as zero:** aspect (needs full-resolution DEM
tiles: NASADEM, Copernicus DEM), land cover (ESA WorldCover), surface-water occurrence (JRC GSW), vegetation (MODIS
vegetation indices), geology (Macrostrat, USGS SGMC), mineral indicators (ASTER L2, Landsat, Sentinel-2), aerosols
(MODIS MAIAC, MERRA-2 aerosol), wind (MERRA-2, ERA5), soil (SoilGrids). All are "endpoint unavailable" in the V17
registry: the build environment cannot reach any provider.

## 4. Planetary comparison

Any target with a fingerprint (Jezero, Gale, the Lunar South Pole, the Diviner polar and GCP windows, and the
terrain-only L2 windows). For each of the six dimensions: value here, target value, similarity s, reading, and the
target measurement type (direct, proxy, not applicable). Lists of strong similarities, partial similarities,
significant mismatches, missing data and proxy-based comparisons; weight coverage; the cell's rank among all ranked
Earth cells for that target; the not-a-probability statement. If coverage is below 80 %, the place is not ranked and
the page says why.

## 5. Around this place

Radii 50, 100, 250 and 500 km (capped at 500 km: about 200 cells near the equator, up to about 1,200 near the poles, because the grid is equal-angle), with the number of cells and the cell size
shown. Reported: relief (min and max cell-mean elevation), roughest cell, aridity zones, relief classes, Köppen
classes, the closest analogue for the target within the radius, and the Natural Earth geography regions (ranges,
plateaus, deserts, basins, valleys, deltas, wetlands, lakes …) whose cells lie inside the radius, nearest first.
Rivers and dry basins, salt flats, volcanic formations and caves are **not shown**, and the page says why (no retained
source; GVP and cave inventories unavailable).

## 6. Local discoveries

Rules over every cell inside the radius. Each result shows how many cells match, the strongest cell with its measured
values (the evidence), and a separate hypothesis that a field study would test.

| Rule | Measured condition |
|---|---|
| Dry ground with a very large day–night swing | UNEP arid or hyper-arid and LST diurnal range ≥ the global 90th percentile |
| Martian-like terrain with different seasons | slope and roughness s ≥ 0.85 against the Mars target, annual temperature range s < 0.60 |
| Distinctive freeze–thaw | ≥ 4 freeze–thaw months (air) or MODIS day above and night below 0 °C |
| Unusual combination | V17 isolation-forest anomaly ≥ 98th percentile |
| Rare environment | V17 rarity ≥ 98th percentile |
| Polar night | ≥ 1 month of polar night |
| Geology with topography; former water | not possible: no data (listed with the missing sources) |

## 7. Exploration relevance

The eleven Phase IV operations (landing, rover mobility, navigation, robotic operations, instrument deployment, EVA
training, habitat operations, construction, resource prospecting, geological fieldwork, subsurface exploration) with
the mean similarity of their conditions, or "cannot be assessed" and what else they would need; environmental
monitoring (read through instrument deployment) and educational planetary science. Followed by what Earth cannot
reproduce (V17 limitations) and the statement that no site is certified.

## 8. Report

`asterro-local-impact-cell<cell>-<radius>km.md`, 14 sections: location, coordinates (chosen precision), radius and
resolution, target, every measurement with dataset, resolution, period, type and completeness, unavailable variables
with registry states, provenance, similarities, differences, evidence strength, data gaps, local discoveries with
hypotheses, exploration applications, limitations, and the reproduction record (`tai-v18-local-1.0.0`, engine
version, cell, radius, target, weights, profile, thresholds, precision, V17 document SHA-256).

## 9. Interface

Explore mode: a one-paragraph summary of the place, the comparison in plain words, the profile with evidence types.
Research mode adds dataset, resolution, period, completeness and method notes. The view uses the wide research
layout; on tablets and phones, opening the tab brings its panel into view. Keyboard: every control is a native button,
input, select or checkbox; after a location is found, focus moves to the result heading; radius buttons keep focus.
Status messages are in a polite live region.

## 10. Data architecture

No new provider: every provider host is unreachable from the build environment (V17 probe, 0 of 47), and an external
geocoder would also send the position out, which Local Impact is designed not to do. The Data Integration Registry is
therefore unchanged. Results are cached per cell, radius, target and weights (24 entries); a 500 km query scans the
~76,800 cells once with a latitude band filter (about 2 ms in Node).

## 11. Definition of done

| Criterion | Status |
|---|---|
| Real location input obtained with permission | Done (browser geolocation on request; tested granted, denied, unavailable, timeout, unsupported, inaccurate) |
| Analysis uses actual available data | Done (stack, V17 cube, Phase III sub-cell, Köppen, Natural Earth) |
| Every measurement exposes provenance and limitations | Done (dataset, provider, resolution, period, type, completeness, notes) |
| Comparisons work | Done (all targets; equal to the engine, tested) |
| Functional and privacy tests pass | Done (see TEST_REPORT.md) |
| A point is not called a characterisation | Done (stated before analysis; every value labelled as describing the ~55 km cell) |
| Land cover, water, vegetation, geology, minerals, aerosols, wind, aspect, rivers, salt flats, volcanoes, caves | Not available: blocked by data access; shown as unavailable |

## 12. Limitations

- Everything describes a ~55 km cell, not the exact spot; local relief is a range of cell means.
- Offline name search knows only Natural Earth regions and countries, not towns or addresses.
- Discovery rules are ASTERRO-defined thresholds over coarse data; hypotheses are suggestions for field study.
- Translations are machine-assisted and not reviewed by native speakers.
