# Data Integration Registry (V17)

Generated from `public/data/v17/registry.json` (built by `scripts/build_v17.py` from `data/inventory/inventory.json`, `data/v17/sources.json` and `data/v17/probe.json`).

**Access probe.** `scripts/probe_v17.py` sent one HEAD (or 1-byte ranged GET) request to each of 47 provider endpoints on 2026-11-09T16:42:57Z from the cloud build sandbox. **0 of 47 were reachable.** Every request failed at the environment's egress proxy with `Tunnel connection failed: 403 Forbidden`, before reaching the provider. This is a property of the build environment, not a statement about the providers. Package registries (PyPI, npm) were also unreachable, so no dataset could be obtained indirectly either. Nothing was downloaded.

## States

| State | Meaning | Sources |
|---|---|---:|
| `integrated_validated` | Integrated and validated: retained inputs checksum-verified, unit and range checks and reproduction tests pass. Not field validation. | 12 |
| `integrated_validation_incomplete` | Integrated, validation incomplete: in use, with a documented open validation question. | 4 |
| `acquired_awaiting_processing` | Acquired and awaiting processing. | 0 |
| `processing` | Processing in progress. | 0 |
| `access_restricted` | Access restricted or awaiting credentials. | 0 |
| `endpoint_unavailable` | Endpoint unavailable from this environment: the access attempt failed (see the recorded error). | 38 |
| `unsuitable` | Investigated but unsuitable. | 0 |
| `not_investigated` | Not yet investigated: relevant, no access attempt possible or made. | 1 |

A source is never integrated because its name appears in a file. States 1 and 2 require retained raw inputs whose SHA-256 is verified (Phase IV inventory). No V17 candidate reached state 1-4.

## Integrated sources (existing, unchanged)

| Source | Provider | Domain | Body | State | Validation |
|---|---|---|---|---|---|
| `blue_marble` BlueMarble_ShadedRelief (August 2004) | NASA Earth Observatory via GIBS | context | earth | integrated_validated | checksum, unit, range and reproduction tests |
| `dem_mars` Mars_MGS_MOLA_DEM_mosaic_global_463m | USGS Astrogeology Science Center (PDS Imaging Node / Annex mosaic) | terrain | mars | integrated_validated | checksum, unit, range and reproduction tests |
| `dem_moon` Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014 | USGS Astrogeology Science Center (PDS Imaging Node / Annex mosaic) | terrain | moon | integrated_validated | checksum, unit, range and reproduction tests |
| `diviner` Diviner polar hourly bolometric temperature maps, south, summer & wint | LRO Diviner team (UCLA) - Williams et al. 2019 | thermal | moon | integrated_validation_incomplete | open question: Diviner hour02 bin numbering is assumed to follow hour14 (hour14 = LTIM53-56 was verified; hour02 was not |
| `diviner_gcp` global_cumul_avg_cyl_*_002.tab | NASA PDS Geosciences Node (Washington University in St. Louis) | thermal | moon | integrated_validated | checksum, unit, range and reproduction tests |
| `diviner_polar` polar_{south,north}_80_{summer,winter}_tbol-hour{14,02}.grd | UCLA Diviner team (J.-P. Williams); PDS-archived counterparts exist | thermal | moon | integrated_validation_incomplete | open question: Diviner hour02 bin numbering is assumed to follow hour14 (hour14 = LTIM53-56 was verified; hour02 was not |
| `gazetteer` MARS_/MOON_nomenclature_center_pts | IAU WGPSN / USGS Astrogeology | catalogue | moon+mars | integrated_validated | checksum, unit, range and reproduction tests |
| `gmted2010` GMTED2010 mean elevation, 30 arc-second (mn30_grd) | USGS EROS / NGA | terrain | earth | integrated_validated | checksum, unit, range and reproduction tests |
| `gmted_subcell` mn30_grd | USGS EROS / NGA | terrain | earth | integrated_validated | checksum, unit, range and reproduction tests |
| `lola` LRO LOLA Global LDEM 118 m (Mar 2014) | NASA PDS / USGS Astrogeology | terrain | moon | integrated_validated | checksum, unit, range and reproduction tests |
| `meda` urn:nasa:pds:mars2020_meda, data_calibrated_env (CAL_TIRS GROUND_TEMP, | NASA PDS Atmospheres Node - Mars 2020 MEDA | atmosphere | mars | integrated_validated | checksum, unit, range and reproduction tests |
| `modis_aqua_lst` MYD11C3 MODIS/Aqua LST/Emissivity Monthly L3 Global 0.05 deg CMG (GIBS | NASA LP DAAC / MODIS; delivered through NASA GIBS | thermal | earth | integrated_validation_incomplete | open question: MODIS LST was decoded from NASA GIBS rendered imagery through the published colormap (0.6 K bins); values |
| `mola` MGS MOLA DEM mosaic global 463 m | NASA PDS / USGS Astrogeology | terrain | mars | integrated_validated | checksum, unit, range and reproduction tests |
| `nasa_power` POWER Climatology API (regional), community AG; parameters T2M, T2M_MA | NASA Langley Research Center - POWER Project | climate | earth | integrated_validation_incomplete | open question: NASA POWER climatology values were taken as served by the API; they were not cross-checked against MERRA- |
| `natural_earth` 1:50m admin-0 countries, 1:50m geography regions, 1:110m coastline | Natural Earth | context | earth | integrated_validated | checksum, unit, range and reproduction tests |
| `rems` RME_*RMD*.TAB | NASA PDS Atmospheres Node (REMS team: CAB, Spain) | atmosphere | mars | integrated_validated | checksum, unit, range and reproduction tests |

## Not integrated: endpoint unavailable from this environment

Existing Phase IV candidates (`phase4_inventory`) and the V17 candidates (`v17_candidate`). Resolution and access are nominal values from provider documentation and were not re-verified (the hosts were unreachable).

| Source | Provider | Domain | Body | Nominal resolution | Access | Probe result |
|---|---|---|---|---|---|---|
| `terraclimate` TerraClimate (monthly climate and water balance, 1/24°) (phase4_inventory) | University of Idaho (Abatzoglou et al. 2018) | climate | earth | - | see note | HEAD https://climate.northwestknowledge.net/TERRACLIMATE-DATA/: Tunnel connection failed: 403 Forbidden |
| `era5` ERA5 monthly single-level reanalysis (phase4_inventory) | ECMWF / Copernicus C3S | climate | earth | - | see note | HEAD https://cds.climate.copernicus.eu/api/catalogue/v1/collections/reanalysis-era5-single-levels-monthly-means: Tunnel connection failed: 403 Forbidden |
| `merra2` MERRA-2 monthly files (phase4_inventory) | NASA GMAO / GES DISC | climate | earth | - | see note | HEAD https://goldsmr4.gesdisc.eosdis.nasa.gov/data/MERRA2_MONTHLY/: Tunnel connection failed: 403 Forbidden |
| `modis_lst_hdf` MYD11C3 v061 HDF science files (phase4_inventory) | NASA LP DAAC | thermal | earth | - | see note | HEAD https://e4ftl01.cr.usgs.gov/MOLA/MYD11C3.061/: Tunnel connection failed: 403 Forbidden |
| `nasadem` NASADEM (phase4_inventory) | NASA JPL / LP DAAC | terrain | earth | - | see note | HEAD https://e4ftl01.cr.usgs.gov/MEASURES/NASADEM_HGT.001/: Tunnel connection failed: 403 Forbidden |
| `srtm` SRTM GL1 v003 (phase4_inventory) | NASA / LP DAAC | terrain | earth | - | see note | HEAD https://e4ftl01.cr.usgs.gov/MEASURES/SRTMGL1.003/: Tunnel connection failed: 403 Forbidden |
| `copernicus_dem` Copernicus DEM GLO-30 (phase4_inventory) | ESA / Airbus (AWS open data) | terrain | earth | - | see note | HEAD https://copernicus-dem-30m.s3.amazonaws.com/readme.html: Tunnel connection failed: 403 Forbidden |
| `ecostress` ECOSTRESS LST (phase4_inventory) | NASA JPL / LP DAAC | thermal | earth | - | see note | HEAD https://e4ftl01.cr.usgs.gov/ECOB/ECOSTRESS/: Tunnel connection failed: 403 Forbidden |
| `viirs` VIIRS LST (VNP21) (phase4_inventory) | NASA LP DAAC | thermal | earth | - | see note | HEAD https://e4ftl01.cr.usgs.gov/VIIRS/: Tunnel connection failed: 403 Forbidden |
| `esa_worldcover` ESA WorldCover 2021 v200 (phase4_inventory) | ESA | surface | earth | - | see note | HEAD https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/: Tunnel connection failed: 403 Forbidden |
| `soilgrids` SoilGrids 2.0 (phase4_inventory) | ISRIC | surface | earth | - | see note | HEAD https://files.isric.org/soilgrids/latest/data/: Tunnel connection failed: 403 Forbidden |
| `jrc_gsw` JRC Global Surface Water (phase4_inventory) | European Commission JRC | hydrology | earth | - | see note | HEAD https://global-surface-water.appspot.com/: Tunnel connection failed: 403 Forbidden |
| `landsat` Landsat Collection 2 (phase4_inventory) | USGS | multispectral | earth | - | see note | HEAD https://landsatlook.usgs.gov/stac-server/: Tunnel connection failed: 403 Forbidden |
| `themis` Mars Odyssey THEMIS thermal inertia (phase4_inventory) | ASU / NASA PDS | thermal | mars | - | see note | HEAD https://www.mars.asu.edu/data/: Tunnel connection failed: 403 Forbidden |
| `lroc` LRO LROC mosaics (phase4_inventory) | ASU / NASA PDS | imaging | moon | - | see note | HEAD https://wms.lroc.asu.edu/lroc/: Tunnel connection failed: 403 Forbidden |
| `hirise` MRO HiRISE DTMs (phase4_inventory) | University of Arizona / NASA PDS | terrain | mars | - | see note | HEAD https://www.uahirise.org/dtm/: Tunnel connection failed: 403 Forbidden |
| `ctx` MRO CTX global mosaic (phase4_inventory) | Caltech Murray Lab / NASA PDS | imaging | mars | - | see note | HEAD https://murray-lab.caltech.edu/CTX/: Tunnel connection failed: 403 Forbidden |
| `crism` MRO CRISM spectral products (phase4_inventory) | JHU APL / NASA PDS | mineralogy | mars | - | see note | HEAD https://pds-geosciences.wustl.edu/missions/mro/crism.htm: Tunnel connection failed: 403 Forbidden |
| `mcs` MRO Mars Climate Sounder (phase4_inventory) | JPL / NASA PDS Atmospheres | atmosphere | mars | - | see note | HEAD https://atmos.nmsu.edu/data_and_services/atmospheres_data/MARS/mcs.html: Tunnel connection failed: 403 Forbidden |
| `sentinel2` Copernicus Sentinel-2 Level-2A (phase4_inventory) | ESA / Copernicus Data Space | multispectral | earth | - | see note | HEAD https://dataspace.copernicus.eu/: Tunnel connection failed: 403 Forbidden |
| `aster_gdem` ASTER Global Digital Elevation Model v3 (v17_candidate) | NASA LP DAAC / METI | terrain | earth | 1 arc-second | NASA Earthdata Login | HEAD https://e4ftl01.cr.usgs.gov/ASTT/ASTGTM.003/: Tunnel connection failed: 403 Forbidden |
| `modis_snow` MODIS/Aqua Snow Cover Monthly L3 Global 0.05Deg CMG (v17_candidate) | NASA NSIDC DAAC | cryosphere | earth | 0.05 deg | NASA Earthdata Login | HEAD https://n5eil01u.ecs.nsidc.org/MOSA/MYD10CM.061/: Tunnel connection failed: 403 Forbidden |
| `rgi_glaciers` Randolph Glacier Inventory 7.0 (v17_candidate) | GLIMS / NSIDC | cryosphere | earth | vector | open | HEAD https://daacdata.apps.nsidc.org/pub/DATASETS/nsidc0770_rgi_v7/: Tunnel connection failed: 403 Forbidden |
| `esa_cci_permafrost` Permafrost CCI ground temperature and extent (v17_candidate) | ESA Climate Change Initiative | cryosphere | earth | 1 km | open | HEAD https://catalogue.ceda.ac.uk/: Tunnel connection failed: 403 Forbidden |
| `modis_aerosol` MODIS Aerosol Optical Depth (MAIAC MCD19A2 / Dark Target-Dee (v17_candidate) | NASA LP DAAC | atmosphere | earth | 1 km | NASA Earthdata Login | HEAD https://e4ftl01.cr.usgs.gov/MOTA/MCD19A2.061/: Tunnel connection failed: 403 Forbidden |
| `merra2_aerosol` MERRA-2 tavgM_2d_aer_Nx aerosol diagnostics (incl. dust AOD  (v17_candidate) | NASA GMAO / GES DISC | atmosphere | earth | 0.5 x 0.625 deg | NASA Earthdata Login | HEAD https://goldsmr4.gesdisc.eosdis.nasa.gov/data/MERRA2_MONTHLY/: Tunnel connection failed: 403 Forbidden |
| `merra2_wind` MERRA-2 tavgM_2d_slv_Nx near-surface wind (v17_candidate) | NASA GMAO / GES DISC | atmosphere | earth | 0.5 x 0.625 deg | NASA Earthdata Login | HEAD https://goldsmr4.gesdisc.eosdis.nasa.gov/data/MERRA2_MONTHLY/: Tunnel connection failed: 403 Forbidden |
| `calipso` CALIPSO CALIOP Level 3 aerosol profiles (v17_candidate) | NASA ASDC | atmosphere | earth | - | NASA Earthdata Login | HEAD https://asdc.larc.nasa.gov/: Tunnel connection failed: 403 Forbidden |
| `modis_vegetation` MODIS/Aqua Vegetation Indices Monthly L3 Global 0.05Deg CMG (v17_candidate) | NASA LP DAAC | biology | earth | 0.05 deg | NASA Earthdata Login | HEAD https://e4ftl01.cr.usgs.gov/MOLA/MYD13C2.061/: Tunnel connection failed: 403 Forbidden |
| `usgs_sgmc` State Geologic Map Compilation (SGMC) (v17_candidate) | USGS | geology | earth | vector (1:500,000 to 1:1,000,000 sources) | open | HEAD https://mrdata.usgs.gov/: Tunnel connection failed: 403 Forbidden |
| `usgs_mrds` Mineral Resources Data System (MRDS) (v17_candidate) | USGS | mineralogy | earth | points | open | HEAD https://mrdata.usgs.gov/: Tunnel connection failed: 403 Forbidden |
| `macrostrat` Macrostrat geologic map units API (v17_candidate) | Macrostrat (University of Wisconsin-Madison) | geology | earth | multi-scale compilation | open | HEAD https://macrostrat.org/api/v2/geologic_units/map: Tunnel connection failed: 403 Forbidden |
| `aster_l2` ASTER L2 Surface Reflectance / Emissivity (VNIR, SWIR, TIR) (v17_candidate) | NASA LP DAAC | mineralogy | earth | 15-90 m | NASA Earthdata Login | HEAD https://e4ftl01.cr.usgs.gov/: Tunnel connection failed: 403 Forbidden |
| `gvp_volcanoes` Volcanoes of the World (Holocene volcano list) (v17_candidate) | Smithsonian Institution Global Volcanism Program | geology | earth | points | open (terms of use apply) | HEAD https://volcano.si.edu/: Tunnel connection failed: 403 Forbidden |
| `gbif` GBIF occurrence records (v17_candidate) | GBIF | biology | earth | points | open | HEAD https://api.gbif.org/v1/occurrence/search: Tunnel connection failed: 403 Forbidden |
| `lola_illumination` LOLA polar illumination and permanent-shadow products (v17_candidate) | NASA PDS Geosciences Node (LRO LOLA team) | illumination | moon | - | open | HEAD https://pds-geosciences.wustl.edu/: Tunnel connection failed: 403 Forbidden |
| `kaguya_sldem` SLDEM2015 (LOLA + SELENE Terrain Camera) DEM (v17_candidate) | NASA PDS Geosciences Node | terrain | moon | 512 pixels per degree | open | HEAD https://pds-geosciences.wustl.edu/: Tunnel connection failed: 403 Forbidden |
| `tes_thermal_inertia` MGS TES nighttime thermal inertia (v17_candidate) | NASA PDS | thermal | mars | - | open | HEAD https://pds-geosciences.wustl.edu/: Tunnel connection failed: 403 Forbidden |

## Not yet investigated

- `cave_inventories` Earth cave and lava-tube inventories: No open, global, machine-readable cave or lava-tube inventory was identified and verified. National and club surveys exist with varying access terms.

## What would integrate the highest-value sources (outside this environment)

1. **Terrain at higher resolution** (NASADEM or Copernicus DEM GLO-30): needed for landform-scale relief, crater-like depressions and landing-terrain statistics below the 0.5 deg cell. Requires network access; NASADEM also needs a NASA Earthdata Login.
2. **Observed surface-water history** (JRC Global Surface Water): needed for the "previously wet, now dry" discovery and the water-history Surprise mode.
3. **Geological maps and volcano catalogue** (Macrostrat, USGS SGMC, Smithsonian GVP): needed for the geology module and geological Surprise modes.
4. **Aerosol and wind** (MERRA-2 aerosol and single-level wind, MODIS MAIAC AOD): needed for the dust module; MERRA-2 is the same reanalysis family already used through NASA POWER.
5. **Spectral data for mineral-group indicators** (ASTER L2, Landsat C2, Sentinel-2 L2A; CRISM for Mars): needed for the mineralogy module; results would be labelled as indicators, never identifications.
6. **Lunar illumination and permanent shadow** (LOLA polar products): needed to compare lunar polar targets with Earth polar night properly.

Each would follow the existing pipeline: acquisition job with checksums (`data/raw/...`, MANIFEST), offline processing script, registry record, then tests. Run `npm run probe:v17` again when network access is available.

