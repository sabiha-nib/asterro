# Example analyses (real, V17)

Computed by `node scripts/v17_examples.mjs` with the unchanged engine (tai-sim-1.0.0, General analogue weights, all 1) and the V17 products. Nothing here was edited by hand; `examples.json` holds the full output. Similarity is a similarity of measured conditions, not a probability, a suitability rating or a certification.

## Surprise me · Unexpected Mars analogue, draw 1: KUNLUN MOUNTAINS, China for Jezero Crater

- **Earth location:** KUNLUN MOUNTAINS, China, cell 146152, centre 36.50°, 85.000° (0.5° × 0.625° cell, about 55 km).
- **Target:** Jezero Crater (mars_jezero).
- **Weighted similarity:** 83.1 %; **weight coverage:** 100 %; mode pool 40 places at least 300 km apart.

| Condition | Earth | Target | Target measurement | s | Reading |
|---|---:|---:|---|---:|---|
| Aridity (P/PET) | 0.075  | 0.000  | PROXY | 0.925 | similar |
| Annual temperature range | 22.9 K | 11.3 K | DIRECT | 0.805 | partly similar |
| Elevation | 4,749.0 m | 5,702.0 m | PROXY | 0.835 | partly similar |
| Slope | 2.8 ° | 2.4 ° | DIRECT | 0.982 | similar |
| Surface roughness | 221.8 m | 263.2 m | DIRECT | 0.972 | similar |
| Day–night surface temperature swing | 31.9 K | 75.9 K | DIRECT | 0.468 | different |

- **Similar:** Slope, Surface roughness, Aridity (P/PET). **Different:** Day–night surface temperature swing. **Not assessed:** none.
- **Novelty:** outside_rare (rarity percentile 95, unlike listed sites percentile 92, 760 km from the nearest listed site).
- **Environmental pattern:** group 1 (cold · semi_arid · high_relief), unusual-combination percentile 100.
- **terrain module:** elevation = 4749.0; slope = 2.8; surface_roughness = 221.84; landform_class = high_mountains.
- **thermal module:** lst_day_k = 289.65; lst_night_k = 257.78; lst_diurnal_range = 31.87; lst_dr_iav_k = 1.6; t2m_mean_c = -6.18.
- **illumination module:** toa_annual_wm2 = 342; polar_night_months = 0.
- **hydro_cryo module:** aridity_class = arid; dry_months = 1; precip_cv = 0.98; freeze_months = 8; ft_air_months = 9; maat_below_zero = 1.
- **Blocked modules (no data):** geology, mineralogy, atmosphere_dust, biology.

## Surprise me · Unexpected polar environment, draw 1: Queen Maud Mountains, Antarctica for Lunar South Pole

- **Earth location:** Queen Maud Mountains, Antarctica, cell 6900, centre -84.50°, 172.500° (0.5° × 0.625° cell, about 55 km).
- **Target:** Lunar South Pole (moon_south_pole).
- **Weighted similarity:** 64.5 %; **weight coverage:** 80 %; mode pool 50 places at least 300 km apart.

| Condition | Earth | Target | Target measurement | s | Reading |
|---|---:|---:|---|---:|---|
| Aridity (P/PET) | missing  | 0.000  | PROXY | missing | not assessed |
| Annual temperature range | 22.5 K | missing  | N/A | missing | not assessed |
| Elevation | 2,253.1 m | 5,702.0 m | PROXY | 0.403 | different |
| Slope | 9.7 ° | 10.3 ° | DIRECT | 0.972 | similar |
| Surface roughness | 748.1 m | 958.0 m | DIRECT | 0.860 | similar |
| Day–night surface temperature swing | 0.6 K | 54.7 K | DIRECT | 0.346 | different |

- **Similar:** Slope, Surface roughness. **Different:** Day–night surface temperature swing, Elevation. **Not assessed:** Aridity (P/PET), Annual temperature range.
- **Novelty:** insufficient (a baseline condition is missing, so no novelty is claimed).
- **Environmental pattern:** no group (a feature is missing).
- **terrain module:** elevation = 2253.06; slope = 9.71; surface_roughness = 748.11; landform_class = mountains.
- **thermal module:** lst_day_k = 236.64; lst_night_k = 236.08; lst_diurnal_range = 0.57; lst_dr_iav_k = 0.3; t2m_mean_c = -31.79.
- **illumination module:** toa_annual_wm2 = 174; polar_night_months = 5.
- **hydro_cryo module:** dry_months = 0; precip_cv = 0.24; freeze_months = 12; ft_air_months = 0; maat_below_zero = 1.
- **Blocked modules (no data):** geology, mineralogy, atmosphere_dust, biology.

## Surprise me · Strong in one condition only, draw 1: ALTIPLANO, Bolivia for Jezero Crater

- **Earth location:** ALTIPLANO, Bolivia, cell 86002, centre -15.50°, -68.750° (0.5° × 0.625° cell, about 55 km).
- **Target:** Jezero Crater (mars_jezero).
- **Weighted similarity:** 50.6 %; **weight coverage:** 100 %; mode pool 18 places at least 300 km apart.

| Condition | Earth | Target | Target measurement | s | Reading |
|---|---:|---:|---|---:|---|
| Aridity (P/PET) | 0.781  | 0.000  | PROXY | 0.219 | different |
| Annual temperature range | 2.8 K | 11.3 K | DIRECT | 0.858 | similar |
| Elevation | 3,272.9 m | 5,702.0 m | PROXY | 0.580 | different |
| Slope | 13.0 ° | 2.4 ° | DIRECT | 0.493 | different |
| Surface roughness | 882.0 m | 263.2 m | DIRECT | 0.588 | different |
| Day–night surface temperature swing | 17.8 K | 75.9 K | DIRECT | 0.298 | different |

- **Similar:** Annual temperature range. **Different:** Aridity (P/PET), Day–night surface temperature swing, Slope, Elevation, Surface roughness. **Not assessed:** none.
- **Novelty:** outside_rare (rarity percentile 100, unlike listed sites percentile 100, 840 km from the nearest listed site).
- **Environmental pattern:** group 1 (cold · semi_arid · high_relief), unusual-combination percentile 100.
- **terrain module:** elevation = 3272.9; slope = 13.03; surface_roughness = 881.98; landform_class = high_mountains.
- **thermal module:** lst_day_k = 294.3; lst_night_k = 276.54; lst_diurnal_range = 17.77; lst_dr_iav_k = 1.5; t2m_mean_c = 10.22.
- **illumination module:** toa_annual_wm2 = 402; polar_night_months = 0.
- **hydro_cryo module:** aridity_class = humid; dry_months = 0; precip_cv = 0.6; freeze_months = 0; ft_air_months = 0; maat_below_zero = 0.
- **Blocked modules (no data):** geology, mineralogy, atmosphere_dust, biology.

## Surprise me · Hidden combination, draw 1: Antarctica for Jezero Crater

- **Earth location:** Antarctica, cell 14950, centre -77.50°, 163.750° (0.5° × 0.625° cell, about 55 km).
- **Target:** Jezero Crater (mars_jezero).
- **Weighted similarity:** 59.3 %; **weight coverage:** 100 %; mode pool 6 places at least 300 km apart.

| Condition | Earth | Target | Target measurement | s | Reading |
|---|---:|---:|---|---:|---|
| Aridity (P/PET) | 0.363  | 0.000  | PROXY | 0.637 | partly similar |
| Annual temperature range | 22.8 K | 11.3 K | DIRECT | 0.808 | partly similar |
| Elevation | 142.6 m | 5,702.0 m | PROXY | 0.038 | different |
| Slope | 2.8 ° | 2.4 ° | DIRECT | 0.982 | similar |
| Surface roughness | 227.5 m | 263.2 m | DIRECT | 0.976 | similar |
| Day–night surface temperature swing | 2.9 K | 75.9 K | DIRECT | 0.118 | different |

- **Similar:** Slope, Surface roughness. **Different:** Elevation, Day–night surface temperature swing. **Not assessed:** none.
- **Novelty:** near_listed (rarity percentile 99, unlike listed sites percentile 62, 40 km from the nearest listed site).
- **Environmental pattern:** group 5 (polar · humid · moderate_relief), unusual-combination percentile 98, flagged as a hidden combination.
- **terrain module:** elevation = 142.64; slope = 2.78; surface_roughness = 227.52; landform_class = mountains.
- **thermal module:** lst_day_k = 249.01; lst_night_k = 246.11; lst_diurnal_range = 2.89; lst_dr_iav_k = 0.3; t2m_mean_c = -19.19.
- **illumination module:** toa_annual_wm2 = 182; polar_night_months = 4.
- **hydro_cryo module:** aridity_class = semi_arid; dry_months = 0; precip_cv = 0.42; freeze_months = 12; ft_air_months = 0; maat_below_zero = 1.
- **Blocked modules (no data):** geology, mineralogy, atmosphere_dust, biology.

## Reading the examples

1. **Kunlun Mountains for Jezero Crater.** Strong terrain and dryness analogue (slope, roughness, aridity), different
   day–night swing (31.9 K against 75.9 K at Jezero). Elevation and aridity of the target are proxies. The matching
   conditions are the ones that matter for mobility and landing-terrain rehearsal, at cell scale only; the place is
   not a thermal-cycling analogue. Earth cannot reproduce
   Martian pressure (MEDA 634–803 Pa at Jezero), gravity or radiation. 760 km from the nearest listed analogue site.
2. **Queen Maud Mountains for the Lunar South Pole.** Terrain is similar (slope 9.7° against 10.3°, roughness 748 m
   against 958 m); thermal behaviour is not (0.6 K day–night swing during five months of polar night, against 54.7 K).
   Two conditions cannot be assessed (no P/PET in Antarctica; annual air-temperature range is not applicable on the
   Moon), so coverage is 80 % and novelty is withheld. Earth polar night is not lunar permanent shadow.
3. **An Altiplano cell for Jezero Crater** is similar only in annual temperature range (11.3 K range at Jezero; 2.8 K
   here gives s = 0.858 because the scale is the range of all Earth values). An analogue for that one question only.
4. **A Dry Valleys-area cell (Antarctica) for Jezero** is a hidden combination: each value is ordinary but the
   combination is rarer than 98 % of cells. It lies 40 km from the McMurdo Dry Valleys entry, so it is near a listed
   site, not a new site.
