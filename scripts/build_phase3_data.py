"""Phase III: assemble the Planetary Target Atlas from the pipeline outputs (offline step).

Input  : data/raw/phase3/  (outputs of src/phase3/pipeline/*.py, retrieved from the network job)
Output : public/data/phase3/atlas.json      catalogue, fingerprints, statuses, readiness, provenance,
                                            compatibility registry, atlas normalisation, reference results
         public/data/phase3/grids.b64.txt   60x60 terrain (elevation, slope) and thermal grids per target
         public/data/phase3/subcell.b64.txt Earth sub-cell slope distribution (stack cell order)
         public/data/phase3/basemap_{mars,moon}.png  shaded relief from MOLA / LOLA (context only)

Nothing here invents a value. A criterion without a compatible product gets status MISSING or
INCOMPATIBLE and value null. The baseline files (data/targets.json, public/data/app.json,
public/data/stack.bin …) are read, never written.
"""
import base64, hashlib, json, os, sys, time
import numpy as np

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO)
from src.compute.variables import CRITERION_IDS
from src.compute.normalization import compute_ranges
from src.compute.similarity import similarity, effective_scores
from src.compute.ranking import distinct_sites
from src.compute.sensitivity import MISSION_PROFILES
from src.phase3 import target_catalog as TC

RAW = os.path.join(REPO, "data/raw/phase3")
PUB = os.path.join(REPO, "public/data/phase3")
ATLAS_VERSION = "atlas-1.0.0"
STATUSES = {
    "DIRECT": "Obtained from source data with the same (or a documented compatible) definition as the Earth criterion.",
    "DERIVED": "Obtained through an additional documented modelling step beyond the Earth definition.",
    "PROXY": "A stand-in defined by rule, not a measurement of the target; identical for many targets.",
    "MISSING": "A compatible product exists in principle but was not assembled for this target.",
    "INCOMPATIBLE": "The Earth quantity has no physically compatible counterpart at this target.",
    "UNVALIDATED": "A value was computed but failed or has not passed a quality check; not used for scoring.",
}
# Wikipedia-sourced coordinate (secondary) is flagged; NSSDCA / LROC / gazetteer are primary.
SECONDARY = {"mars_gale_curiosity"}


def sha(b):
    return hashlib.sha256(b).hexdigest()


def load(name):
    return json.load(open(os.path.join(RAW, name)))


def stack():
    app = json.load(open(os.path.join(REPO, "public/data/app.json")))
    buf = open(os.path.join(REPO, "public/data/stack.bin"), "rb").read()
    assert sha(buf) == app["stack"]["sha256"], "stack checksum mismatch"
    E = {}
    for L in app["stack"]["layout"]:
        E[L["name"]] = np.frombuffer(buf, dtype=L["dtype"], count=L["length"], offset=L["offset"])
    return app, E


def hillshade(z, az=315.0, alt=45.0, zf=1.0):
    gy, gx = np.gradient(np.nan_to_num(z, nan=np.nanmean(z)) * zf)
    slope = np.pi / 2 - np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    a, b = np.radians(az), np.radians(alt)
    hs = np.sin(b) * np.sin(slope) + np.cos(b) * np.cos(slope) * np.cos(a - aspect)
    return np.clip(hs, 0, 1)


def basemaps(files):
    from PIL import Image
    for body in ("mars", "moon"):
        p = os.path.join(RAW, f"basemap_{body}.npz")
        if not os.path.exists(p):
            continue
        d = np.load(p)
        z = d["elev"].astype(np.float64)
        meta = json.loads(str(d["meta"]))
        H, W = z.shape
        # pixel spacing in m (equirectangular): exaggerate relief for legibility (context only)
        R = 3396190.0 if body == "mars" else 1737400.0
        dx = 2 * np.pi * R / W
        hs = hillshade(z / dx, zf=40.0)
        lo, hi = np.nanpercentile(z, [1, 99])
        tint = np.clip((z - lo) / (hi - lo), 0, 1)
        g = (0.62 * hs + 0.38 * tint)
        img = (np.nan_to_num(g, nan=0) * 255).astype(np.uint8)
        fn = f"basemap_{body}.png"
        Image.fromarray(img, "L").save(os.path.join(PUB, fn), optimize=True)
        files[f"basemap_{body}"] = dict(file=fn, sha256=sha(open(os.path.join(PUB, fn), "rb").read()), width=W, height=H,
                                        projection="equirectangular, lon -180..180 E, lat 90..-90",
                                        source=meta, use="Context only; never used in any comparison.")


def main():
    os.makedirs(PUB, exist_ok=True)
    app, E = stack()
    base_targets = json.load(open(os.path.join(REPO, "data/targets.json")))["targets"]
    base_by_id = {t["id"]: t for t in base_targets}
    R = load("resolved.json")
    res_by_id = {t["id"]: t for t in R["targets"]}
    tprov = load("terrain_provenance.json")
    polar = load("thermal_polar.json") if os.path.exists(os.path.join(RAW, "thermal_polar.json")) else dict(targets={}, meta={})
    gcp = load("thermal_gcp.json") if os.path.exists(os.path.join(RAW, "thermal_gcp.json")) else dict(targets={}, meta={})
    rems = load("rems_gale.json") if os.path.exists(os.path.join(RAW, "rems_gale.json")) else None
    earth_max_elev = float(np.nanmax(E["elevation"]))

    datasets = {
        "gazetteer": dict(dataset="Gazetteer of Planetary Nomenclature, center points (Mars, Moon)",
                          product_id="MARS_/MOON_nomenclature_center_pts", provider="IAU WGPSN / USGS Astrogeology",
                          url=R["gazetteer"]["MARS"]["url"] + " ; " + R["gazetteer"]["MOON"]["url"], doi=None,
                          version=f"retrieved {R['retrieved_utc']}", retrieved=R["retrieved_utc"], period=None,
                          crs="planetocentric lat, east-positive lon", resolution="point features", units="deg; km",
                          processing="exact name match (diacritics fall back to clean_name)",
                          quality_flags="approval status recorded per feature",
                          checksum=dict(mars_zip_sha256=R["gazetteer"]["MARS"]["zip_sha256"], moon_zip_sha256=R["gazetteer"]["MOON"]["zip_sha256"]),
                          license="USGS public domain (U.S. Government work)",
                          limitations="Center points are single coordinates; extents are bounding boxes, not outlines."),
    }
    for body, D in tprov.items():
        datasets["dem_" + body.lower()] = dict(
            dataset=D["dataset"], product_id=D["product_id"], provider=D["provider"], url=D["url"], doi=None,
            version=dict(D["version_headers"]), retrieved=None, period="MGS 1997-2006" if body == "Mars" else "LRO 2009-2013 (LOLA)",
            crs="simple cylindrical (equirectangular) on a sphere, R = %.1f km" % (D["R"] / 1000),
            resolution="463 m" if body == "Mars" else "118 m", units="m (relative to product datum)",
            processing="55.6 km window, block-binned to 926.6 m azimuthal-equidistant grid, Horn slope, SD roughness "
                       "(src/data/ingestion/terrain.py::planet_window, unchanged)",
            quality_flags="bins_filled / 3600 per window; band read mode near poles / antimeridian",
            checksum="SHA-256 of each extracted window grid (per target) + object ETag", license=D["licence"],
            limitations="Window statistic; sub-window variability only in the 60x60 grid; DEM interpolation artefacts at high latitude.")
    if polar.get("meta"):
        m = polar["meta"]
        datasets["diviner_polar"] = dict(dataset=m["dataset"], product_id="polar_{south,north}_80_{summer,winter}_tbol-hour{14,02}.grd",
                                         provider=m["provider"], url="https://luna1.diviner.ucla.edu/~jpierre/diviner/level4_polar/hourly_maps/",
                                         doi="10.1029/2019JE006028", version="files as listed with ETag / Last-Modified",
                                         retrieved=m["retrieved_utc"], period=m["period"], crs=m["crs"], resolution="240 m",
                                         units="K", processing=m["processing"], quality_flags="bins valid at both local times / window bins",
                                         checksum={k: v["sha256"] for k, v in m["files"].items()}, license=m["licence"], limitations=m["limitations"])
    if gcp.get("meta"):
        m = gcp["meta"]
        datasets["diviner_gcp"] = dict(dataset=m["dataset"], product_id="global_cumul_avg_cyl_*_002.tab", provider=m["provider"],
                                       url="https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_gcp/",
                                       doi=None, version="PRODUCT_VERSION_ID 1", retrieved=m["retrieved_utc"], period=m["period"],
                                       crs=m["crs"], resolution=m["resolution"], units=m["units"], processing=m["processing"],
                                       quality_flags=">=2 of 4 quarter-hour records valid at each local time",
                                       checksum=dict(range_reads=len(m["range_reads"]),
                                                     sha256_of_read_digests=sha("".join(sorted(m["range_reads"].values())).encode())),
                                       license=m["licence"], limitations=m["limitations"])
    if rems:
        datasets["rems"] = dict(dataset="MSL REMS Modeled RDR (MODRDR), volume mslrem_1001", product_id="RME_*RMD*.TAB",
                                provider="NASA PDS Atmospheres Node (REMS team: CAB, Spain)", url=rems["source"], doi=None,
                                version="product versions as listed per sol", retrieved=rems["retrieved_utc"],
                                period=f"sols {rems['sol_range'][0]}-{rems['sol_range'][1]} (every 2nd available sol; one Mars year)",
                                crs="rover point", resolution="1 Hz samples; 24 LTST hour bins", units="K",
                                processing="Same aggregate() as the Jezero MEDA baseline; Ls by Mars24 from label times "
                                           "(validated against Mars 2020 PDS4 label Ls to 0.001 deg and the Mars24 worked example).",
                                quality_flags="GTS confidence bytes 2,3 (still, no shadow); ambient confidence bytes 7,8; strict variants reported",
                                checksum=dict(n_tables=sum(1 for v in rems["tab_sha256"].values() if v),
                                              sha256_of_table_digests=sha("".join(v for k, v in sorted(rems["tab_sha256"].items()) if v).encode())),
                                license="NASA PDS archive product; licence not restated by the provider",
                                limitations="Single rover location; REMS GTS / boom ambient sensors differ from MEDA TIRS / ATS; "
                                            "Mars year 31-32 (2012-2014).")

    # ---------------------------------------------------------------- per-target fingerprints
    targets = []
    for spec in TC.TARGETS:
        tid = spec["id"]; body = spec["body"]; r = res_by_id[tid]
        T = load(f"terrain/{tid}.json")
        vals, st, why, prov = {}, {}, {}, {}
        # proxies: identical rule for every planetary target (as baseline)
        vals["aridity"], st["aridity"] = 0.0, "PROXY"
        why["aridity"] = TC.COMPATIBILITY["aridity"]["why"]
        vals["elevation"], st["elevation"] = earth_max_elev, "PROXY"
        why["elevation"] = TC.COMPATIBILITY["elevation"]["why"]
        terr = None
        if "error" in T:
            for c in ("slope", "surface_roughness"):
                vals[c], st[c], why[c] = None, "MISSING", "Terrain read failed: " + T["error"]
        else:
            p = T["primary"]
            ok = p["complete"] or p["bins_filled"] >= 0.95 * p["bins_total"]
            for c, k in (("slope", "slope_deg"), ("surface_roughness", "surface_roughness_m")):
                vals[c] = p[k] if ok else None
                st[c] = "DIRECT" if ok else "UNVALIDATED"
                why[c] = TC.COMPATIBILITY[c]["why"] + ("" if p["complete"] else f" Window coverage {p['bins_filled']}/{p['bins_total']} bins.")
                prov[c] = ["dem_" + body.lower()]
            terr = dict(elevation_mean_m=p["elevation_m"], elevation_min_m=p["elevation_min_m"], elevation_max_m=p["elevation_max_m"],
                        slope_p90_deg=p["slope_p90_deg"], bins_filled=p["bins_filled"], bins_total=p["bins_total"],
                        complete=p["complete"], read_mode=p["read_mode"], grid_sha256=p["grid_sha256"],
                        center=[p["center_lat"], p["center_lon"]], dem=p["dem_url"], datum_note="Elevation relative to the product datum; context only, never compared with Earth.")
            if T.get("ring"):
                ring = T["ring"]
                def agg(k):
                    v = np.array([w[k] for w in ring if w.get("complete")], float)
                    return dict(n=int(v.size), mean=float(v.mean()), sd=float(v.std(ddof=1)) if v.size > 1 else None,
                                min=float(v.min()), max=float(v.max())) if v.size else dict(n=0)
                terr["heterogeneity"] = dict(method="8 additional 55.6 km windows on a ring of radius 0.25 x gazetteer diameter "
                                                    "(bearings 0..315 deg); spread of window statistics between locations",
                                             radius_km=ring[0]["distance_km"], slope_deg=agg("slope_deg"),
                                             surface_roughness_m=agg("surface_roughness_m"),
                                             windows=[dict(k=w["k"], lat=w["lat"], lon=w["lon"], slope_deg=w["slope_deg"],
                                                           surface_roughness_m=w["surface_roughness_m"], complete=w["complete"],
                                                           grid_sha256=w["grid_sha256"]) for w in ring])
        # thermal + annual
        thermal = None
        if body == "Moon":
            vals["annual_temperature_range"], st["annual_temperature_range"] = None, "INCOMPATIBLE"
            why["annual_temperature_range"] = "The Moon has no atmosphere: near-surface air temperature, the Earth quantity, does not exist."
            if tid in polar.get("targets", {}):
                P = polar["targets"][tid]
                v = P["lst_diurnal_range_K"]
                good = v is not None and P["valid_fraction"] >= 0.5
                vals["lst_diurnal_range"] = v if good else None
                st["lst_diurnal_range"] = "DIRECT" if good else ("UNVALIDATED" if v is not None else "MISSING")
                why["lst_diurnal_range"] = TC.COMPATIBILITY["lst_diurnal_range"]["why"] + f" Valid bins {P['valid_fraction']:.0%} (min over seasons)."
                prov["lst_diurnal_range"] = ["diviner_polar"]
                thermal = dict(source="diviner_polar", seasons={s: P[s] for s in ("summer", "winter")},
                               valid_fraction=P["valid_fraction"], grid_sha256=P["grid_sha256"])
            elif tid in gcp.get("targets", {}):
                G = gcp["targets"][tid]["primary"]
                v = G["lst_diurnal_range_K"]
                vals["lst_diurnal_range"] = v
                st["lst_diurnal_range"] = "DIRECT" if v is not None else "MISSING"
                why["lst_diurnal_range"] = TC.COMPATIBILITY["lst_diurnal_range"]["why"] + f" {G['bins_used']} of {G['bins_in_window']} 0.5-deg bins used."
                prov["lst_diurnal_range"] = ["diviner_gcp"]
                thermal = dict(source="diviner_gcp", primary=G, ring=gcp["targets"][tid]["ring"])
            else:
                vals["lst_diurnal_range"], st["lst_diurnal_range"] = None, "MISSING"
                why["lst_diurnal_range"] = "No Diviner product was assembled for this location."
        else:
            if tid == "mars_jezero":
                b = base_by_id[tid]["variables"]
                for c in ("annual_temperature_range", "lst_diurnal_range"):
                    vals[c], st[c] = b[c], "DIRECT"
                    why[c] = "Baseline value (MEDA, src/data/ingestion/mars_meda.py), unchanged."
                    prov[c] = ["meda (baseline)"]
            elif tid == "mars_gale_curiosity" and rems:
                P = rems["primary"]
                for c, k, nb in (("lst_diurnal_range", "lst_diurnal_range_K", "lst_bins_used"),
                                 ("annual_temperature_range", "annual_temperature_range_K", "air_bins_used")):
                    v = P[k]
                    vals[c] = v
                    st[c] = "DIRECT" if v is not None and P[nb] == 12 else ("UNVALIDATED" if v is not None else "MISSING")
                    why[c] = TC.COMPATIBILITY[c]["why"] + f" {P[nb]} of 12 Ls bins."
                    prov[c] = ["rems"]
                thermal = dict(source="rems", primary=rems["primary"], strict=rems["strict"], sols_requested=rems["sols_requested"],
                               sols_with_data=rems["sols_with_data"], ls_check=rems["ls_check"],
                               ground_uncertainty_K=rems["ground_uncertainty_K_mean_hours_13_and_1"])
            else:
                for c in ("annual_temperature_range", "lst_diurnal_range"):
                    vals[c], st[c] = None, "MISSING"
                why["lst_diurnal_range"] = ("No Mars surface-temperature product at 13-14 h and 01-02 h local true solar time was assembled "
                                            "for this location (orbital products such as TES / THEMIS observe at other local times).")
                why["annual_temperature_range"] = "No near-surface air-temperature record over a Mars year exists or was assembled for this location."
        if tid == "mars_jezero" or tid == "moon_south_pole":
            # reproducibility check against the unchanged baseline target
            b = base_by_id[tid]["variables"]
            chk = {c: dict(baseline=b[c], recomputed=vals.get(c)) for c in ("slope", "surface_roughness") if vals.get(c) is not None}
            for c in chk:
                chk[c]["abs_diff"] = abs(chk[c]["baseline"] - chk[c]["recomputed"])
            if tid == "moon_south_pole" and tid in polar.get("targets", {}):
                chk["lst_diurnal_range"] = dict(baseline=b["lst_diurnal_range"], recomputed=polar["targets"][tid]["lst_diurnal_range_K"],
                                                abs_diff=abs(b["lst_diurnal_range"] - polar["targets"][tid]["lst_diurnal_range_K"]))
            # the atlas uses the BASELINE values for the baseline targets (definition unchanged)
            for c in CRITERION_IDS:
                vals[c] = b[c]
            if tid == "moon_south_pole":
                st["lst_diurnal_range"] = "DIRECT"; prov["lst_diurnal_range"] = ["diviner (baseline)"]
            reproduce = chk
        else:
            reproduce = None
        reproducible = all(st[c] != "UNVALIDATED" for c in CRITERION_IDS)
        lvl = TC.readiness(st, reproducible)
        anchor = dict(type=r["anchor_type"], lat=r["lat"], lon=r["lon"], source=r.get("source"),
                      secondary_source=tid in SECONDARY, gazetteer=r.get("gazetteer"))
        targets.append(dict(id=tid, body=body, name=spec["name"], kind=spec["kind"], baseline=bool(spec.get("baseline")),
                            context=spec["context"], heterogeneity_note=spec.get("heterogeneity_note"),
                            anchor=anchor, values=vals, status=st, status_reason=why, provenance=prov,
                            readiness=dict(level=lvl, label=TC.READINESS[lvl][0], meaning=TC.READINESS[lvl][1],
                                           direct=sum(1 for c in CRITERION_IDS if st[c] == "DIRECT")),
                            terrain=terr, thermal=thermal, reproduce_check=reproduce))

    # ---------------------------------------------------------------- atlas normalisation (versioned)
    scoreable = [dict(variables={c: (t["values"][c] if t["status"][c] in ("DIRECT", "PROXY") else None) for c in CRITERION_IDS})
                 for t in targets]
    atlas_ranges = compute_ranges(E, scoreable, CRITERION_IDS)
    norm = dict(id="atlas-norm-1", method="[min, max] over valid Earth cells and every atlas target value with status DIRECT or PROXY "
                                          "(src/compute/normalization.py::compute_ranges, unchanged)",
                ranges=atlas_ranges, baseline_ranges=app["ranges"],
                default="target",
                default_rule="Default for every atlas comparison: [min, max] over valid Earth cells and THIS target only, so a target's "
                             "ranking never depends on which other targets are catalogued (lunar ΔT ~280 K would otherwise compress the "
                             "thermal criterion for every Mars target). The catalogue-wide table above is offered as an alternative.",
                note="Distinct from the baseline normalisation; atlas comparison scores are not baseline Analogue Scores.")

    # ---------------------------------------------------------------- reference results (Python, for JS parity + offline display)
    lat = -90 + (E["cell"].astype(np.int64) // 576) * 0.5
    lon = -180 + (E["cell"].astype(np.int64) % 576) * 0.625
    Es = {c: E[c].astype(np.float64) for c in CRITERION_IDS}
    ref = {}
    for t in targets:
        if t["readiness"]["level"] < 2:
            continue
        tv = {c: (t["values"][c] if t["status"][c] == "DIRECT" else None) for c in CRITERION_IDS}
        w = MISSION_PROFILES["general"]["weights"]
        tr = {}
        for c in CRITERION_IDS:          # default table: Earth ∪ this target (same rule as compute_ranges)
            lo, hi = float(np.nanmin(E[c])), float(np.nanmax(E[c]))
            if tv[c] is not None:
                lo, hi = min(lo, float(tv[c])), max(hi, float(tv[c]))
            tr[c] = [lo, hi]
        r = similarity(Es, tv, w, tr)
        eff = effective_scores(r)
        ds = distinct_sites(eff, E["cell"].astype(np.int64), lat, lon, n=20, min_sep_km=300.0)
        ref[t["id"]] = dict(profile="general", normalisation="target", ranges=tr, criteria=r["active"], top=[dict(index=int(i), cell=int(E["cell"][i]), score=float(eff[i])) for i in ds],
                            eligible=int((eff >= 0).sum()))

    # ---------------------------------------------------------------- grids (binary, base64 text)
    parts, layout, off = [], [], 0
    for t in targets:
        tid = t["id"]
        p = os.path.join(RAW, f"terrain/{tid}.npz")
        arrs = []
        if os.path.exists(p):
            d = np.load(p); arrs += [("z", d["z"]), ("slope", d["slope"])]
        q = os.path.join(RAW, f"thermal_{tid}.npy")
        if os.path.exists(q):
            arrs.append(("dT", np.load(q).reshape(60, 60)))
        for name, a in arrs:
            a = np.ascontiguousarray(a, dtype="<f4")
            assert a.shape == (60, 60), (tid, name, a.shape)
            b = a.tobytes(); parts.append(b)
            layout.append(dict(target=tid, name=name, dtype="float32", shape=[60, 60], offset=off, length=3600, sha256=sha(b)))
            off += len(b)
    gbuf = b"".join(parts)
    open(os.path.join(PUB, "grids.b64.txt"), "wb").write(base64.b64encode(gbuf))
    files = dict(grids=dict(file="grids.b64.txt", sha256=sha(gbuf), bytes=len(gbuf), layout=layout,
                            note="Row 0 = north edge of the azimuthal-equidistant window (y = +27.8 km); column 0 = west edge; 926.6 m bins. "
                                 "Thermal dT grids for polar lunar targets: window means of T(13-14 h) - T(01-02 h) per bin."))
    # ---------------------------------------------------------------- Earth sub-cell
    sp = os.path.join(RAW, "earth_subcell.npz")
    if os.path.exists(sp):
        d = np.load(sp); m = json.loads(str(d["meta"]))
        cell = E["cell"].astype(np.int64)
        cols, slay, soff = [], [], 0
        n = d["n"][cell]
        cols.append(("n", np.minimum(n, 65535).astype("<u2")))
        for X in m["thresholds_deg"]:
            f = d[f"frac_le_{X}"][cell]
            cols.append((f"frac_le_{X}", np.where(np.isfinite(f), np.rint(f * 250), 255).astype("u1")))
        for q in (10, 50, 90):
            v = d[f"p{q}"][cell]
            cols.append((f"p{q}", np.where(np.isfinite(v), np.rint(v * 100), 65535).astype("<u2")))
        mean_slope = d["mean_slope"][cell]
        chk = np.isfinite(mean_slope) & np.isfinite(E["slope"])
        sbuf = b""
        for name, a in cols:
            b = a.tobytes(); slay.append(dict(name=name, dtype=str(a.dtype).replace("<", "").replace("|", ""), offset=soff, length=int(a.size),
                                              scale=0.004 if name.startswith("frac") else (0.01 if name[0] == "p" else 1),
                                              missing=255 if name.startswith("frac") else 65535 if name != "n" else None))
            sbuf += b; soff += len(b)
        open(os.path.join(PUB, "subcell.b64.txt"), "wb").write(base64.b64encode(sbuf))
        files["subcell"] = dict(file="subcell.b64.txt", sha256=sha(sbuf), bytes=len(sbuf), layout=slay, source=m,
                                check=dict(cells_compared=int(chk.sum()),
                                           max_abs_diff_mean_slope_vs_baseline=float(np.nanmax(np.abs(mean_slope[chk] - E["slope"][chk]))),
                                           median_abs_diff=float(np.nanmedian(np.abs(mean_slope[chk] - E["slope"][chk])))),
                                note="Fractions of 30-arc-second pixels per cell with Horn slope <= X deg; percentiles from a 0.25-deg histogram.")
        datasets["gmted_subcell"] = dict(dataset="GMTED2010 mn30 (sub-cell slope distribution)", product_id="mn30_grd", provider="USGS EROS / NGA",
                                         url=m["url"], doi=None, version="GMTED2010", retrieved=m["retrieved_utc"], period="static",
                                         crs=m["crs"][:60], resolution="30 arc-second", units="deg; fraction",
                                         processing="Same pixel-to-cell mapping and Horn slope as the baseline stack; per-cell histogram",
                                         quality_flags="n = pixels with defined slope", checksum=dict(zip_sha256=m["zip_sha256"]),
                                         license="USGS public domain", limitations="No connected-area geometry; slope only.")
    basemaps(files)

    atlas = dict(schema="asterro.atlas/1", version=ATLAS_VERSION, built_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                 stack_sha256=app["stack"]["sha256"], algorithm_version=app["algorithm_version"],
                 criteria=CRITERION_IDS, statuses=STATUSES, compatibility=TC.COMPATIBILITY,
                 incompatible_examples=TC.INCOMPATIBLE_EXAMPLES,
                 readiness_levels={str(k): dict(label=v[0], meaning=v[1]) for k, v in TC.READINESS.items()},
                 readiness_rule="L1: no DIRECT criterion; L2: 1-2 DIRECT; L3: >=3 DIRECT; L4: L3 and no UNVALIDATED value "
                                "(every value produced by a documented script from checksummed source data). "
                                "PROXY criteria never count. L1 targets never enter any ranking.",
                 kinds={"named_feature": "IAU-named feature sampled by a 55.6 km window at its gazetteer centre point",
                        "defined_region": "A target region defined by ASTERRO (explicit centre / offset / extent)",
                        "mission_region": "A landing or exploration region anchored at a published mission coordinate",
                        "observation_site": "A single catalogued observation location"},
                 normalisation=norm, reference=ref, datasets=datasets, files=files, targets=targets)
    json.dump(atlas, open(os.path.join(PUB, "atlas.json"), "w"), indent=1, allow_nan=False)
    for t in targets:
        print(f"{t['id']:30s} L{t['readiness']['level']} " + " ".join(f"{c[:5]}={t['status'][c][:4]}" for c in CRITERION_IDS))
    print("atlas ranges", {k: [round(a, 3), round(b, 3)] for k, (a, b) in atlas_ranges.items()})


if __name__ == "__main__":
    main()
