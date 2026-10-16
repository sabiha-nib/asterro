"""ASTERRO Phase III — Planetary Target Atlas: catalogue specification.

This file defines WHERE each target is and HOW its location is anchored. It contains no
environmental value. Every coordinate is either
  * looked up at build time in the IAU / USGS Gazetteer of Planetary Nomenclature
    (center points published by USGS Astrogeology), recorded with its feature link; or
  * a published mission coordinate, recorded with its source; or
  * derived from one of the above by a documented offset (Olympus Mons flank / plains).
Fingerprint values are produced only by the pipeline (src/phase3/pipeline/*) from mission data.

Target kinds (never treated as equivalent):
  named_feature   — an IAU-named geographic feature, sampled by a 55.6 km window at its centre
  defined_region  — a spatial target region defined by ASTERRO (explicit centre / offset / extent)
  mission_region  — a landing or exploration region anchored at a mission coordinate
  observation_site— a single observation or sample location
"""

GAZ = "USGS/IAU Gazetteer of Planetary Nomenclature (center points)"
NSSDCA = "NASA NSSDCA, Apollo Landing Site Coordinates (determined from LRO images): https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html"
LROC_PITS = "LROC Pits Atlas, Marius Hills Pit: https://lroc.im-ldi.com/atlases/pits/1"
WIKI_MARS = "Wikipedia, List of artificial objects on Mars (secondary source; Curiosity landing 4°35'22\"S 137°26'30\"E)"

TARGETS = [
    # ------------------------------------------------------------------ Mars
    dict(id="mars_jezero", body="Mars", name="Jezero Crater", kind="defined_region", baseline=True,
         anchor=dict(type="baseline", lat=18.38, lon=77.58, gazetteer="Jezero"),
         context="Mars 2020 Perseverance landing region (2021). Existing ASTERRO baseline target; definition unchanged."),
    dict(id="mars_gale_aeolis_mons", body="Mars", name="Gale Crater / Mount Sharp (Aeolis Mons)", kind="named_feature",
         anchor=dict(type="gazetteer", feature="Aeolis Mons"),
         context="Central mound of Gale Crater; the IAU name of Mount Sharp is Aeolis Mons."),
    dict(id="mars_gale_curiosity", body="Mars", name="Gale Crater / Curiosity exploration region", kind="mission_region",
         anchor=dict(type="mission", lat=-4.5894, lon=137.4417, source=WIKI_MARS, gazetteer="Gale"),
         context="Mars Science Laboratory Curiosity landing site (Bradbury Landing, 2012) on the floor of Gale Crater; REMS environmental station."),
    dict(id="mars_elysium_planitia", body="Mars", name="Elysium Planitia", kind="named_feature", sample_ring=True,
         anchor=dict(type="gazetteer", feature="Elysium Planitia"),
         context="Broad volcanic plain; InSight landed in western Elysium Planitia (2018), ~1,200 km from the feature centre."),
    dict(id="mars_utopia_planitia", body="Mars", name="Utopia Planitia", kind="named_feature", sample_ring=True,
         anchor=dict(type="gazetteer", feature="Utopia Planitia"),
         context="Large northern lowland basin plain; Viking 2 (1976) and Zhurong (2021) landed within it."),
    dict(id="mars_gusev", body="Mars", name="Gusev Crater", kind="named_feature",
         anchor=dict(type="gazetteer", feature="Gusev"),
         context="Mars Exploration Rover Spirit landing site (2004)."),
    dict(id="mars_hellas_planitia", body="Mars", name="Hellas Planitia", kind="named_feature", sample_ring=True,
         anchor=dict(type="gazetteer", feature="Hellas Planitia"),
         context="Floor of the Hellas impact basin, the deepest large basin on Mars."),
    dict(id="mars_valles_marineris", body="Mars", name="Valles Marineris", kind="named_feature",
         anchor=dict(type="gazetteer", feature="Valles Marineris"),
         context="Canyon system ~4,000 km long. Represented ONLY by a 55.6 km window at the gazetteer centre point; the system is not characterised as a whole.",
         heterogeneity_note="Elongated system: ring sampling would mostly sample plateau, so no between-window heterogeneity is computed."),
    dict(id="mars_olympus_mons_summit", body="Mars", name="Olympus Mons — summit (caldera)", kind="defined_region",
         anchor=dict(type="gazetteer", feature="Olympus Mons"),
         context="55.6 km window at the gazetteer centre point of Olympus Mons (summit caldera complex)."),
    dict(id="mars_olympus_mons_flank", body="Mars", name="Olympus Mons — eastern flank", kind="defined_region",
         anchor=dict(type="offset", feature="Olympus Mons", distance_km=150, bearing_deg=90),
         context="Window 150 km east of the Olympus Mons centre point, on the shield flank (defined by ASTERRO)."),
    dict(id="mars_olympus_mons_plains", body="Mars", name="Olympus Mons — surrounding plains (east)", kind="defined_region",
         anchor=dict(type="offset", feature="Olympus Mons", distance_km=450, bearing_deg=90),
         context="Window 450 km east of the centre point, beyond the ~300 km shield radius (defined by ASTERRO)."),
    dict(id="mars_arcadia_planitia", body="Mars", name="Arcadia Planitia", kind="named_feature", sample_ring=True,
         anchor=dict(type="gazetteer", feature="Arcadia Planitia"), context="Northern lowland plain."),
    dict(id="mars_amazonis_planitia", body="Mars", name="Amazonis Planitia", kind="named_feature", sample_ring=True,
         anchor=dict(type="gazetteer", feature="Amazonis Planitia"), context="Smooth plain west of Olympus Mons."),
    dict(id="mars_noctis_labyrinthus", body="Mars", name="Noctis Labyrinthus", kind="named_feature", sample_ring=True,
         anchor=dict(type="gazetteer", feature="Noctis Labyrinthus"), context="Network of intersecting troughs at the western end of Valles Marineris."),
    dict(id="mars_schiaparelli", body="Mars", name="Schiaparelli Crater", kind="named_feature", sample_ring=True,
         anchor=dict(type="gazetteer", feature="Schiaparelli"), context="458 km impact crater in Terra Sabaea / Meridiani region."),
    dict(id="mars_endeavour", body="Mars", name="Endeavour Crater region", kind="named_feature",
         anchor=dict(type="gazetteer", feature="Endeavour"),
         context="22 km crater explored by Opportunity (2011–2018). The 55.6 km window is larger than the crater and includes surrounding Meridiani plains."),
    dict(id="mars_planum_boreum", body="Mars", name="Mars north polar region (Planum Boreum)", kind="named_feature",
         anchor=dict(type="gazetteer", feature="Planum Boreum"), context="North polar layered deposits and residual cap."),
    dict(id="mars_planum_australe", body="Mars", name="Mars south polar region (Planum Australe)", kind="named_feature",
         anchor=dict(type="gazetteer", feature="Planum Australe"), context="South polar layered deposits."),
    # ------------------------------------------------------------------ Moon
    dict(id="moon_south_pole", body="Moon", name="Lunar South Pole", kind="defined_region", baseline=True,
         anchor=dict(type="baseline", lat=-90.0, lon=0.0),
         context="Existing ASTERRO baseline target; definition unchanged. Window includes Shackleton crater and adjacent ridges."),
    dict(id="moon_shackleton", body="Moon", name="Shackleton Crater", kind="named_feature",
         anchor=dict(type="gazetteer", feature="Shackleton"),
         context="21 km polar crater with a permanently shadowed interior. The 55.6 km window is larger than the crater (overlaps the baseline south-pole window)."),
    dict(id="moon_cabeus", body="Moon", name="Cabeus Crater", kind="named_feature",
         anchor=dict(type="gazetteer", feature="Cabeus"), context="South-polar crater; LCROSS impact target (2009)."),
    dict(id="moon_malapert_massif", body="Moon", name="Malapert Massif (Mons Malapert)", kind="named_feature",
         anchor=dict(type="gazetteer", feature="Mons Malapert"), context="South-polar massif; IAU name Mons Malapert."),
    dict(id="moon_aristarchus", body="Moon", name="Aristarchus (crater, Aristarchus Plateau)", kind="named_feature",
         anchor=dict(type="gazetteer", feature="Aristarchus"),
         context="Sampled at Aristarchus crater. 'Aristarchus Plateau' is not an IAU feature, so the plateau is not separately defined."),
    dict(id="moon_marius_hills", body="Moon", name="Marius Hills (Marius Hills Pit)", kind="observation_site",
         anchor=dict(type="mission", lat=14.0917, lon=303.2299, source=LROC_PITS),
         context="Volcanic dome field (informal name). Anchored at the LROC-catalogued Marius Hills Pit; the dome field itself is not an IAU feature."),
    dict(id="moon_oceanus_procellarum", body="Moon", name="Oceanus Procellarum", kind="named_feature", sample_ring=True,
         anchor=dict(type="gazetteer", feature="Oceanus Procellarum"), context="Largest lunar mare (~2,600 km)."),
    dict(id="moon_reiner_gamma", body="Moon", name="Reiner Gamma", kind="named_feature",
         anchor=dict(type="gazetteer", feature="Reiner Gamma"), context="Lunar swirl (albedo feature) associated with a magnetic anomaly."),
    dict(id="moon_schrodinger", body="Moon", name="Schrödinger Basin", kind="named_feature",
         anchor=dict(type="gazetteer", feature="Schrödinger"), context="~320 km far-side peak-ring basin near the south pole."),
    dict(id="moon_orientale", body="Moon", name="Orientale (Mare Orientale)", kind="named_feature",
         anchor=dict(type="gazetteer", feature="Mare Orientale"),
         context="Sampled at the central mare of the Orientale basin; the multi-ring basin (~930 km) is not represented as a whole."),
    dict(id="moon_apollo17_taurus_littrow", body="Moon", name="Taurus-Littrow (Apollo 17)", kind="mission_region",
         anchor=dict(type="mission", lat=20.1911, lon=30.7723, source=NSSDCA), context="Apollo 17 landing site (1972)."),
    dict(id="moon_apollo14_fra_mauro", body="Moon", name="Fra Mauro (Apollo 14)", kind="mission_region",
         anchor=dict(type="mission", lat=-3.64589, lon=-17.47194, source=NSSDCA, gazetteer="Fra Mauro"), context="Apollo 14 landing site (1971), Fra Mauro formation."),
    dict(id="moon_apollo16_descartes", body="Moon", name="Descartes (Apollo 16)", kind="mission_region",
         anchor=dict(type="mission", lat=-8.9734, lon=15.5011, source=NSSDCA, gazetteer="Descartes"), context="Apollo 16 landing site (1972), lunar highlands."),
    dict(id="moon_apollo15_hadley", body="Moon", name="Hadley–Apennine (Apollo 15)", kind="mission_region",
         anchor=dict(type="mission", lat=26.13239, lon=3.63330, source=NSSDCA, gazetteer="Rima Hadley"), context="Apollo 15 landing site (1971) near Rima Hadley and Montes Apenninus."),
    dict(id="moon_north_pole", body="Moon", name="Lunar North Polar Region", kind="defined_region",
         anchor=dict(type="pole", lat=90.0, lon=0.0), context="55.6 km window centred on the north pole, defined like the baseline south-pole window."),
]

# Variable compatibility registry: which planetary product may be compared with which Earth criterion.
COMPATIBILITY = {
    "slope": dict(earth="GMTED2010 30″, Horn slope on a 926.6 m baseline, cell mean",
                  planet="MOLA 463 m / LOLA 118 m DEM binned to 926.6 m, Horn slope, 55.6 km window mean",
                  verdict="COMPATIBLE", why="Identical algorithm, baseline and statistic; different source DEMs."),
    "surface_roughness": dict(earth="SD of 926.6 m elevations in the cell", planet="SD of 926.6 m-binned elevations in the window",
                              verdict="COMPATIBLE", why="Identical algorithm and statistic; window (55.6 km) ≈ Earth cell N–S size."),
    "lst_diurnal_range": dict(earth="MODIS Aqua split-window LST, ~13:30 minus ~01:30 local time",
                              planet="Surface brightness temperature T(13–14 h) − T(01–02 h) local (true) solar time",
                              verdict="COMPATIBLE_WITH_CAVEATS",
                              why="Same local-time definition; different instruments and retrievals (MEDA TIRS, REMS GTS, Diviner bolometric vs MODIS LST)."),
    "annual_temperature_range": dict(earth="NASA POWER T2M warmest-month minus coldest-month mean",
                                     planet="Rover air temperature: max − min of 12 Ls-bin (30°) diurnal means",
                                     verdict="COMPATIBLE_WITH_CAVEATS",
                                     why="Both annual ranges of near-surface air temperature; Mars 'months' are 30° Ls bins (~56 sols); rover point vs 55 km cell."),
    "aridity": dict(earth="P / PET (Hargreaves–FAO56)", planet="defined 0 (no liquid precipitation)", verdict="PROXY",
                    why="Not a measurement; identical for every Mars and Moon target, so it cannot distinguish targets."),
    "elevation": dict(earth="GMTED2010 mean elevation", planet="'thin atmosphere' rule: highest valid Earth cell", verdict="PROXY",
                      why="Planetary elevations use unrelated datums; the proxy value is identical for every target."),
}
INCOMPATIBLE_EXAMPLES = [
    dict(product="Diviner level-4 global maps of noon (hour12) and midnight (hour00) temperature",
         reason="Different local times from the MODIS 13:30 / 01:30 definition; not used for the thermal criterion."),
    dict(product="Planetary absolute elevation (MOLA areoid, LOLA sphere)",
         reason="Different vertical datums from Earth EGM96; reported, never compared."),
]

READINESS = {
    1: ("CATALOG VERIFIED", "Location identified and verified; required target data not assembled."),
    2: ("PARTIAL DATA AVAILABLE", "Some measured criteria (typically terrain only); other dimensions missing or incompatible."),
    3: ("ANALYTICALLY COMPARABLE", "At least three directly measured criteria compatible with the Earth stack."),
    4: ("REPRODUCIBLE TARGET", "Analytically comparable, and every value is produced by a documented script from checksummed source data."),
}


def readiness(statuses, reproducible):
    direct = sum(1 for s in statuses.values() if s == "DIRECT")
    if direct == 0:
        return 1
    if direct < 3:
        return 2
    return 4 if reproducible else 3
