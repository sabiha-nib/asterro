# Phase IV — Catalogue, datasets and ingestion

## Catalogue

The registry holds **69 locations in 20 regions** on Mars and the Moon:

- 67 catalogue locations;
- 2 reference areas (the 55.6 km lunar polar windows).

| Body | L1 catalogued only | L2 partially characterized | L4 reproducible | Total |
|---|---:|---:|---:|---:|
| Mars | 18 | 14 | 2 | 34 |
| Moon | 20 | 1 | 14 | 35 |

A location takes the best readiness level of its analytical targets.

**Where names and coordinates come from.**

- **Gazetteer features:** the IAU/USGS Gazetteer of Planetary Nomenclature centre-point exports
  (`MARS_nomenclature_center_pts.zip`, `MOON_nomenclature_center_pts.zip`). The zip SHA-256 values
  are recorded in `data/raw/phase4/gazetteer_catalog.json`, and each location links to its
  gazetteer feature page.
- **Apollo landing sites:** NASA NSSDCA landing-site coordinates (derived from LRO images).
- **Marius Hills Pit:** the LROC Pits Atlas.
- **Polar windows:** ASTERRO definitions.

**Gazetteer matching.** The gazetteer export matched 62 of the 63 requested names. "Taurus-Littrow"
is not a gazetteer feature name, so the Apollo 17 window refers to the NSSDCA Apollo 17 site
instead. The gazetteer crater *Littrow* is a separate L1 (catalogued) entry and is not an alias.

**The 38 L1 (catalogued-only) entries have no analytical data:**

> Aeolis Mensae, Ares Vallis, Argyre Planitia, Arsia Mons, Ascraeus Mons, Chryse Planitia, Copernicus,
> Descartes (crater), Elysium Mons, Faustini, Fra Mauro (crater), Haworth, Hermite, Ina, Isidis
> Planitia, Littrow, Ma'adim Vallis, Mare Crisium, Mare Frigoris, Mare Imbrium, Mare Serenitatis,
> Mare Tranquillitatis, Marius, Mawrth Vallis, Medusae Fossae, Meridiani Planum, Montes Apenninus,
> Neretva Vallis, Nili Fossae, Nobile, Oxia Planum, Pavonis Mons, Peary, Rima Hadley, Syrtis Major
> Planum, Tharsis Montes, Tycho, de Gerlache.

## Analytical targets (33)

**Scoring-enabled — L4, 16 targets:**

- **Mars:** Jezero Crater (legacy) and Gale Crater / Curiosity exploration region (MSL REMS).
- **Moon, legacy:** Lunar South Pole.
- **Moon, Diviner polar:** Shackleton, Cabeus, Malapert Massif and the Lunar North Polar Region.
- **Moon, Diviner GCP:** Aristarchus, Marius Hills, Oceanus Procellarum, Schrödinger, Orientale,
  and the four Apollo 14/15/16/17 windows.

**Exploratory partial — L2 (terrain only), 17 targets:**

- Aeolis Mons (Mount Sharp), Elysium Planitia, Utopia Planitia, Gusev, Hellas, Valles Marineris.
- The three Olympus Mons windows.
- Arcadia, Amazonis, Noctis Labyrinthus, Schiaparelli, Endeavour.
- Planum Boreum and Planum Australe.
- Reiner Gamma.

All 17 have DIRECT slope and roughness from MOLA or LOLA. Their thermal criteria are MISSING. For
the Mars windows, no compatible thermal product was assembled. For Reiner Gamma, the Diviner GCP
bins in its window have no valid values. Their annual-range criteria are MISSING (Mars) or N/A
(Reiner Gamma, Moon).

No fingerprint was copied between locations, and a test asserts that no two targets share a
fingerprint.

## Datasets (16 registry records)

**Earth predictor stack (unchanged):**

- NASA POWER;
- MODIS Aqua LST;
- GMTED2010 (with the Phase III GMTED sub-cell product);
- Natural Earth and Blue Marble, which are context only.

**Planetary:**

- MOLA 463 m and LOLA 118 m (legacy windows);
- the Phase III MOLA and LOLA window extractions (`dem_mars`, `dem_moon`);
- Mars 2020 MEDA and MSL REMS;
- Diviner polar hourly maps (legacy and Phase III);
- the Diviner Global Cumulative Product;
- the IAU/USGS gazetteer.

Each record carries:

- provider, product, version and URL/DOI;
- retrieval timestamp, licence;
- original and processing resolution;
- coverage, units and no-data encoding;
- processing steps and checksums;
- script version, limitations and retrieval status.

## Ingestion pipeline: separated stages

1. **Catalogue discovery.** `src/phase4/pipeline/extract_raw_support.py gazetteer_export` writes the
   gazetteer records.
2. **Acquisition.** The Phase III network job (`src/phase3/pipeline/*`) and
   `extract_raw_support.py polar_support | gcp_support` retain the raw values with their checksums.
   Every read is verified against its recorded SHA-256, and the job aborts on a mismatch.
   `data/raw/phase4/MANIFEST.json` lists every retained file with its size and SHA-256.
3. **Scientific preprocessing and fingerprint generation.** `scripts/build_phase3_data.py`.
4. **Compatibility validation and readiness.** `src/registry/{readiness,verify,schema}.py`.
   Offline regeneration fails explicitly when an input is missing.
5. **Web publication.** `public/data/registry.json`, `atlas.json` and thumbnails, then
   `scripts/build_web.py`.

The network jobs run only in the acquisition stage. Ordinary analysis and every build step after
acquisition run offline.

## Pending (not acquired; the targets stay at L2, never imputed)

- **Mars LST diurnal range** for the 16 terrain-only Mars windows. This needs a documented orbital
  thermal product with a compatible day/night definition and its processing (for example THEMIS or
  TES surface temperatures). None was assembled.
- **Mars annual air-temperature range** away from rover sites. There is no measured product with a
  compatible definition.
- **Reiner Gamma thermal.** There are no valid Diviner GCP bins; another Diviner product would be
  needed.
- **Additional bodies.** None are catalogued: no verified catalogue and dataset scope was prepared
  for them.
