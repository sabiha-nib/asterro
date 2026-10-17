"""ASTERRO Phase IV — retain the raw source values behind each lunar thermal fingerprint, so that the
fingerprint can be regenerated OFFLINE by an independent test (readiness Level 4), and export the
gazetteer records needed by the planetary catalogue.

Network job (run beside the Phase III pipeline, same certificate bundles):
  python extract_raw_support.py OUT
Writes
  OUT/support/polar_<target>.npz   grid x/y vectors, the window's selected flat indices, and the
                                   source T(13-14 h) / T(01-02 h) values at those indices for each
                                   season, plus the SHA-256 of every source .grd file
  OUT/support/gcp_raw.npz          the exact bytes of every Diviner GCP HTTP range read used by the
                                   atlas (concatenated) with offsets and the band/bin of each read
  OUT/gazetteer_catalog.json       gazetteer records (incl. quadrangle) for catalogue features
Every retained read is checked against the SHA-256 recorded by the Phase III run; any mismatch
aborts the job (no value is replaced or patched).
"""
import hashlib, json, os, subprocess, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_atlas as BA            # Phase III pipeline module (unchanged)
import terrain

sha = lambda b: hashlib.sha256(b).hexdigest()

CATALOG_NAMES = {
    "MARS": ["Jezero", "Neretva Vallis", "Isidis Planitia", "Syrtis Major Planum", "Nili Fossae", "Gale", "Aeolis Mons",
             "Aeolis Mensae", "Elysium Planitia", "Elysium Mons", "Utopia Planitia", "Gusev", "Ma'adim Vallis", "Hellas Planitia",
             "Valles Marineris", "Noctis Labyrinthus", "Olympus Mons", "Arsia Mons", "Pavonis Mons", "Ascraeus Mons", "Tharsis Montes",
             "Arcadia Planitia", "Amazonis Planitia", "Schiaparelli", "Endeavour", "Meridiani Planum", "Chryse Planitia", "Ares Vallis",
             "Oxia Planum", "Mawrth Vallis", "Argyre Planitia", "Planum Boreum", "Planum Australe", "Medusae Fossae"],
    "MOON": ["Shackleton", "Cabeus", "Mons Malapert", "de Gerlache", "Haworth", "Faustini", "Nobile", "Peary", "Hermite",
             "Aristarchus", "Oceanus Procellarum", "Reiner Gamma", "Schrödinger", "Mare Orientale", "Fra Mauro", "Descartes",
             "Rima Hadley", "Montes Apenninus", "Taurus-Littrow", "Littrow", "Mare Tranquillitatis", "Mare Imbrium", "Mare Serenitatis",
             "Mare Crisium", "Copernicus", "Tycho", "Ina", "Marius", "Mare Frigoris"],
}


def gazetteer_export(out):
    G = BA.gazetteer()
    res = {}
    for B, names in CATALOG_NAMES.items():
        recs = G[B]["records"]
        for nm in names:
            hit = [r for r in recs if r["name"] == nm] or [r for r in recs if r["clean_name"] == nm.replace("ö", "o")]
            res[f"{B}:{nm}"] = None if len(hit) != 1 else {k: hit[0][k] for k in ("name", "clean_name", "center_lat", "center_lon", "diameter", "type", "approval",
                                                                                   "approvaldt", "origin", "quad_name", "quad_code", "min_lat", "max_lat", "min_lon", "max_lon", "link")}
    meta = {B: dict(url=G[B]["url"], zip_sha256=G[B]["zip_sha256"]) for B in G}
    json.dump(dict(features=res, gazetteer=meta), open(f"{out}/gazetteer_catalog.json", "w"), indent=1, default=str)
    print("gazetteer:", sum(v is not None for v in res.values()), "of", len(res), "names matched;",
          "unmatched:", [k for k, v in res.items() if v is None])


def polar_support(out):
    R = json.load(open(f"{out}/resolved.json"))
    rec = json.load(open(f"{out}/thermal_polar.json"))
    cache = f"{out}/cache"; half = terrain.WIN_M / 2; RM = 1737400.0
    os.makedirs(f"{out}/support", exist_ok=True)
    targets = [t for t in R["targets"] if t["body"] == "Moon" and abs(t["lat"]) >= 80.5]
    for hemi in ("south", "north"):
        tt = [t for t in targets if (t["lat"] < 0) == (hemi == "south")]
        grids, xs, ys, digests = {}, None, None, {}
        for season in ("summer", "winter"):
            for hr in ("14", "02"):
                name = f"polar_{hemi}_80_{season}_tbol-hour{hr}.grd"
                x, y, z, h = BA.fetch_grd(hemi, name, cache)
                want = rec["meta"]["files"][f"{hemi}/{name}"]["sha256"]
                if h != want:
                    raise SystemExit(f"checksum mismatch for {name}: {h} != {want}")
                grids[(season, hr)] = z; xs, ys = x, y; digests[name] = h
        X1, Y1 = np.meshgrid(xs, ys)
        lat, lon = BA.polar_lonlat(X1, Y1, hemi)
        for t in tt:
            if t["id"] == "moon_south_pole":
                hh = half / 1000 / 1737.4
                sel = (np.abs(X1) <= hh) & (np.abs(Y1) <= hh)
            else:
                X, Y = BA.ae(t["lat"], t["lon"], lat, lon, RM)
                sel = (np.abs(X) <= half) & (np.abs(Y) <= half)
            idx = np.flatnonzero(sel.ravel())
            arrs = {f"{s}_{hr}": grids[(s, hr)].ravel()[idx].astype(np.float32) for s in ("summer", "winter") for hr in ("14", "02")}
            np.savez_compressed(f"{out}/support/polar_{t['id']}.npz", x=xs.astype(np.float64), y=ys.astype(np.float64), idx=idx.astype(np.int64),
                                hemi=hemi, center=np.array([t["lat"], t["lon"]]), digests=json.dumps(digests), **arrs)
            print("polar", t["id"], idx.size)


def gcp_support(out):
    G = json.load(open(f"{out}/thermal_gcp.json"))
    reads = G["meta"]["range_reads"]
    blobs, index = [], []
    off = 0
    for key, want in sorted(reads.items()):
        url, bins = key.split("#"); ilon, ilat = map(int, bins.split(","))
        band = url.rsplit("/", 1)[1]
        lo = int(band[21:23]) if band[23] == "n" else -int(band[21:23])
        assert BA.GCP + BA.band_name(lo, lo + 10) == url, (url, lo)
        k = (ilon * 20 + ilat) * 96; o = 113 * (1 + k)
        r = subprocess.run(["curl", "-sSLf", *BA.CURL_PDS, "-r", f"{o}-{o + 113 * 96 - 1}", url], capture_output=True, check=True)
        if sha(r.stdout) != want:
            raise SystemExit(f"GCP read digest mismatch {key}")
        blobs.append(r.stdout); index.append(dict(key=key, url=url, ilon=ilon, ilat=ilat, band_lo=lo, offset=off, length=len(r.stdout), sha256=want))
        off += len(r.stdout)
    os.makedirs(f"{out}/support", exist_ok=True)
    np.savez_compressed(f"{out}/support/gcp_raw.npz", raw=np.frombuffer(b"".join(blobs), dtype=np.uint8), index=json.dumps(index))
    print("gcp reads retained:", len(index), "bytes:", off)


if __name__ == "__main__":
    out = sys.argv[1]
    gazetteer_export(out)
    polar_support(out)
    gcp_support(out)
