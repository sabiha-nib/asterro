"""ASTERRO Phase III — Planetary Target Atlas data pipeline (network job).

Runs where USGS / PDS hosts are reachable. Uses the UNCHANGED baseline terrain algorithm
(src/data/ingestion/terrain.py :: planet_window) for every target window, and the same
Diviner local-time definition as the baseline (src/data/ingestion/moon_diviner.py).

  python build_atlas.py resolve      OUT   -> OUT/resolved.json   (gazetteer lookup, anchors)
  python build_atlas.py terrain      OUT   -> OUT/terrain/*.json, *.npz  (primary + ring windows)
  python build_atlas.py polar        OUT   -> OUT/thermal_polar.json (+ 60x60 dT grids)
  python build_atlas.py gcp          OUT   -> OUT/thermal_gcp.json
  python build_atlas.py basemap      OUT   -> OUT/basemap_{mars,moon}.npz

Every product records: dataset, product id, provider, URL, version/ETag, retrieval time,
CRS, resolution, units, processing, quality flags, checksum, licence statement, limitations.
No value is invented: if a read fails or coverage is incomplete, the record says so.
"""
import hashlib, json, math, os, subprocess, sys, time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import terrain                     # unchanged copy of src/data/ingestion/terrain.py
import target_catalog as TC        # copy of src/phase3/target_catalog.py

S3 = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/"
DEM = {"Mars": dict(url=S3 + "Mars_MGS_MOLA_DEM_mosaic_global_463m.tif", R=3396190.0,
                    dataset="MGS MOLA DEM mosaic global 463 m (USGS Astrogeology)",
                    product_id="Mars_MGS_MOLA_DEM_mosaic_global_463m"),
       "Moon": dict(url=S3 + "Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif", R=1737400.0,
                    dataset="LRO LOLA Global LDEM 118 m, March 2014 (USGS Astrogeology)",
                    product_id="Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014")}
GAZ_ZIP = "https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/{B}_nomenclature_center_pts.zip"
DIV_POLAR = "https://luna1.diviner.ucla.edu/~jpierre/diviner/level4_polar/hourly_maps/{h}/"
GCP = "https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_gcp/"
CURL_DIV = ["--cacert", "bundle.pem", "--ciphers", "DEFAULT@SECLEVEL=1"]
CURL_PDS = ["--cacert", "pdsb.pem"]
LIC_USGS = ("NASA / USGS planetary data products; U.S. Government work, generally not subject to "
            "copyright in the U.S. Cite the product. (Licence not restated by the provider page.)")
NOW = lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def sha(b):
    return hashlib.sha256(b).hexdigest()


def head(url, extra=()):
    r = subprocess.run(["curl", "-sSIL", *extra, url], capture_output=True, text=True)
    h = {}
    for line in r.stdout.splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            h[k.strip().lower()] = v.strip()
    return {k: h.get(k) for k in ("etag", "last-modified", "content-length")}


def wrap180(lon):
    return ((lon + 180.0) % 360.0) - 180.0


def dest(lat, lon, dist_m, brg_deg, R):
    """Great-circle destination point."""
    p1, l1, b, d = math.radians(lat), math.radians(lon), math.radians(brg_deg), dist_m / R
    p2 = math.asin(math.sin(p1) * math.cos(d) + math.cos(p1) * math.sin(d) * math.cos(b))
    l2 = l1 + math.atan2(math.sin(b) * math.sin(d) * math.cos(p1), math.cos(d) - math.sin(p1) * math.sin(p2))
    return math.degrees(p2), wrap180(math.degrees(l2))


# ------------------------------------------------------------------ gazetteer
def gazetteer():
    import shapefile
    out = {}
    for B in ("MARS", "MOON"):
        if not os.path.exists(f"{B}/{B}_nomenclature_center_pts.shp"):
            subprocess.run(["curl", "-sSf", "-o", f"{B}.zip", GAZ_ZIP.format(B=B)], check=True)
            subprocess.run(["unzip", "-q", "-o", f"{B}.zip", "-d", B], check=True)
        r = shapefile.Reader(f"{B}/{B}_nomenclature_center_pts")
        names = [f[0] for f in r.fields[1:]]
        recs = [dict(zip(names, rec)) for rec in r.records()]
        zb = open(f"{B}.zip", "rb").read() if os.path.exists(f"{B}.zip") else b""
        out[B] = dict(records=recs, zip_sha256=sha(zb) if zb else None, url=GAZ_ZIP.format(B=B))
    return out


def find_feature(G, body, name):
    recs = G["MARS" if body == "Mars" else "MOON"]["records"]
    hit = [r for r in recs if r["name"] == name] or \
          [r for r in recs if r["clean_name"] == name.replace("ö", "o")]
    if len(hit) != 1:
        raise KeyError(f"{body}:{name}: {len(hit)} gazetteer matches")
    h = hit[0]
    return dict(name=h["name"], clean_name=h["clean_name"], lat=float(h["center_lat"]),
                lon_e=float(h["center_lon"]), diameter_km=float(h["diameter"]) if h["diameter"] else None,
                type=h["type"], approval=h["approval"], link=h["link"],
                extent=dict(min_lat=h["min_lat"], max_lat=h["max_lat"], min_lon=h["min_lon"], max_lon=h["max_lon"]))


def resolve(out):
    G = gazetteer()
    res = []
    for t in TC.TARGETS:
        a = t["anchor"]; body = t["body"]; R = DEM[body]["R"]
        rec = dict(id=t["id"], body=body, anchor_type=a["type"])
        feat = None
        if a.get("feature") or a.get("gazetteer"):
            feat = find_feature(G, body, a.get("feature") or a.get("gazetteer"))
            rec["gazetteer"] = feat
        if a["type"] in ("baseline", "mission", "pole"):
            lat, lon = a["lat"], wrap180(a["lon"])
            rec["source"] = a.get("source", "ASTERRO baseline definition" if a["type"] == "baseline" else "pole")
        elif a["type"] == "gazetteer":
            lat, lon = feat["lat"], wrap180(feat["lon_e"]); rec["source"] = TC.GAZ + " " + feat["link"]
        elif a["type"] == "offset":
            lat, lon = dest(feat["lat"], wrap180(feat["lon_e"]), a["distance_km"] * 1000, a["bearing_deg"], R)
            rec["source"] = f"{a['distance_km']} km at bearing {a['bearing_deg']} deg from gazetteer centre of {feat['name']}"
        rec["lat"], rec["lon"] = lat, lon
        if t.get("sample_ring"):
            D = feat["diameter_km"]
            rec["ring"] = [dict(k=i, bearing_deg=45 * i, distance_km=0.25 * D,
                                **dict(zip(("lat", "lon"), dest(lat, lon, 0.25 * D * 1000, 45 * i, R))))
                           for i in range(8)]
        res.append(rec)
    meta = {B: dict(url=G[B]["url"], zip_sha256=G[B]["zip_sha256"], n_features=len(G[B]["records"])) for B in G}
    json.dump(dict(targets=res, gazetteer=meta, retrieved_utc=NOW()), open(f"{out}/resolved.json", "w"), indent=1)
    print(json.dumps(res, indent=0)[:4000])


# ------------------------------------------------------------------ terrain
def window(body, lat, lon, force_rows=None):
    D = DEM[body]; R = D["R"]
    deg_per_m = 180 / (math.pi * R); half = terrain.WIN_M / 2
    dlat = 1.6 * half * deg_per_m
    dlon = dlat / max(math.cos(math.radians(lat)), 1e-3)
    mode = "box"; rows = None
    if force_rows:
        rows, mode = force_rows, "band"
    elif abs(lat) + dlat > 90 or dlon > 180:
        corner = 1.45 * half * deg_per_m          # > sqrt(2)*half: covers the window corners
        rows = (-90.0, lat + corner) if lat < 0 else (lat - corner, 90.0)
        mode = "band(polar)"
    elif lon - dlon < -180 or lon + dlon > 180:
        rows, mode = (lat - dlat, lat + dlat), "band(antimeridian)"
    res, core, sl = terrain.planet_window(D["url"], lat, lon, R, rows_lat=rows)
    res["read_mode"] = mode
    res["rows_lat"] = rows
    res["grid_sha256"] = sha(core.tobytes() + sl.tobytes())
    res["complete"] = res["bins_filled"] == 3600 and bool(np.isfinite(sl).all())
    return res, core, sl


def do_terrain(out, only=None):
    R = json.load(open(f"{out}/resolved.json"))
    os.makedirs(f"{out}/terrain", exist_ok=True)
    for t in R["targets"]:
        if only and t["id"] not in only:
            continue
        fn = f"{out}/terrain/{t['id']}.json"
        if os.path.exists(fn):
            continue
        t0 = time.time()
        try:
            if t["id"] == "moon_south_pole":       # baseline definition, reproduced exactly
                res, core, sl = window("Moon", -90.0, 0.0, force_rows=(-90.0, -88.6))
            elif t["id"] == "moon_north_pole":
                res, core, sl = window("Moon", 90.0, 0.0, force_rows=(88.6, 90.0))
            else:
                res, core, sl = window(t["body"], t["lat"], t["lon"])
            rec = dict(id=t["id"], primary=res, seconds=round(time.time() - t0, 1))
            np.savez_compressed(f"{out}/terrain/{t['id']}.npz", z=core, slope=sl)
            ring = []
            for w in t.get("ring", []):
                r, _, _ = window(t["body"], w["lat"], w["lon"])
                ring.append(dict(w, **{k: r[k] for k in ("slope_deg", "surface_roughness_m", "elevation_m",
                                                         "slope_p90_deg", "bins_filled", "complete", "read_mode", "grid_sha256")}))
            if ring:
                rec["ring"] = ring
        except Exception as e:                      # recorded, never replaced by a value
            rec = dict(id=t["id"], error=repr(e))
        json.dump(rec, open(fn, "w"), indent=1)
        print(t["id"], rec.get("primary", {}).get("slope_deg"), rec.get("error"), round(time.time() - t0, 1), flush=True)
    prov = {b: dict(D, provider="USGS Astrogeology Science Center (PDS Imaging Node / Annex mosaic)",
                    version_headers=head(D["url"]), licence=LIC_USGS) for b, D in DEM.items()}
    json.dump(prov, open(f"{out}/terrain_provenance.json", "w"), indent=1)


# ------------------------------------------------------------------ Diviner polar (Williams et al. 2019)
def polar_lonlat(x, y, hemi):
    """Diviner level-4 polar grids: polar stereographic, x,y normalised by R=1737.4 km.
    colat = 2*atan(r/2). south: lon = atan2(x, y); north: lon = atan2(x, -y)
    (both verified against the provider's .txt rows: x, y, clon, clat)."""
    r = np.hypot(x, y)
    colat = 2 * np.arctan(r / 2)
    lat = (np.pi / 2 - colat) if hemi == "north" else (colat - np.pi / 2)
    lon = np.arctan2(x, -y) if hemi == "north" else np.arctan2(x, y)
    return np.degrees(lat), np.degrees(lon)


def ae(lat0, lon0, lat, lon, R):
    p0, l0, p, l = map(np.radians, (lat0, lon0, lat, lon))
    cosc = np.clip(np.sin(p0) * np.sin(p) + np.cos(p0) * np.cos(p) * np.cos(l - l0), -1, 1)
    c = np.arccos(cosc)
    k = np.where(c > 1e-12, c / np.maximum(np.sin(c), 1e-12), 1.0)
    X = R * k * np.cos(p) * np.sin(l - l0)
    Y = R * k * (np.cos(p0) * np.sin(p) - np.sin(p0) * np.cos(p) * np.cos(l - l0))
    return X, Y


def fetch_grd(hemi, name, cache):
    import netCDF4
    fn = f"{cache}/{hemi}_{name}"
    if not os.path.exists(fn):
        subprocess.run(["curl", "-sSf", *CURL_DIV, "-o", fn, DIV_POLAR.format(h=hemi) + name], check=True)
    d = netCDF4.Dataset(fn)
    z = np.ma.filled(d.variables["z"][:].astype(np.float64), np.nan)
    return d.variables["x"][:].astype(np.float64), d.variables["y"][:].astype(np.float64), z, sha(open(fn, "rb").read())


def do_polar(out):
    R = json.load(open(f"{out}/resolved.json"))
    cache = f"{out}/cache"; os.makedirs(cache, exist_ok=True)
    targets = [t for t in R["targets"] if t["body"] == "Moon" and abs(t["lat"]) >= 80.5]
    half = terrain.WIN_M / 2; RM = 1737400.0; n = 60
    res, files = {}, {}
    for hemi in ("south", "north"):
        tt = [t for t in targets if (t["lat"] < 0) == (hemi == "south")]
        if not tt:
            continue
        acc = {t["id"]: {} for t in tt}
        for season in ("summer", "winter"):
            g = {}
            for hr in ("14", "02"):
                name = f"polar_{hemi}_80_{season}_tbol-hour{hr}.grd"
                x, y, z, h = fetch_grd(hemi, name, cache)
                files[f"{hemi}/{name}"] = dict(sha256=h, url=DIV_POLAR.format(h=hemi) + name,
                                               headers=head(DIV_POLAR.format(h=hemi) + name, CURL_DIV))
                g[hr] = z
            X1, Y1 = np.meshgrid(x, y)
            lat, lon = polar_lonlat(X1, Y1, hemi)
            for t in tt:
                if t["id"] == "moon_south_pole":       # baseline window definition (|x|,|y| <= h)
                    hh = half / 1000 / 1737.4
                    sel = (np.abs(X1) <= hh) & (np.abs(Y1) <= hh)
                    X = X1 * 1737.4e3; Y = Y1 * 1737.4e3
                else:
                    X, Y = ae(t["lat"], t["lon"], lat, lon, RM)
                    sel = (np.abs(X) <= half) & (np.abs(Y) <= half)
                a14, a02 = g["14"][sel], g["02"][sel]
                ok = np.isfinite(a14) & np.isfinite(a02)
                d = a14[ok] - a02[ok]
                # 60x60 map on the terrain grid (926.6 m bins) for spatial modules
                ix = np.floor((X[sel][ok] + half) / terrain.BASE_M).astype(int)
                iy = np.floor((half - Y[sel][ok]) / terrain.BASE_M).astype(int)
                m = (ix >= 0) & (ix < n) & (iy >= 0) & (iy < n)
                cnt = np.bincount(iy[m] * n + ix[m], minlength=n * n)
                sm = np.bincount(iy[m] * n + ix[m], weights=d[m], minlength=n * n)
                acc[t["id"]][season] = dict(
                    mean_dT_K=float(d.mean()) if d.size else None,
                    median_dT_K=float(np.median(d)) if d.size else None,
                    p10_dT_K=float(np.percentile(d, 10)) if d.size else None,
                    p90_dT_K=float(np.percentile(d, 90)) if d.size else None,
                    mean_T14_K=float(a14[ok].mean()) if d.size else None,
                    mean_T02_K=float(a02[ok].mean()) if d.size else None,
                    bins_valid=int(ok.sum()), bins_total=int(ok.size),
                    _grid=np.where(cnt > 0, sm / np.maximum(cnt, 1), np.nan).astype(np.float32))
        for tid, A in acc.items():
            grids = [A[s].pop("_grid") for s in ("summer", "winter")]
            vals = [A[s]["mean_dT_K"] for s in ("summer", "winter")]
            A["lst_diurnal_range_K"] = float(np.mean(vals)) if all(v is not None for v in vals) else None
            A["valid_fraction"] = min(A[s]["bins_valid"] / max(A[s]["bins_total"], 1) for s in ("summer", "winter"))
            with np.errstate(invalid="ignore"):
                G = np.nanmean(np.stack(grids), axis=0).astype(np.float32)
            np.save(f"{out}/thermal_{tid}.npy", G)
            A["grid_sha256"] = sha(G.tobytes())
            res[tid] = A
    meta = dict(dataset="LRO Diviner level-4 polar hourly bolometric temperature maps (Williams et al. 2019, "
                        "JGR Planets 124, 2505-2521, doi:10.1029/2019JE006028)",
                provider="UCLA Diviner team (J.-P. Williams); PDS-archived counterparts exist",
                period="2009-07-05 to 2019-02-17 (per product description)", crs="polar stereographic, R=1737.4 km",
                resolution_m=240, units="K", files=files, retrieved_utc=NOW(),
                processing="window mean over bins valid at both local times of T(13-14 h) - T(01-02 h); mean of summer and winter",
                licence="NASA mission data product; licence not stated by the provider; cite Williams et al. (2019)",
                limitations="Bolometric brightness temperature, not MODIS split-window LST; polar seasons only (2 of 4); "
                            "permanently shadowed areas dominate some windows.")
    json.dump(dict(meta=meta, targets=res), open(f"{out}/thermal_polar.json", "w"), indent=1)
    print(json.dumps({k: (v["lst_diurnal_range_K"], v["valid_fraction"]) for k, v in res.items()}))


# ------------------------------------------------------------------ Diviner GCP global (Williams et al. 2017)
GCP_BANDS = [(-90 + 10 * i, -80 + 10 * i) for i in range(18)]


def band_name(lo, hi):
    return f"global_cumul_avg_cyl_{lo:02d}n{hi:02d}n_002.tab" if lo >= 0 else f"global_cumul_avg_cyl_{-lo:02d}s{-hi:02d}s_002.tab"


def gcp_bin(lo, ilon, ilat):
    """All 96 local-time records of one 0.5-deg bin by HTTP Range read; row order verified:
    record k = (ilon*20 + ilat)*96 + ilt, 113 bytes, 1 header record."""
    url = GCP + band_name(lo, lo + 10)
    k = (ilon * 20 + ilat) * 96
    o = 113 * (1 + k)
    for a in range(5):
        r = subprocess.run(["curl", "-sSLf", *CURL_PDS, "-r", f"{o}-{o + 113 * 96 - 1}", url], capture_output=True)
        if r.returncode == 0 and len(r.stdout) == 113 * 96:
            break
        time.sleep(2 + 2 * a)
    else:
        raise IOError(f"range read failed {url} {o}")
    rows = [l.split(",") for l in r.stdout.decode().split("\r\n") if l.strip()]
    A = np.array([[float(v) for v in row] for row in rows])
    exp_lon = -179.75 + 0.5 * ilon; exp_lat = lo + 0.25 + 0.5 * ilat
    assert abs(A[0, 0] - exp_lon) < 1e-6 and abs(A[0, 1] - exp_lat) < 1e-6 and abs(A[0, 2] - 0.12) < 0.01, (A[0, :3], exp_lon, exp_lat)
    return A, sha(r.stdout), url


def do_gcp(out):
    R = json.load(open(f"{out}/resolved.json"))
    half = terrain.WIN_M / 2; RM = 1737400.0
    res = {}; reads = {}
    targets = [t for t in R["targets"] if t["body"] == "Moon" and abs(t["lat"]) < 80.5]
    for t in targets:
        pts = [(t["lat"], t["lon"], None)] + [(w["lat"], w["lon"], w["k"]) for w in t.get("ring", [])]
        per = []
        for lat0, lon0, k in pts:
            # candidate bin centres within the AE square
            lats = np.arange(-89.75, 90, 0.5); lons = np.arange(-179.75, 180, 0.5)
            LA, LO = np.meshgrid(lats, lons, indexing="ij")
            near = (np.abs(LA - lat0) < 2.5)
            X, Y = ae(lat0, lon0, LA[near], LO[near], RM)
            sel = (np.abs(X) <= half) & (np.abs(Y) <= half)
            cl, co = LA[near][sel], LO[near][sel]
            dts, t14s, t02s, used = [], [], [], 0
            for la, lo_ in zip(cl, co):
                lo = int(math.floor(la / 10) * 10)
                ilat = int(round((la - lo - 0.25) / 0.5)); ilon = int(round((lo_ + 179.75) / 0.5))
                A, h, url = gcp_bin(lo, ilon, ilat)
                reads[f"{url}#{ilon},{ilat}"] = h
                tb = A[:, 10]; lt = A[:, 2]
                tb = np.where(tb <= -9998, np.nan, tb)
                d14 = tb[(lt > 13) & (lt < 14)]; d02 = tb[(lt > 1) & (lt < 2)]
                if np.isfinite(d14).sum() >= 2 and np.isfinite(d02).sum() >= 2:
                    t14 = float(np.nanmean(d14)); t02 = float(np.nanmean(d02))
                    dts.append(t14 - t02); t14s.append(t14); t02s.append(t02); used += 1
            per.append(dict(k=k, lat=lat0, lon=lon0, bins_in_window=int(sel.sum()), bins_used=used,
                            lst_diurnal_range_K=float(np.mean(dts)) if dts else None,
                            mean_T14_K=float(np.mean(t14s)) if t14s else None, mean_T02_K=float(np.mean(t02s)) if t02s else None,
                            min_bin_dT_K=float(np.min(dts)) if dts else None, max_bin_dT_K=float(np.max(dts)) if dts else None))
        res[t["id"]] = dict(primary=per[0], ring=per[1:])
        print(t["id"], per[0], flush=True)
    meta = dict(dataset="LRO Diviner Global Cumulative Products (GCP), DATA_SET_ID LRO-L-DLRE-5-GCP-V1.0, "
                        "PRODUCT_VERSION_ID 1 (_002 files); Williams et al. (2017) Icarus 283, 300-325",
                provider="NASA PDS Geosciences Node (Washington University in St. Louis)",
                period="2009-07-05 to 2015-04-01", crs="simple cylindrical, R=1737.4 km, east-positive",
                resolution="0.5 deg x 0.5 deg x 0.25 h local time", units="K (tbol column)",
                processing="per 0.5-deg bin: mean of valid 0.25-h tbol records with 13<LT<14 minus 1<LT<2 (>=2 of 4 valid each); "
                           "window value = mean over bins whose centres fall inside the 55.6 km AE square",
                range_reads=reads, retrieved_utc=NOW(),
                licence="NASA PDS archive product; licence not restated; cite Williams et al. (2017)",
                limitations="0.5-deg bins are coarse relative to the 55.6 km window (few bins); cumulative average over all seasons; "
                            "bolometric brightness temperature, not MODIS split-window LST.")
    json.dump(dict(meta=meta, targets=res), open(f"{out}/thermal_gcp.json", "w"), indent=1)


# ------------------------------------------------------------------ basemaps (context only)
def do_basemap(out, W=1440, H=720):
    import rasterio
    from rasterio.windows import Window
    for body, D in DEM.items():
        fn = f"{out}/basemap_{body.lower()}.npz"
        if os.path.exists(fn):
            continue
        ds = rasterio.open("/vsicurl/" + D["url"])
        step = ds.height // H; cw = ds.width // W
        img = np.zeros((H, W), np.float32)
        for i in range(H):
            row = ds.read(1, window=Window(0, i * step + step // 2, ds.width, 1)).astype(np.float64)[0]
            row[row == ds.nodata] = np.nan
            row = row * float(ds.scales[0]) + float(ds.offsets[0])
            with np.errstate(invalid="ignore"):
                img[i] = np.nanmean(row[: W * cw].reshape(W, cw), axis=1)
            if i % 120 == 0:
                print(body, i, flush=True)
        np.savez_compressed(fn, elev=img, meta=json.dumps(dict(
            url=D["url"], product_id=D["product_id"], method=f"row {step}//2 of every {step} rows, mean of {cw} columns",
            shape=[H, W], units="m (relative to the product datum; context only, never compared)", retrieved_utc=NOW())))


if __name__ == "__main__":
    cmd, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    dict(resolve=resolve, terrain=do_terrain, polar=do_polar, gcp=do_gcp, basemap=do_basemap)[cmd](out, *sys.argv[3:])
