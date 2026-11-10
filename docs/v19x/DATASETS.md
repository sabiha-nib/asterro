# ASTERRO V19 data extension: dataset report

Generated from `public/data/v19/env/inventory.json` (129 datasets, 94 NASA, 35 from other providers) and `data/v19/x/build_report.json`. Cube: 39 variables x 76781 land cells, 5,988,918 bytes, SHA-256 `fa98e260ec178f8a…`.

States are cumulative evidence: DISCOVERED → ACCESSIBLE → DOWNLOADED → VALIDATED → PROCESSED → INTEGRATED → CACHED; or BLOCKED / REQUIRES_AUTHENTICATION when nothing was downloaded.

## Headline counts

| State | Datasets |
|---|---|
| BLOCKED | 48 |
| CACHED | 37 |
| REQUIRES_AUTHENTICATION | 32 |
| INTEGRATED | 10 |
| NOT_INVESTIGATED | 2 |

## 1. NASA datasets discovered (official metadata located): 93

| Dataset | Agency / provider | Product | Resolution | Period | State |
|---|---|---|---|---|---|
| NASA POWER climatology, WS10M (Wind Speed at 10 Meters) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter WS10M | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, WS50M (Wind Speed at 50 Meters) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter WS50M | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, WS10M_MAX (Wind Speed at 10 Meters Maximum) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter WS10M_MAX | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, U10M (Eastward Wind at 10 Meters) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter U10M | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, V10M (Northward Wind at 10 Meters) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter V10M | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, AOD_55 (Aerosol Optical Depth 55) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter AOD_55 | 1 x 1 deg (CERES SYN1deg), sampled at each cell centre | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, PS (Surface Pressure) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter PS | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, RH2M (Relative Humidity at 2 Meters) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter RH2M | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, CLOUD_AMT (Cloud Amount) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter CLOUD_AMT | 1 x 1 deg (CERES SYN1deg), sampled at each cell centre | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, GWETTOP (Surface Soil Wetness) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter GWETTOP | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, GWETROOT (Root Zone Soil Wetness) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter GWETROOT | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, ALLSKY_SRF_ALB (All Sky Surface Albedo) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter ALLSKY_SRF_ALB | 1 x 1 deg (CERES SYN1deg), sampled at each cell centre | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, ALLSKY_SFC_SW_DWN (All Sky Surface Shortwave Downward Irradiance) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter ALLSKY_SFC_SW_DWN | 1 x 1 deg (CERES SYN1deg), sampled at each cell centre | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, SNODP (Snow Depth) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter SNODP | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, FRSNO (Land Snowcover Fraction) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter FRSNO | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| MERRA-2 dust surface mass concentration, monthly (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MERRA2_Dust_Surface_Mass_Concentration_Monthly (EPSG:4326, PNG) with colormap v1.3 | source 0.625 x 0.5 Decimal Degrees; imagery requested at 1440 x 720 pixels | 2016-01 to 2025-12 | CACHED |
| MODIS Terra snow cover, monthly average (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MODIS_Terra_L3_Snow_Cover_Monthly_Average_Pct (EPSG:4326, PNG) with colormap v1.3 | source 0.05 x 0.05 Decimal Degrees; imagery requested at 3600 x 1800 pixels | 2016-01 to 2025-12 | CACHED |
| MODIS Terra Enhanced Vegetation Index, monthly (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MODIS_Terra_L3_EVI_Monthly (EPSG:4326, PNG) with colormap v1.3 | source 1000 x 1000 Meters; imagery requested at 1440 x 720 pixels | 2021-01 to 2025-12 | CACHED |
| MISR aerosol optical depth (green band), monthly (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MISR_Aerosol_Optical_Depth_Avg_Green_Monthly (EPSG:4326, PNG) with colormap v1.3 | source 0.5 x 0.5 Decimal Degrees; imagery requested at 1440 x 720 pixels | 2013-01 to 2022-12 | CACHED |
| MODIS land cover type, IGBP scheme, annual (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual (EPSG:4326, PNG) with colormap v1.3 | source 500 x 500 Meters; imagery requested at 3600 x 1800 pixels | 2024-01 to 2024-01 | CACHED |
| MODIS land/water mask (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MODIS_Terra_L3_Land_Water_Mask (EPSG:4326, PNG) with colormap v1.3 | source 250 x 250 Meters; imagery requested at 3600 x 1800 pixels | 2015-01 to 2015-01 | CACHED |
| MODIS/Terra Land Surface Temperature/Emissivity Monthly L3 Global 0.05Deg CMG V061 | NASA; LP DAAC | MOD11C3 version 061, CMR concept C2565788897-LPCLOUD | 5600 x 5600 Meters | 2000-02-01 to present | REQUIRES_AUTHENTICATION |
| MODIS/Aqua Land Surface Temperature/Emissivity Monthly L3 Global 0.05Deg CMG V061 | NASA; LP DAAC | MYD11C3 version 061, CMR concept C2565794044-LPCLOUD | 5600 x 5600 Meters | 2002-07-01 to present | REQUIRES_AUTHENTICATION |
| MODIS/Terra Snow Cover Monthly L3 Global 0.05Deg CMG V061 | NASA; NASA NSIDC DAAC | MOD10CM version 61, CMR concept C3050353608-NSIDC_CPRD | 0.05 x 0.05 Decimal Degrees | 2000-03-01 to present | REQUIRES_AUTHENTICATION |
| MODIS/Aqua Snow Cover Monthly L3 Global 0.05Deg CMG V061 | NASA; NASA NSIDC DAAC | MYD10CM version 61, CMR concept C3091267534-NSIDC_CPRD | 0.05 x 0.05 Decimal Degrees | 2002-07-04 to present | REQUIRES_AUTHENTICATION |
| MODIS/Terra+Aqua Land Cover Type Yearly L3 Global 0.05Deg CMG V061 | NASA; LP DAAC | MCD12C1 version 061, CMR concept C2484078896-LPCLOUD | 5600 x 5600 Meters | 2001-01-01 to present | REQUIRES_AUTHENTICATION |
| MODIS/Terra+Aqua Land Cover Type Yearly L3 Global 500m SIN Grid V061 | NASA; LP DAAC | MCD12Q1 version 061, CMR concept C2484079608-LPCLOUD | 500 x 500 Meters | 2001-01-01 to present | REQUIRES_AUTHENTICATION |
| MODIS/Terra Vegetation Indices Monthly L3 Global 0.05Deg CMG V061 | NASA; LP DAAC | MOD13C2 version 061, CMR concept C2565788914-LPCLOUD | 5600 x 5600 Meters | 2000-02-01 to present | REQUIRES_AUTHENTICATION |
| MODIS/Terra Vegetation Indices Monthly L3 Global 1km SIN Grid V061 | NASA; LP DAAC | MOD13A3 version 061, CMR concept C2327962326-LPCLOUD | 1000 x 1000 Meters | 2000-02-01 to present | REQUIRES_AUTHENTICATION |
| MODIS/Terra+Aqua BRDF/Albedo Albedo Daily L3 Global 0.05Deg CMG V061 | NASA; LP DAAC | MCD43C3 version 061, CMR concept C2532068039-LPCLOUD | 5600 x 5600 Meters | 2000-02-16 to present | REQUIRES_AUTHENTICATION |
| MODIS/Terra Aerosol Cloud Water Vapor Ozone Monthly L3 Global 1Deg CMG | NASA; NASA/GSFC/SED/ESD/HBSL/BISB/LAADS | MOD08_M3 version 6.1, CMR concept C1443766359-LAADS | 1 x 1 Decimal Degrees | 2000-02-01 to present | REQUIRES_AUTHENTICATION |
| MODIS/Aqua Aerosol Cloud Water Vapor Ozone Monthly L3 Global 1Deg CMG | NASA; NASA/GSFC/SED/ESD/HBSL/BISB/LAADS | MYD08_M3 version 6.1, CMR concept C1443775657-LAADS | 1 x 1 Decimal Degrees | 2002-07-01 to present | REQUIRES_AUTHENTICATION |
| MODIS/Terra Land Water Mask Derived from MODIS and SRTM L3 Global 250m SIN Grid V061 | NASA; LP DAAC | MOD44W version 061, CMR concept C2565805847-LPCLOUD | 250 x 250 Meters | 2000-01-01 to present | REQUIRES_AUTHENTICATION |
| MISR Level 3 Component Global Aerosol product in netCDF format covering a month V004 | NASA; NASA/LARC/SD/ASDC | MIL3MAEN version 004, CMR concept C2873771604-LARC_CLOUD | 0.5 x 0.5 Decimal Degrees | 1999-12-18 to present | REQUIRES_AUTHENTICATION |
| MERRA-2 tavgM_2d_slv_Nx: 2d,Monthly mean,Time-Averaged,Single-Level,Assimilation,Single-Level Diagnostics 0.625 x 0.5 degree V5.12.4 (M2TMNXSLV)  | NASA; NASA/GSFC/SED/ESD/TISL/GESDISC | M2TMNXSLV version 5.12.4, CMR concept C1276812859-GES_DISC | 0.625 x 0.5 Decimal Degrees | 1980-01-01 to present | REQUIRES_AUTHENTICATION |
| MERRA-2 tavgM_2d_aer_Nx: 2d,Monthly mean,Time-averaged,Single-Level,Assimilation,Aerosol Diagnostics 0.625 x 0.5 degree V5.12.4 (M2TMNXAER)  | NASA; NASA/GSFC/SED/ESD/TISL/GESDISC | M2TMNXAER version 5.12.4, CMR concept C1276812866-GES_DISC | 0.625 x 0.5 Decimal Degrees | 1980-01-01 to present | REQUIRES_AUTHENTICATION |
| MERRA-2 tavgM_2d_lnd_Nx: 2d,Monthly mean,Time-Averaged,Single-Level,Assimilation,Land Surface Diagnostics 0.625 x 0.5 degree V5.12.4 (M2TMNXLND)  | NASA; NASA/GSFC/SED/ESD/TISL/GESDISC | M2TMNXLND version 5.12.4, CMR concept C1276812856-GES_DISC | 0.625 x 0.5 Decimal Degrees | 1980-01-01 to present | REQUIRES_AUTHENTICATION |
| GPM IMERG Final Precipitation L3 1 month 0.1 degree x 0.1 degree V07 (GPM_3IMERGM) | NASA; NASA/GSFC/SED/ESD/TISL/GESDISC | GPM_3IMERGM version 07, CMR concept C2723754851-GES_DISC | – | 1998-01-01 to 2025-09-30 | REQUIRES_AUTHENTICATION |
| GLDAS Noah Land Surface Model L4 monthly 0.25 x 0.25 degree V2.1 (GLDAS_NOAH025_M) | NASA; NASA/GSFC/SED/ESD/TISL/GESDISC | GLDAS_NOAH025_M version 2.1, CMR concept C1342986036-GES_DISC | 0.25 x 0.25 Decimal Degrees | 2000-01-01 to present | REQUIRES_AUTHENTICATION |
| SMAP L4 Global 3-hourly 9 km EASE-Grid Surface and Root Zone Soil Moisture Geophysical Data V008 | NASA; NASA NSIDC DAAC | SPL4SMGP version 008, CMR concept C3480440870-NSIDC_CPRD | 9.0 x 9.0 Kilometers | 2015-03-31 to present | REQUIRES_AUTHENTICATION |
| NASADEM Merged DEM Global 1 arc second V001 | NASA; LP DAAC | NASADEM_HGT version 001, CMR concept C2763264762-LPCLOUD | 30 x 30 Meters | 2000-02-11 to 2000-02-21 | REQUIRES_AUTHENTICATION |
| NASA Shuttle Radar Topography Mission Global 1 arc second V003 | NASA; LP DAAC | SRTMGL1 version 003, CMR concept C2763266360-LPCLOUD | 30 x 30 Meters | 2000-02-11 to 2000-02-21 | REQUIRES_AUTHENTICATION |
| ASTER Global Digital Elevation Model V003 | NASA; LP DAAC | ASTGTM version 003, CMR concept C1711961296-LPCLOUD | 30 x 30 Meters | 2000-03-01 to 2013-11-30 | REQUIRES_AUTHENTICATION |
| ASTER Global Emissivity Dataset, 100 meter, HDF5 V003 | NASA; LP DAAC | AG100 version 003, CMR concept C2763266348-LPCLOUD | 100 x 100 Meters | 2000-01-01 to 2008-12-31 | REQUIRES_AUTHENTICATION |
| ASTER Global Emissivity Dataset, Monthly, 0.05 deg, HDF5 V041 | NASA; LP DAAC | AG5KMMOH version 041, CMR concept C2763268461-LPCLOUD | 5600 x 5600 Meters | 2000-03-01 to 2015-12-31 | REQUIRES_AUTHENTICATION |
| EMIT L2B Estimated Mineral Identification and Band Depth and Uncertainty 60 m V002 | NASA; LP DAAC | EMITL2BMIN version 002, CMR concept C4079846859-LPCLOUD | 60 x 60 Meters | 2022-08-09 to present | REQUIRES_AUTHENTICATION |
| ECOSTRESS Tiled Land Surface Temperature and Emissivity Instantaneous L2 Global 70 m V003 | NASA; LP DAAC | ECO_L2T_LSTE version 003, CMR concept C3998139651-LPCLOUD | 70 x 70 Meters | 2018-07-09 to present | REQUIRES_AUTHENTICATION |
| VIIRS/NPP Land Surface Temperature/Emissivity Daily L3 Global 1km SIN Grid Day V002 | NASA; LP DAAC | VNP21A1D version 002, CMR concept C2545314555-LPCLOUD | 1000 x 1000 Meters | 2012-01-17 to present | REQUIRES_AUTHENTICATION |
| Randolph Glacier Inventory - A Dataset of Global Glacier Outlines, Version 7 | NASA; NASA NSIDC DAAC | NSIDC-0770 version 7, CMR concept C2768953486-NSIDCV0 | VariesResolution | 1950-01-01 to 2021-12-31 | REQUIRES_AUTHENTICATION |
| GLIMS Glacier Database, Version 1 | NASA; NASA NSIDC DAAC | NSIDC-0272 version 1, CMR concept C1386250255-NSIDCV0 | VariesResolution | 1850-01-01 to present | REQUIRES_AUTHENTICATION |
| OPERA Dynamic Surface Water Extent from Harmonized Landsat Sentinel-2 product (Version 1) | NASA; NASA/JPL/PODAAC | OPERA_L3_DSWX-HLS_V1 version 1.0, CMR concept C2617126679-POCLOUD | 30 x 30 Meters | 2016-01-01 to present | REQUIRES_AUTHENTICATION |
| CALIPSO Lidar Level 3 Tropospheric Aerosol Profiles, All Sky Data, Standard V4-20 | NASA; NASA/LARC/SD/ASDC | CAL_LID_L3_Tropospheric_APro_AllSky-Standard-V4-20 version V4-20, CMR concept C3880523630-LARC_CLOUD | – | 2006-06-01 to 2020-08-01 | REQUIRES_AUTHENTICATION |
| MODIS/Terra+Aqua Land Aerosol Optical Depth Daily L2G Global 1km SIN Grid V061 | NASA; LP DAAC | MCD19A2 version 061, CMR concept C2324689816-LPCLOUD | 1000 x 1000 Meters | 2000-02-24 to present | REQUIRES_AUTHENTICATION |
| BlueMarble_ShadedRelief (August 2004) | NASA; NASA Earth Observatory via GIBS | GIBS layer | 2048 x 1024 px render | 2004 | CACHED |
| Mars_MGS_MOLA_DEM_mosaic_global_463m | NASA; USGS Astrogeology Science Center (PDS Imaging Node / Annex mosaic) | {"etag": "\"cccf7001294ee9f503b13318eab83086-254\"", "last-modified": "Thu, 10 Nov 2022 03:31:07 GMT", "content-length": "2125771142"} | 463 m | MGS 1997-2006 | CACHED |
| Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014 | NASA; USGS Astrogeology Science Center (PDS Imaging Node / Annex mosaic) | {"etag": "\"722bebaeb337b9afc8b24ae5bd817aa3-1013\"", "last-modified": "Tue, 08 Nov 2022 23:01:12 GMT", "content-length": "8494203833"} | 118 m | LRO 2009-2013 (LOLA) | CACHED |
| Diviner polar hourly bolometric temperature maps, south, summer & winter (hour02, hour14) | NASA; LRO Diviner team (UCLA) - Williams et al. 2019 | level4_polar hourly_maps (2009-07-05 to 2019-02-17) | 240 m polar stereographic | 2009-2019 | INTEGRATED |
| global_cumul_avg_cyl_*_002.tab | NASA; NASA PDS Geosciences Node (Washington University in St. Louis) | PRODUCT_VERSION_ID 1 | 0.5 deg x 0.5 deg x 0.25 h local time | 2009-07-05 to 2015-04-01 | CACHED |
| polar_{south,north}_80_{summer,winter}_tbol-hour{14,02}.grd | NASA; UCLA Diviner team (J.-P. Williams); PDS-archived counterparts exist | files as listed with ETag / Last-Modified | 240 m | 2009-07-05 to 2019-02-17 (per product description) | INTEGRATED |
| LRO LOLA Global LDEM 118 m (Mar 2014) | NASA; NASA PDS / USGS Astrogeology | Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014 | 118 m | LRO 2009-2013 | CACHED |
| urn:nasa:pds:mars2020_meda, data_calibrated_env (CAL_TIRS GROUND_TEMP, CAL_ATS, CAL_PS) | NASA; NASA PDS Atmospheres Node - Mars 2020 MEDA | Bundle 6.0, doi:10.17189/1522849 | Rover point measurements (~1 Hz) | Sols 8-676 (every 2nd sol; one Mars year) | CACHED |
| MYD11C3 MODIS/Aqua LST/Emissivity Monthly L3 Global 0.05 deg CMG (GIBS layers MODIS_Aqua_L3_Land_Surface_Temp_Monthly_Day / _Night) | NASA; NASA LP DAAC / MODIS; delivered through NASA GIBS | Collections 006 / 061 as served by GIBS | rendered at 0.1 deg, aggregated to 0.5 x 0.625 deg | 2016-01 to 2025-12, 120 monthly day/night pairs | INTEGRATED |
| MGS MOLA DEM mosaic global 463 m | NASA; NASA PDS / USGS Astrogeology | Mars_MGS_MOLA_DEM_mosaic_global_463m | 463 m | MGS mission 1997-2006 | CACHED |
| POWER Climatology API (regional), community AG; parameters T2M, T2M_MAX_AVG, T2M_MIN_AVG, PRECTOTCORR | NASA; NASA Langley Research Center - POWER Project | API v2.10.0; source MERRA-2 | 0.5 deg lat x 0.625 deg lon (MERRA-2 native) | 2001-01-01 to 2020-12-31 monthly climatology | INTEGRATED |
| RME_*RMD*.TAB | NASA; NASA PDS Atmospheres Node (REMS team: CAB, Spain) | product versions as listed per sol | 1 Hz samples; 24 LTST hour bins | sols 1-669 (every 2nd available sol; one Mars year) | CACHED |
| MERRA-2 monthly files | NASA; NASA GMAO / GES DISC | – | – | – | BLOCKED |
| MYD11C3 v061 HDF science files | NASA; NASA LP DAAC | – | – | – | BLOCKED |
| NASADEM | NASA; NASA JPL / LP DAAC | – | – | – | BLOCKED |
| SRTM GL1 v003 | NASA; NASA / LP DAAC | – | – | – | BLOCKED |
| ECOSTRESS LST | NASA; NASA JPL / LP DAAC | – | – | – | BLOCKED |
| VIIRS LST (VNP21) | NASA; NASA LP DAAC | – | – | – | BLOCKED |
| Mars Odyssey THEMIS thermal inertia | NASA; ASU / NASA PDS | – | – | – | BLOCKED |
| LRO LROC mosaics | NASA; ASU / NASA PDS | – | – | – | BLOCKED |
| MRO HiRISE DTMs | NASA; University of Arizona / NASA PDS | – | – | – | BLOCKED |
| MRO CTX global mosaic | NASA; Caltech Murray Lab / NASA PDS | – | – | – | BLOCKED |
| MRO CRISM spectral products | NASA; JHU APL / NASA PDS | – | – | – | BLOCKED |
| MRO Mars Climate Sounder | NASA; JPL / NASA PDS Atmospheres | – | – | – | BLOCKED |
| ASTER Global Digital Elevation Model v3 | NASA; NASA LP DAAC / METI | ASTGTM.003 | 1 arc-second | 2000-2013 composite | BLOCKED |
| MODIS/Aqua Snow Cover Monthly L3 Global 0.05Deg CMG | NASA; NASA NSIDC DAAC | MYD10CM.061 | 0.05 deg | monthly, 2002-present | BLOCKED |
| MODIS Aerosol Optical Depth (MAIAC MCD19A2 / Dark Target-Deep Blue) | NASA; NASA LP DAAC | MCD19A2.061 | 1 km | daily | BLOCKED |
| MERRA-2 tavgM_2d_aer_Nx aerosol diagnostics (incl. dust AOD and dust deposition, modelled) | NASA; NASA GMAO / GES DISC | M2TMNXAER.5.12.4 | 0.5 x 0.625 deg | monthly, 1980-present | BLOCKED |
| MERRA-2 tavgM_2d_slv_Nx near-surface wind | NASA; NASA GMAO / GES DISC | M2TMNXSLV.5.12.4 | 0.5 x 0.625 deg | monthly | BLOCKED |
| CALIPSO CALIOP Level 3 aerosol profiles | NASA; NASA ASDC | – | – | 2006-2023 | BLOCKED |
| MODIS/Aqua Vegetation Indices Monthly L3 Global 0.05Deg CMG | NASA; NASA LP DAAC | MYD13C2.061 | 0.05 deg | monthly | BLOCKED |
| ASTER L2 Surface Reflectance / Emissivity (VNIR, SWIR, TIR) | NASA; NASA LP DAAC | AST_07XT / AST_05 | 15-90 m | scene-based, 2000-2008 for SWIR | BLOCKED |
| LOLA polar illumination and permanent-shadow products | NASA; NASA PDS Geosciences Node (LRO LOLA team) | – | – | multi-year simulation | BLOCKED |
| SLDEM2015 (LOLA + SELENE Terrain Camera) DEM | NASA; NASA PDS Geosciences Node | SLDEM2015 | 512 pixels per degree | – | BLOCKED |
| MGS TES nighttime thermal inertia | NASA; NASA PDS | – | – | – | BLOCKED |
| POWER Climatology API v2 (source: MERRA-2) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2 (source: MERRA-2) | 0.5° × 0.625° (MERRA-2 native) | monthly and annual climatology, 2001–2020 | BLOCKED |
| MODIS aerosol optical depth layers (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services | MODIS aerosol optical depth layers (GIBS) | rendered imagery; native product resolution per layer | per layer (daily/monthly) | BLOCKED |
| M2TMNXAER (MERRA-2 tavgM_2d_aer_Nx) | NASA; NASA GES DISC | M2TMNXAER (MERRA-2 tavgM_2d_aer_Nx) | 0.5° × 0.625° | monthly, 1980–present | BLOCKED |
| MRO Mars Climate Sounder derived data | NASA; NASA PDS Atmospheres Node | MRO Mars Climate Sounder derived data | profiles | 2006–present | BLOCKED |
| MRO CRISM MTRDR / summary products | NASA; NASA PDS Geosciences Node | MRO CRISM MTRDR / summary products | ≈ 18 m/pixel (targeted) | 2006– | BLOCKED |

## 2. NASA datasets downloaded: 21

| Dataset | Agency / provider | Product | Resolution | Period | State |
|---|---|---|---|---|---|
| NASA POWER climatology, WS10M (Wind Speed at 10 Meters) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter WS10M | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, WS50M (Wind Speed at 50 Meters) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter WS50M | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, WS10M_MAX (Wind Speed at 10 Meters Maximum) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter WS10M_MAX | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, U10M (Eastward Wind at 10 Meters) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter U10M | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, V10M (Northward Wind at 10 Meters) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter V10M | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, AOD_55 (Aerosol Optical Depth 55) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter AOD_55 | 1 x 1 deg (CERES SYN1deg), sampled at each cell centre | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, PS (Surface Pressure) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter PS | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, RH2M (Relative Humidity at 2 Meters) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter RH2M | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, CLOUD_AMT (Cloud Amount) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter CLOUD_AMT | 1 x 1 deg (CERES SYN1deg), sampled at each cell centre | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, GWETTOP (Surface Soil Wetness) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter GWETTOP | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, GWETROOT (Root Zone Soil Wetness) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter GWETROOT | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, ALLSKY_SRF_ALB (All Sky Surface Albedo) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter ALLSKY_SRF_ALB | 1 x 1 deg (CERES SYN1deg), sampled at each cell centre | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, ALLSKY_SFC_SW_DWN (All Sky Surface Shortwave Downward Irradiance) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter ALLSKY_SFC_SW_DWN | 1 x 1 deg (CERES SYN1deg), sampled at each cell centre | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, SNODP (Snow Depth) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter SNODP | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, FRSNO (Land Snowcover Fraction) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter FRSNO | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| MERRA-2 dust surface mass concentration, monthly (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MERRA2_Dust_Surface_Mass_Concentration_Monthly (EPSG:4326, PNG) with colormap v1.3 | source 0.625 x 0.5 Decimal Degrees; imagery requested at 1440 x 720 pixels | 2016-01 to 2025-12 | CACHED |
| MODIS Terra snow cover, monthly average (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MODIS_Terra_L3_Snow_Cover_Monthly_Average_Pct (EPSG:4326, PNG) with colormap v1.3 | source 0.05 x 0.05 Decimal Degrees; imagery requested at 3600 x 1800 pixels | 2016-01 to 2025-12 | CACHED |
| MODIS Terra Enhanced Vegetation Index, monthly (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MODIS_Terra_L3_EVI_Monthly (EPSG:4326, PNG) with colormap v1.3 | source 1000 x 1000 Meters; imagery requested at 1440 x 720 pixels | 2021-01 to 2025-12 | CACHED |
| MISR aerosol optical depth (green band), monthly (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MISR_Aerosol_Optical_Depth_Avg_Green_Monthly (EPSG:4326, PNG) with colormap v1.3 | source 0.5 x 0.5 Decimal Degrees; imagery requested at 1440 x 720 pixels | 2013-01 to 2022-12 | CACHED |
| MODIS land cover type, IGBP scheme, annual (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual (EPSG:4326, PNG) with colormap v1.3 | source 500 x 500 Meters; imagery requested at 3600 x 1800 pixels | 2024-01 to 2024-01 | CACHED |
| MODIS land/water mask (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MODIS_Terra_L3_Land_Water_Mask (EPSG:4326, PNG) with colormap v1.3 | source 250 x 250 Meters; imagery requested at 3600 x 1800 pixels | 2015-01 to 2015-01 | CACHED |

## 3. NASA datasets validated in this release: 21

| Dataset | Agency / provider | Product | Resolution | Period | State |
|---|---|---|---|---|---|
| NASA POWER climatology, WS10M (Wind Speed at 10 Meters) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter WS10M | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, WS50M (Wind Speed at 50 Meters) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter WS50M | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, WS10M_MAX (Wind Speed at 10 Meters Maximum) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter WS10M_MAX | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, U10M (Eastward Wind at 10 Meters) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter U10M | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, V10M (Northward Wind at 10 Meters) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter V10M | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, AOD_55 (Aerosol Optical Depth 55) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter AOD_55 | 1 x 1 deg (CERES SYN1deg), sampled at each cell centre | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, PS (Surface Pressure) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter PS | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, RH2M (Relative Humidity at 2 Meters) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter RH2M | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, CLOUD_AMT (Cloud Amount) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter CLOUD_AMT | 1 x 1 deg (CERES SYN1deg), sampled at each cell centre | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, GWETTOP (Surface Soil Wetness) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter GWETTOP | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, GWETROOT (Root Zone Soil Wetness) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter GWETROOT | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, ALLSKY_SRF_ALB (All Sky Surface Albedo) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter ALLSKY_SRF_ALB | 1 x 1 deg (CERES SYN1deg), sampled at each cell centre | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, ALLSKY_SFC_SW_DWN (All Sky Surface Shortwave Downward Irradiance) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter ALLSKY_SFC_SW_DWN | 1 x 1 deg (CERES SYN1deg), sampled at each cell centre | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, SNODP (Snow Depth) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter SNODP | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, FRSNO (Land Snowcover Fraction) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter FRSNO | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| MERRA-2 dust surface mass concentration, monthly (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MERRA2_Dust_Surface_Mass_Concentration_Monthly (EPSG:4326, PNG) with colormap v1.3 | source 0.625 x 0.5 Decimal Degrees; imagery requested at 1440 x 720 pixels | 2016-01 to 2025-12 | CACHED |
| MODIS Terra snow cover, monthly average (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MODIS_Terra_L3_Snow_Cover_Monthly_Average_Pct (EPSG:4326, PNG) with colormap v1.3 | source 0.05 x 0.05 Decimal Degrees; imagery requested at 3600 x 1800 pixels | 2016-01 to 2025-12 | CACHED |
| MODIS Terra Enhanced Vegetation Index, monthly (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MODIS_Terra_L3_EVI_Monthly (EPSG:4326, PNG) with colormap v1.3 | source 1000 x 1000 Meters; imagery requested at 1440 x 720 pixels | 2021-01 to 2025-12 | CACHED |
| MISR aerosol optical depth (green band), monthly (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MISR_Aerosol_Optical_Depth_Avg_Green_Monthly (EPSG:4326, PNG) with colormap v1.3 | source 0.5 x 0.5 Decimal Degrees; imagery requested at 1440 x 720 pixels | 2013-01 to 2022-12 | CACHED |
| MODIS land cover type, IGBP scheme, annual (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual (EPSG:4326, PNG) with colormap v1.3 | source 500 x 500 Meters; imagery requested at 3600 x 1800 pixels | 2024-01 to 2024-01 | CACHED |
| MODIS land/water mask (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MODIS_Terra_L3_Land_Water_Mask (EPSG:4326, PNG) with colormap v1.3 | source 250 x 250 Meters; imagery requested at 3600 x 1800 pixels | 2015-01 to 2015-01 | CACHED |

## 4. NASA datasets integrated in this release: 21

| Dataset | Agency / provider | Product | Resolution | Period | State |
|---|---|---|---|---|---|
| NASA POWER climatology, WS10M (Wind Speed at 10 Meters) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter WS10M | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, WS50M (Wind Speed at 50 Meters) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter WS50M | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, WS10M_MAX (Wind Speed at 10 Meters Maximum) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter WS10M_MAX | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, U10M (Eastward Wind at 10 Meters) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter U10M | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, V10M (Northward Wind at 10 Meters) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter V10M | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, AOD_55 (Aerosol Optical Depth 55) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter AOD_55 | 1 x 1 deg (CERES SYN1deg), sampled at each cell centre | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, PS (Surface Pressure) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter PS | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, RH2M (Relative Humidity at 2 Meters) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter RH2M | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, CLOUD_AMT (Cloud Amount) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter CLOUD_AMT | 1 x 1 deg (CERES SYN1deg), sampled at each cell centre | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, GWETTOP (Surface Soil Wetness) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter GWETTOP | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, GWETROOT (Root Zone Soil Wetness) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter GWETROOT | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, ALLSKY_SRF_ALB (All Sky Surface Albedo) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter ALLSKY_SRF_ALB | 1 x 1 deg (CERES SYN1deg), sampled at each cell centre | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, ALLSKY_SFC_SW_DWN (All Sky Surface Shortwave Downward Irradiance) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter ALLSKY_SFC_SW_DWN | 1 x 1 deg (CERES SYN1deg), sampled at each cell centre | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, SNODP (Snow Depth) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter SNODP | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| NASA POWER climatology, FRSNO (Land Snowcover Fraction) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2.10.1, regional endpoint, community RE, parameter FRSNO | 0.5 x 0.625 deg (MERRA-2 native, the ASTERRO grid) | 2001-01 to 2025-12 | CACHED |
| MERRA-2 dust surface mass concentration, monthly (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MERRA2_Dust_Surface_Mass_Concentration_Monthly (EPSG:4326, PNG) with colormap v1.3 | source 0.625 x 0.5 Decimal Degrees; imagery requested at 1440 x 720 pixels | 2016-01 to 2025-12 | CACHED |
| MODIS Terra snow cover, monthly average (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MODIS_Terra_L3_Snow_Cover_Monthly_Average_Pct (EPSG:4326, PNG) with colormap v1.3 | source 0.05 x 0.05 Decimal Degrees; imagery requested at 3600 x 1800 pixels | 2016-01 to 2025-12 | CACHED |
| MODIS Terra Enhanced Vegetation Index, monthly (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MODIS_Terra_L3_EVI_Monthly (EPSG:4326, PNG) with colormap v1.3 | source 1000 x 1000 Meters; imagery requested at 1440 x 720 pixels | 2021-01 to 2025-12 | CACHED |
| MISR aerosol optical depth (green band), monthly (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MISR_Aerosol_Optical_Depth_Avg_Green_Monthly (EPSG:4326, PNG) with colormap v1.3 | source 0.5 x 0.5 Decimal Degrees; imagery requested at 1440 x 720 pixels | 2013-01 to 2022-12 | CACHED |
| MODIS land cover type, IGBP scheme, annual (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual (EPSG:4326, PNG) with colormap v1.3 | source 500 x 500 Meters; imagery requested at 3600 x 1800 pixels | 2024-01 to 2024-01 | CACHED |
| MODIS land/water mask (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services (GIBS) | GIBS WMS layer MODIS_Terra_L3_Land_Water_Mask (EPSG:4326, PNG) with colormap v1.3 | source 250 x 250 Meters; imagery requested at 3600 x 1800 pixels | 2015-01 to 2015-01 | CACHED |

## 5. Non-NASA datasets acquired in this release: 4

| Dataset | Agency / provider | Product | Resolution | Period | State |
|---|---|---|---|---|---|
| Smithsonian GVP Holocene volcano list (complete) | Smithsonian Institution (not NASA); Global Volcanism Program, National Museum of Natural History | Volcanoes of the World: GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes (WFS 2.0, GeoJSON) | points (summit or field centre) | Holocene (last ~11,700 years) | CACHED |
| Smithsonian GVP Pleistocene volcano list (complete) | Smithsonian Institution (not NASA); Global Volcanism Program, National Museum of Natural History | Volcanoes of the World: GVP-VOTW:Smithsonian_VOTW_Pleistocene_Volcanoes (WFS 2.0, GeoJSON) | points (summit or field centre) | Pleistocene | CACHED |
| Macrostrat geological map units at 101 cells | Macrostrat, University of Wisconsin-Madison (not NASA); Macrostrat, University of Wisconsin-Madison | https://macrostrat.org/api/v2/geologic_units/map | cell centre point query | as published | CACHED |
| GBIF occurrence counts at 101 cells | GBIF Secretariat (not NASA); GBIF Secretariat | https://api.gbif.org/v1/occurrence/search | the 0.5 x 0.625 deg cell | as published | CACHED |

## 9a. Datasets that need authentication (provider metadata): 32

| Dataset | Agency / provider | Product | Resolution | Period | State |
|---|---|---|---|---|---|
| MODIS/Terra Land Surface Temperature/Emissivity Monthly L3 Global 0.05Deg CMG V061 | NASA; LP DAAC | MOD11C3 version 061, CMR concept C2565788897-LPCLOUD | 5600 x 5600 Meters | 2000-02-01 to present | REQUIRES_AUTHENTICATION |
| MODIS/Aqua Land Surface Temperature/Emissivity Monthly L3 Global 0.05Deg CMG V061 | NASA; LP DAAC | MYD11C3 version 061, CMR concept C2565794044-LPCLOUD | 5600 x 5600 Meters | 2002-07-01 to present | REQUIRES_AUTHENTICATION |
| MODIS/Terra Snow Cover Monthly L3 Global 0.05Deg CMG V061 | NASA; NASA NSIDC DAAC | MOD10CM version 61, CMR concept C3050353608-NSIDC_CPRD | 0.05 x 0.05 Decimal Degrees | 2000-03-01 to present | REQUIRES_AUTHENTICATION |
| MODIS/Aqua Snow Cover Monthly L3 Global 0.05Deg CMG V061 | NASA; NASA NSIDC DAAC | MYD10CM version 61, CMR concept C3091267534-NSIDC_CPRD | 0.05 x 0.05 Decimal Degrees | 2002-07-04 to present | REQUIRES_AUTHENTICATION |
| MODIS/Terra+Aqua Land Cover Type Yearly L3 Global 0.05Deg CMG V061 | NASA; LP DAAC | MCD12C1 version 061, CMR concept C2484078896-LPCLOUD | 5600 x 5600 Meters | 2001-01-01 to present | REQUIRES_AUTHENTICATION |
| MODIS/Terra+Aqua Land Cover Type Yearly L3 Global 500m SIN Grid V061 | NASA; LP DAAC | MCD12Q1 version 061, CMR concept C2484079608-LPCLOUD | 500 x 500 Meters | 2001-01-01 to present | REQUIRES_AUTHENTICATION |
| MODIS/Terra Vegetation Indices Monthly L3 Global 0.05Deg CMG V061 | NASA; LP DAAC | MOD13C2 version 061, CMR concept C2565788914-LPCLOUD | 5600 x 5600 Meters | 2000-02-01 to present | REQUIRES_AUTHENTICATION |
| MODIS/Terra Vegetation Indices Monthly L3 Global 1km SIN Grid V061 | NASA; LP DAAC | MOD13A3 version 061, CMR concept C2327962326-LPCLOUD | 1000 x 1000 Meters | 2000-02-01 to present | REQUIRES_AUTHENTICATION |
| MODIS/Terra+Aqua BRDF/Albedo Albedo Daily L3 Global 0.05Deg CMG V061 | NASA; LP DAAC | MCD43C3 version 061, CMR concept C2532068039-LPCLOUD | 5600 x 5600 Meters | 2000-02-16 to present | REQUIRES_AUTHENTICATION |
| MODIS/Terra Aerosol Cloud Water Vapor Ozone Monthly L3 Global 1Deg CMG | NASA; NASA/GSFC/SED/ESD/HBSL/BISB/LAADS | MOD08_M3 version 6.1, CMR concept C1443766359-LAADS | 1 x 1 Decimal Degrees | 2000-02-01 to present | REQUIRES_AUTHENTICATION |
| MODIS/Aqua Aerosol Cloud Water Vapor Ozone Monthly L3 Global 1Deg CMG | NASA; NASA/GSFC/SED/ESD/HBSL/BISB/LAADS | MYD08_M3 version 6.1, CMR concept C1443775657-LAADS | 1 x 1 Decimal Degrees | 2002-07-01 to present | REQUIRES_AUTHENTICATION |
| MODIS/Terra Land Water Mask Derived from MODIS and SRTM L3 Global 250m SIN Grid V061 | NASA; LP DAAC | MOD44W version 061, CMR concept C2565805847-LPCLOUD | 250 x 250 Meters | 2000-01-01 to present | REQUIRES_AUTHENTICATION |
| MISR Level 3 Component Global Aerosol product in netCDF format covering a month V004 | NASA; NASA/LARC/SD/ASDC | MIL3MAEN version 004, CMR concept C2873771604-LARC_CLOUD | 0.5 x 0.5 Decimal Degrees | 1999-12-18 to present | REQUIRES_AUTHENTICATION |
| MERRA-2 tavgM_2d_slv_Nx: 2d,Monthly mean,Time-Averaged,Single-Level,Assimilation,Single-Level Diagnostics 0.625 x 0.5 degree V5.12.4 (M2TMNXSLV)  | NASA; NASA/GSFC/SED/ESD/TISL/GESDISC | M2TMNXSLV version 5.12.4, CMR concept C1276812859-GES_DISC | 0.625 x 0.5 Decimal Degrees | 1980-01-01 to present | REQUIRES_AUTHENTICATION |
| MERRA-2 tavgM_2d_aer_Nx: 2d,Monthly mean,Time-averaged,Single-Level,Assimilation,Aerosol Diagnostics 0.625 x 0.5 degree V5.12.4 (M2TMNXAER)  | NASA; NASA/GSFC/SED/ESD/TISL/GESDISC | M2TMNXAER version 5.12.4, CMR concept C1276812866-GES_DISC | 0.625 x 0.5 Decimal Degrees | 1980-01-01 to present | REQUIRES_AUTHENTICATION |
| MERRA-2 tavgM_2d_lnd_Nx: 2d,Monthly mean,Time-Averaged,Single-Level,Assimilation,Land Surface Diagnostics 0.625 x 0.5 degree V5.12.4 (M2TMNXLND)  | NASA; NASA/GSFC/SED/ESD/TISL/GESDISC | M2TMNXLND version 5.12.4, CMR concept C1276812856-GES_DISC | 0.625 x 0.5 Decimal Degrees | 1980-01-01 to present | REQUIRES_AUTHENTICATION |
| GPM IMERG Final Precipitation L3 1 month 0.1 degree x 0.1 degree V07 (GPM_3IMERGM) | NASA; NASA/GSFC/SED/ESD/TISL/GESDISC | GPM_3IMERGM version 07, CMR concept C2723754851-GES_DISC | – | 1998-01-01 to 2025-09-30 | REQUIRES_AUTHENTICATION |
| GLDAS Noah Land Surface Model L4 monthly 0.25 x 0.25 degree V2.1 (GLDAS_NOAH025_M) | NASA; NASA/GSFC/SED/ESD/TISL/GESDISC | GLDAS_NOAH025_M version 2.1, CMR concept C1342986036-GES_DISC | 0.25 x 0.25 Decimal Degrees | 2000-01-01 to present | REQUIRES_AUTHENTICATION |
| SMAP L4 Global 3-hourly 9 km EASE-Grid Surface and Root Zone Soil Moisture Geophysical Data V008 | NASA; NASA NSIDC DAAC | SPL4SMGP version 008, CMR concept C3480440870-NSIDC_CPRD | 9.0 x 9.0 Kilometers | 2015-03-31 to present | REQUIRES_AUTHENTICATION |
| NASADEM Merged DEM Global 1 arc second V001 | NASA; LP DAAC | NASADEM_HGT version 001, CMR concept C2763264762-LPCLOUD | 30 x 30 Meters | 2000-02-11 to 2000-02-21 | REQUIRES_AUTHENTICATION |
| NASA Shuttle Radar Topography Mission Global 1 arc second V003 | NASA; LP DAAC | SRTMGL1 version 003, CMR concept C2763266360-LPCLOUD | 30 x 30 Meters | 2000-02-11 to 2000-02-21 | REQUIRES_AUTHENTICATION |
| ASTER Global Digital Elevation Model V003 | NASA; LP DAAC | ASTGTM version 003, CMR concept C1711961296-LPCLOUD | 30 x 30 Meters | 2000-03-01 to 2013-11-30 | REQUIRES_AUTHENTICATION |
| ASTER Global Emissivity Dataset, 100 meter, HDF5 V003 | NASA; LP DAAC | AG100 version 003, CMR concept C2763266348-LPCLOUD | 100 x 100 Meters | 2000-01-01 to 2008-12-31 | REQUIRES_AUTHENTICATION |
| ASTER Global Emissivity Dataset, Monthly, 0.05 deg, HDF5 V041 | NASA; LP DAAC | AG5KMMOH version 041, CMR concept C2763268461-LPCLOUD | 5600 x 5600 Meters | 2000-03-01 to 2015-12-31 | REQUIRES_AUTHENTICATION |
| EMIT L2B Estimated Mineral Identification and Band Depth and Uncertainty 60 m V002 | NASA; LP DAAC | EMITL2BMIN version 002, CMR concept C4079846859-LPCLOUD | 60 x 60 Meters | 2022-08-09 to present | REQUIRES_AUTHENTICATION |
| ECOSTRESS Tiled Land Surface Temperature and Emissivity Instantaneous L2 Global 70 m V003 | NASA; LP DAAC | ECO_L2T_LSTE version 003, CMR concept C3998139651-LPCLOUD | 70 x 70 Meters | 2018-07-09 to present | REQUIRES_AUTHENTICATION |
| VIIRS/NPP Land Surface Temperature/Emissivity Daily L3 Global 1km SIN Grid Day V002 | NASA; LP DAAC | VNP21A1D version 002, CMR concept C2545314555-LPCLOUD | 1000 x 1000 Meters | 2012-01-17 to present | REQUIRES_AUTHENTICATION |
| Randolph Glacier Inventory - A Dataset of Global Glacier Outlines, Version 7 | NASA; NASA NSIDC DAAC | NSIDC-0770 version 7, CMR concept C2768953486-NSIDCV0 | VariesResolution | 1950-01-01 to 2021-12-31 | REQUIRES_AUTHENTICATION |
| GLIMS Glacier Database, Version 1 | NASA; NASA NSIDC DAAC | NSIDC-0272 version 1, CMR concept C1386250255-NSIDCV0 | VariesResolution | 1850-01-01 to present | REQUIRES_AUTHENTICATION |
| OPERA Dynamic Surface Water Extent from Harmonized Landsat Sentinel-2 product (Version 1) | NASA; NASA/JPL/PODAAC | OPERA_L3_DSWX-HLS_V1 version 1.0, CMR concept C2617126679-POCLOUD | 30 x 30 Meters | 2016-01-01 to present | REQUIRES_AUTHENTICATION |
| CALIPSO Lidar Level 3 Tropospheric Aerosol Profiles, All Sky Data, Standard V4-20 | NASA; NASA/LARC/SD/ASDC | CAL_LID_L3_Tropospheric_APro_AllSky-Standard-V4-20 version V4-20, CMR concept C3880523630-LARC_CLOUD | – | 2006-06-01 to 2020-08-01 | REQUIRES_AUTHENTICATION |
| MODIS/Terra+Aqua Land Aerosol Optical Depth Daily L2G Global 1km SIN Grid V061 | NASA; LP DAAC | MCD19A2 version 061, CMR concept C2324689816-LPCLOUD | 1000 x 1000 Meters | 2000-02-24 to present | REQUIRES_AUTHENTICATION |

## 9b. Datasets blocked (every route refused): 48

| Dataset | Agency / provider | Product | Resolution | Period | State |
|---|---|---|---|---|---|
| TerraClimate (monthly climate and water balance, 1/24°) | University of Idaho (Abatzoglou et al. 2018) (not NASA); University of Idaho (Abatzoglou et al. 2018) | – | – | – | BLOCKED |
| ERA5 monthly single-level reanalysis | ECMWF / Copernicus C3S (not NASA); ECMWF / Copernicus C3S | – | – | – | BLOCKED |
| MERRA-2 monthly files | NASA; NASA GMAO / GES DISC | – | – | – | BLOCKED |
| MYD11C3 v061 HDF science files | NASA; NASA LP DAAC | – | – | – | BLOCKED |
| NASADEM | NASA; NASA JPL / LP DAAC | – | – | – | BLOCKED |
| SRTM GL1 v003 | NASA; NASA / LP DAAC | – | – | – | BLOCKED |
| Copernicus DEM GLO-30 | ESA / Airbus (AWS open data) (not NASA); ESA / Airbus (AWS open data) | – | – | – | BLOCKED |
| ECOSTRESS LST | NASA; NASA JPL / LP DAAC | – | – | – | BLOCKED |
| VIIRS LST (VNP21) | NASA; NASA LP DAAC | – | – | – | BLOCKED |
| ESA WorldCover 2021 v200 | ESA (not NASA); ESA | – | – | – | BLOCKED |
| SoilGrids 2.0 | ISRIC (not NASA); ISRIC | – | – | – | BLOCKED |
| JRC Global Surface Water | European Commission JRC (not NASA); European Commission JRC | – | – | – | BLOCKED |
| Landsat Collection 2 | USGS (not NASA); USGS | – | – | – | BLOCKED |
| Mars Odyssey THEMIS thermal inertia | NASA; ASU / NASA PDS | – | – | – | BLOCKED |
| LRO LROC mosaics | NASA; ASU / NASA PDS | – | – | – | BLOCKED |
| MRO HiRISE DTMs | NASA; University of Arizona / NASA PDS | – | – | – | BLOCKED |
| MRO CTX global mosaic | NASA; Caltech Murray Lab / NASA PDS | – | – | – | BLOCKED |
| MRO CRISM spectral products | NASA; JHU APL / NASA PDS | – | – | – | BLOCKED |
| MRO Mars Climate Sounder | NASA; JPL / NASA PDS Atmospheres | – | – | – | BLOCKED |
| Copernicus Sentinel-2 Level-2A | ESA / Copernicus Data Space (not NASA); ESA / Copernicus Data Space | – | – | – | BLOCKED |
| ASTER Global Digital Elevation Model v3 | NASA; NASA LP DAAC / METI | ASTGTM.003 | 1 arc-second | 2000-2013 composite | BLOCKED |
| MODIS/Aqua Snow Cover Monthly L3 Global 0.05Deg CMG | NASA; NASA NSIDC DAAC | MYD10CM.061 | 0.05 deg | monthly, 2002-present | BLOCKED |
| Randolph Glacier Inventory 7.0 | GLIMS / NSIDC (not NASA); GLIMS / NSIDC | RGI 7.0 | vector | around 2000 | BLOCKED |
| Permafrost CCI ground temperature and extent | ESA Climate Change Initiative (not NASA); ESA Climate Change Initiative | – | 1 km | annual | BLOCKED |
| MODIS Aerosol Optical Depth (MAIAC MCD19A2 / Dark Target-Deep Blue) | NASA; NASA LP DAAC | MCD19A2.061 | 1 km | daily | BLOCKED |
| MERRA-2 tavgM_2d_aer_Nx aerosol diagnostics (incl. dust AOD and dust deposition, modelled) | NASA; NASA GMAO / GES DISC | M2TMNXAER.5.12.4 | 0.5 x 0.625 deg | monthly, 1980-present | BLOCKED |
| MERRA-2 tavgM_2d_slv_Nx near-surface wind | NASA; NASA GMAO / GES DISC | M2TMNXSLV.5.12.4 | 0.5 x 0.625 deg | monthly | BLOCKED |
| CALIPSO CALIOP Level 3 aerosol profiles | NASA; NASA ASDC | – | – | 2006-2023 | BLOCKED |
| MODIS/Aqua Vegetation Indices Monthly L3 Global 0.05Deg CMG | NASA; NASA LP DAAC | MYD13C2.061 | 0.05 deg | monthly | BLOCKED |
| State Geologic Map Compilation (SGMC) | USGS (not NASA); USGS | SGMC | vector (1:500,000 to 1:1,000,000 sources) | – | BLOCKED |
| Mineral Resources Data System (MRDS) | USGS (not NASA); USGS | MRDS | points | – | BLOCKED |
| ASTER L2 Surface Reflectance / Emissivity (VNIR, SWIR, TIR) | NASA; NASA LP DAAC | AST_07XT / AST_05 | 15-90 m | scene-based, 2000-2008 for SWIR | BLOCKED |
| LOLA polar illumination and permanent-shadow products | NASA; NASA PDS Geosciences Node (LRO LOLA team) | – | – | multi-year simulation | BLOCKED |
| SLDEM2015 (LOLA + SELENE Terrain Camera) DEM | NASA; NASA PDS Geosciences Node | SLDEM2015 | 512 pixels per degree | – | BLOCKED |
| MGS TES nighttime thermal inertia | NASA; NASA PDS | – | – | – | BLOCKED |
| POWER Climatology API v2 (source: MERRA-2) | NASA; NASA Langley Research Center, POWER project | POWER Climatology API v2 (source: MERRA-2) | 0.5° × 0.625° (MERRA-2 native) | monthly and annual climatology, 2001–2020 | BLOCKED |
| MODIS aerosol optical depth layers (GIBS) | NASA; NASA ESDIS, Global Imagery Browse Services | MODIS aerosol optical depth layers (GIBS) | rendered imagery; native product resolution per layer | per layer (daily/monthly) | BLOCKED |
| M2TMNXAER (MERRA-2 tavgM_2d_aer_Nx) | NASA; NASA GES DISC | M2TMNXAER (MERRA-2 tavgM_2d_aer_Nx) | 0.5° × 0.625° | monthly, 1980–present | BLOCKED |
| SoilGrids 2.0 | ISRIC – World Soil Information (not NASA); ISRIC – World Soil Information | SoilGrids 2.0 | 250 m | static | BLOCKED |
| Global Surface Water v1.4 | European Commission JRC / Google (not NASA); European Commission JRC / Google | Global Surface Water v1.4 | 30 m | 1984–2021 | BLOCKED |
| ESA WorldCover 10 m v200 (2021) | ESA / VITO (not NASA); ESA / VITO | ESA WorldCover 10 m v200 (2021) | 10 m | 2021 | BLOCKED |
| Copernicus DEM GLO-90 / GLO-30 | ESA / Copernicus (not NASA); ESA / Copernicus | Copernicus DEM GLO-90 / GLO-30 | 90 m / 30 m | 2011–2015 | BLOCKED |
| Randolph Glacier Inventory v7.0 (NSIDC-0770) | GLIMS / NSIDC (not NASA); GLIMS / NSIDC | Randolph Glacier Inventory v7.0 (NSIDC-0770) | vector | ≈ 2000 epoch | BLOCKED |
| Wikidata SPARQL (instances of cave / lava tube) | Wikimedia Foundation, Wikidata (not NASA); Wikimedia Foundation, Wikidata | Wikidata SPARQL (instances of cave / lava tube) | points (accuracy unknown per item) | query date | BLOCKED |
| Geologic Map of Mars, SIM 3292 (Tanaka et al. 2014), 1:20M | USGS Astrogeology (not NASA); USGS Astrogeology | Geologic Map of Mars, SIM 3292 (Tanaka et al. 2014), 1:20M | 1:20 000 000 | static | BLOCKED |
| Unified Geologic Map of the Moon, 1:5M (Fortezzo et al. 2020) | USGS Astrogeology (not NASA); USGS Astrogeology | Unified Geologic Map of the Moon, 1:5M (Fortezzo et al. 2020) | 1:5 000 000 | static | BLOCKED |
| MRO Mars Climate Sounder derived data | NASA; NASA PDS Atmospheres Node | MRO Mars Climate Sounder derived data | profiles | 2006–present | BLOCKED |
| MRO CRISM MTRDR / summary products | NASA; NASA PDS Geosciences Node | MRO CRISM MTRDR / summary products | ≈ 18 m/pixel (targeted) | 2006– | BLOCKED |

## Acquisition detail (this release)

- POWER WS10M: 450/450 boxes (gap-filled 0), grid native, source MERRA2+POWER, units m/s, 76781/76781 land cells, 13114 overlap points / 0 conflicts, raw SHA-256 `405d71d79e917505…`
- POWER WS50M: 450/450 boxes (gap-filled 6), grid native, source MERRA2+POWER, units m/s, 76781/76781 land cells, 13114 overlap points / 0 conflicts, raw SHA-256 `541a1154f6d8e62b…`
- POWER WS10M_MAX: 450/450 boxes (gap-filled 0), grid native, source MERRA2+POWER, units m/s, 76781/76781 land cells, 13114 overlap points / 0 conflicts, raw SHA-256 `354cf3bac3edec4a…`
- POWER U10M: 450/450 boxes (gap-filled 0), grid native, source MERRA2, units m/s, 76781/76781 land cells, 13114 overlap points / 0 conflicts, raw SHA-256 `ffc16220695d77d9…`
- POWER V10M: 450/450 boxes (gap-filled 9), grid native, source MERRA2, units m/s, 76781/76781 land cells, 13114 overlap points / 0 conflicts, raw SHA-256 `f55d3de30c169105…`
- POWER AOD_55: 450/450 boxes (gap-filled 6), grid 1deg, source SYN1DEG, units dimensionless, 62394/76781 land cells, 0 overlap points / 0 conflicts, raw SHA-256 `2068915c64e89d77…`
- POWER PS: 450/450 boxes (gap-filled 0), grid native, source MERRA2, units kPa, 76781/76781 land cells, 13114 overlap points / 0 conflicts, raw SHA-256 `b37416a479ab21a5…`
- POWER RH2M: 450/450 boxes (gap-filled 0), grid native, source MERRA2+POWER, units %, 76781/76781 land cells, 13114 overlap points / 0 conflicts, raw SHA-256 `03105a25e477f8c3…`
- POWER CLOUD_AMT: 450/450 boxes (gap-filled 12), grid 1deg, source SYN1DEG, units %, 76781/76781 land cells, 0 overlap points / 0 conflicts, raw SHA-256 `43f2c9a9bc03dae2…`
- POWER GWETTOP: 450/450 boxes (gap-filled 3), grid native, source MERRA2, units 1, 76781/76781 land cells, 13114 overlap points / 0 conflicts, raw SHA-256 `dfadfba6216e857b…`
- POWER GWETROOT: 450/450 boxes (gap-filled 0), grid native, source MERRA2, units 1, 54201/76781 land cells, 13114 overlap points / 0 conflicts, raw SHA-256 `1fca1b08d5a8bcfc…`
- POWER ALLSKY_SRF_ALB: 450/450 boxes (gap-filled 12), grid 1deg, source SYN1DEG+POWER, units dimensionless, 76781/76781 land cells, 0 overlap points / 0 conflicts, raw SHA-256 `8d9156921fbfe3c1…`
- POWER ALLSKY_SFC_SW_DWN: 450/450 boxes (gap-filled 6), grid 1deg, source SYN1DEG, units kW-hr/m^2/day, 76781/76781 land cells, 0 overlap points / 0 conflicts, raw SHA-256 `fffdd32c55b17138…`
- POWER SNODP: 450/450 boxes (gap-filled 3), grid native, source MERRA2, units cm, 54201/76781 land cells, 13114 overlap points / 0 conflicts, raw SHA-256 `d67dee8892cb96bb…`
- POWER FRSNO: 450/450 boxes (gap-filled 3), grid native, source MERRA2, units 1, 54201/76781 land cells, 13114 overlap points / 0 conflicts, raw SHA-256 `8cbd3537a5896b83…`
- GIBS MERRA2_Dust_Surface_Mass_Concentration_Monthly: 120 image(s) 2016-01–2025-12, raw SHA-256 `1fcca8afb213fcaa…`
- GIBS MODIS_Terra_L3_Snow_Cover_Monthly_Average_Pct: 120 image(s) 2016-01–2025-12, raw SHA-256 `a4ad90e64d12e2ae…`
- GIBS MODIS_Terra_L3_EVI_Monthly: 60 image(s) 2021-01–2025-12, raw SHA-256 `a53c8ebe490119dd…`
- GIBS MISR_Aerosol_Optical_Depth_Avg_Green_Monthly: 120 image(s) 2013-01–2022-12, raw SHA-256 `415848c9476fb2b7…`
- GIBS MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual: 1 image(s) 2024-01–2024-01, raw SHA-256 `e36d486ddacd7437…`
- GIBS MODIS_Terra_L3_Land_Water_Mask: 1 image(s) 2015-01–2015-01, raw SHA-256 `594b3a7c8985034e…`
- GVP: 1214 Holocene and 1452 Pleistocene volcanoes; transcription cross-check 39/39
- Sites: 101 cells; map units of the 16 earlier transcribed cells agree 16/16
- CMR: 33 short names queried, 32 found, 32 require an Earthdata Login

## Access routes

| Route | Result | Class |
|---|---|---|
| this build environment (cloud) | every provider refused: the egress proxy answered 403 to CONNECT | network_policy |
| the user's computer, shell | every provider refused: the shell's proxy answered 403 to CONNECT | network_policy |
| WebFetch service | Macrostrat, GVP and GBIF answered as transcriptions only; POWER and SoilGrids refused by robots.txt; GIBS images: server error; URLs over about 250 characters refused | service_limits |
| the user's computer, Claude desktop browser | POWER, GIBS, CMR, GVP, Macrostrat and GBIF answered; files saved byte for byte; POWER refused some boxes with HTTP 429 (rate limit) | working |

## Cube variables

| Variable | Units | Kind | Datasets | Resolution | Period | Cells with a value |
|---|---|---|---|---|---|---|
| wind_ws10m | m/s | reanalysis (MERRA-2) | power_ws10m | 0.5 x 0.625 deg (native) | 2001-2025 climatology | 76781 |
| wind_ws10m_maxmonth | m/s | reanalysis (MERRA-2) | power_ws10m | 0.5 x 0.625 deg (native) | 2001-2025 climatology | 76781 |
| wind_ws50m | m/s | reanalysis (MERRA-2) | power_ws50m | 0.5 x 0.625 deg (native) | 2001-2025 climatology | 76781 |
| wind_ws10m_max | m/s | reanalysis (MERRA-2) | power_ws10m_max | 0.5 x 0.625 deg (native) | 2001-2025 climatology | 76781 |
| wind_dir_from | deg | derived from reanalysis (MERRA-2) | power_u10m, power_v10m | 0.5 x 0.625 deg (native) | 2001-2025 climatology | 76401 |
| wind_steadiness | ratio | derived from reanalysis (MERRA-2) | power_u10m, power_v10m, power_ws10m | 0.5 x 0.625 deg (native) | 2001-2025 climatology | 76781 |
| aod550_ceres | 1 | satellite-derived (CERES SYN1deg) | power_aod_55 | 1 deg x 1 deg (sampled at the cell centre) | 2001-2025 climatology | 62394 |
| ps_kpa | kPa | reanalysis (MERRA-2) | power_ps | 0.5 x 0.625 deg (native) | 2001-2025 climatology | 76781 |
| rh2m | % | reanalysis (MERRA-2) | power_rh2m | 0.5 x 0.625 deg (native) | 2001-2025 climatology | 76781 |
| cloud_amt | % | satellite-derived (CERES SYN1deg) | power_cloud_amt | 1 deg x 1 deg (sampled at the cell centre) | 2001-2025 climatology | 76781 |
| gwettop | fraction of saturation | reanalysis (MERRA-2) | power_gwettop | 0.5 x 0.625 deg (native) | 2001-2025 climatology | 76781 |
| gwetroot | fraction of saturation | reanalysis (MERRA-2) | power_gwetroot | 0.5 x 0.625 deg (native) | 2001-2025 climatology | 54201 |
| albedo | 1 | satellite-derived (CERES SYN1deg) | power_allsky_srf_alb | 1 deg x 1 deg (sampled at the cell centre) | 2001-2025 climatology | 76781 |
| sw_dwn | kWh/m2/day | satellite-derived (CERES SYN1deg) | power_allsky_sfc_sw_dwn | 1 deg x 1 deg (sampled at the cell centre) | 2001-2025 climatology | 76781 |
| snodp_cm | cm | reanalysis model (MERRA-2) | power_snodp | 0.5 x 0.625 deg (native) | 2001-2025 climatology | 54201 |
| snodp_maxmonth | cm | reanalysis model (MERRA-2) | power_snodp | 0.5 x 0.625 deg (native) | 2001-2025 climatology | 54201 |
| frsno | 1 | reanalysis model (MERRA-2) | power_frsno | 0.5 x 0.625 deg (native) | 2001-2025 climatology | 54201 |
| frsno_months50 | months | reanalysis model (MERRA-2) | power_frsno | 0.5 x 0.625 deg (native) | 2001-2025 climatology | 54201 |
| dust_sfc_ugm3 | ug/m3 | reanalysis model (MERRA-2 aerosol assimilation) | gibs_merra2_dust_surface_mass_concentration_monthly, m2tmnxaer | 0.5 x 0.625 deg model, imaged at 0.25 deg | 2016-2025 monthly climatology | 76781 |
| dust_sfc_maxmonth | ug/m3 | reanalysis model (MERRA-2 aerosol assimilation) | gibs_merra2_dust_surface_mass_concentration_monthly, m2tmnxaer | 0.5 x 0.625 deg model, imaged at 0.25 deg | 2016-2025 monthly climatology | 76781 |
| dust_top_bin_months | months | reanalysis model (MERRA-2 aerosol assimilation) | gibs_merra2_dust_surface_mass_concentration_monthly, m2tmnxaer | 0.5 x 0.625 deg model, imaged at 0.25 deg | 2016-2025 monthly climatology | 76781 |
| snow_detected_maxmonth | % | satellite observation (MODIS Terra), lower bound | gibs_modis_terra_l3_snow_cover_monthly_average_pct, mod10cm | 0.05 deg product, imaged at 0.1 deg | 2016-2025 monthly | 76781 |
| snow_detected_months50 | months | satellite observation (MODIS Terra), lower bound | gibs_modis_terra_l3_snow_cover_monthly_average_pct, mod10cm | 0.05 deg product, imaged at 0.1 deg | 2016-2025 monthly | 76781 |
| evi_mean | 1 | satellite observation (MODIS Terra) | gibs_modis_terra_l3_evi_monthly, mod13a3 | 1 km product, imaged at 0.25 deg | 2021-2025 monthly | 48306 |
| evi_max | 1 | satellite observation (MODIS Terra) | gibs_modis_terra_l3_evi_monthly, mod13a3 | 1 km product, imaged at 0.25 deg | 2021-2025 monthly | 48306 |
| evi_months | months | satellite observation (MODIS Terra) | gibs_modis_terra_l3_evi_monthly, mod13a3 | 1 km product, imaged at 0.25 deg | 2021-2025 monthly | 48306 |
| aod_misr_mean | 1 | satellite observation (MISR, Terra) | gibs_misr_aerosol_optical_depth_avg_green_monthly, mil3maen | 0.5 deg product, imaged at 0.25 deg | 2013-2022 monthly | 45098 |
| aod_misr_months | months | satellite observation (MISR, Terra) | gibs_misr_aerosol_optical_depth_avg_green_monthly, mil3maen | 0.5 deg product, imaged at 0.25 deg | 2013-2022 monthly | 53662 |
| lc_dominant | class | satellite classification (MODIS Terra+Aqua, IGBP scheme) | gibs_modis_combined_l3_igbp_land_cover_type_annual, mcd12q1 | 500 m product, imaged at 0.1 deg | 2024 | 76781 |
| lc_barren | fraction | satellite classification (MODIS Terra+Aqua, IGBP scheme) | gibs_modis_combined_l3_igbp_land_cover_type_annual, mcd12q1 | 500 m product, imaged at 0.1 deg | 2024 | 76781 |
| lc_snowice | fraction | satellite classification (MODIS Terra+Aqua, IGBP scheme) | gibs_modis_combined_l3_igbp_land_cover_type_annual, mcd12q1 | 500 m product, imaged at 0.1 deg | 2024 | 76781 |
| lc_water | fraction | satellite classification (MODIS Terra+Aqua, IGBP scheme) | gibs_modis_combined_l3_igbp_land_cover_type_annual, mcd12q1 | 500 m product, imaged at 0.1 deg | 2024 | 76781 |
| lc_vegetated | fraction | satellite classification (MODIS Terra+Aqua, IGBP scheme) | gibs_modis_combined_l3_igbp_land_cover_type_annual, mcd12q1 | 500 m product, imaged at 0.1 deg | 2024 | 76781 |
| lc_urban | fraction | satellite classification (MODIS Terra+Aqua, IGBP scheme) | gibs_modis_combined_l3_igbp_land_cover_type_annual, mcd12q1 | 500 m product, imaged at 0.1 deg | 2024 | 76781 |
| water_mask_frac | fraction | satellite classification (MODIS Terra) | gibs_modis_terra_l3_land_water_mask, mod44w | 250 m product, imaged at 0.1 deg | 2015 | 76781 |
| volc_nearest_km | km | catalogue | gvp_holocene | volcano summit or field-centre points; distance from the cell centre | Holocene (last ~11,700 years) / Pleistocene | 76781 |
| volc_nearest_idx | index | catalogue | gvp_holocene | volcano summit or field-centre points; distance from the cell centre | Holocene (last ~11,700 years) / Pleistocene | 76781 |
| volc_holo_100km | count | catalogue | gvp_holocene | volcano summit or field-centre points; distance from the cell centre | Holocene (last ~11,700 years) / Pleistocene | 76781 |
| volc_pleis_100km | count | catalogue | gvp_pleistocene | volcano summit or field-centre points; distance from the cell centre | Holocene (last ~11,700 years) / Pleistocene | 76781 |
