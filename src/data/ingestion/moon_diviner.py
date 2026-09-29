"""Lunar South Pole thermal fingerprint from LRO Diviner polar hourly maps.

Product : Williams et al. (2019) "Seasonal polar temperatures on the Moon", JGR 124, 2505-2521,
          doi:10.1029/2019JE006028. Diviner nadir RDR 2009-07-05 .. 2019-02-17 binned at 240 m,
          polar stereographic, bolometric brightness temperature (K).
          https://luna1.diviner.ucla.edu/~jpierre/diviner/level4_polar/hourly_maps/south/
          (PDS-archived counterparts: .../level4_polar/pds/)
Files   : polar_south_80_{summer,winter}_tbol-hour14.grd (LTIM 13.00-14.00 h)
          polar_south_80_{summer,winter}_tbol-hour02.grd (LTIM 01.00-02.00 h)
          hourNN = mean of the four 0.25-h local-time maps covering (NN-1, NN] h.
Window  : 55.6 km x 55.6 km square centred on the south pole (identical to the terrain window);
          x, y in the grids are distances from the pole normalised by R = 1737.4 km.
lst_diurnal_range_K = mean over the two seasons of the window mean of [T(13-14h) - T(01-02h)],
          using only bins valid at both local times -> same local times as MODIS Aqua 13:30/01:30.
TLS note: the host serves an incomplete chain and a legacy DH key; we verify the certificate
          against the system bundle plus the issuer's AIA intermediate (InCommon RSA Server CA 2)
          and permit OpenSSL SECLEVEL=1 ciphers. Certificate verification stays ON.
"""
import json, subprocess, sys
import numpy as np

BASE = "https://luna1.diviner.ucla.edu/~jpierre/diviner/level4_polar/hourly_maps/south/"
R_KM = 1737.4
HALF_KM = 27.7988


def fetch(name):
    subprocess.run(["curl", "-sSf", "--cacert", "bundle.pem", "--ciphers", "DEFAULT@SECLEVEL=1",
                    "-o", name, BASE + name], check=True)
    import netCDF4
    d = netCDF4.Dataset(name)
    z = np.ma.filled(d.variables["z"][:].astype(np.float64), np.nan)
    return d.variables["x"][:].astype(np.float64), d.variables["y"][:].astype(np.float64), z


def main(out="moon_diviner.json"):
    res = {}
    for season in ("summer", "winter"):
        x, y, t14 = fetch(f"polar_south_80_{season}_tbol-hour14.grd")
        _, _, t02 = fetch(f"polar_south_80_{season}_tbol-hour02.grd")
        h = HALF_KM / R_KM
        mx = np.abs(x) <= h; my = np.abs(y) <= h
        a14 = t14[np.ix_(my, mx)]; a02 = t02[np.ix_(my, mx)]
        ok = np.isfinite(a14) & np.isfinite(a02)
        d = a14[ok] - a02[ok]
        res[season] = dict(mean_dT_K=float(d.mean()), median_dT_K=float(np.median(d)),
                           p10_dT_K=float(np.percentile(d, 10)), p90_dT_K=float(np.percentile(d, 90)),
                           mean_T14_K=float(a14[ok].mean()), mean_T02_K=float(a02[ok].mean()),
                           bins_valid=int(ok.sum()), bins_total=int(ok.size))
    res["lst_diurnal_range_K"] = float(np.mean([res[s]["mean_dT_K"] for s in ("summer", "winter")]))
    res["window_km"] = 2 * HALF_KM
    res["source"] = BASE
    json.dump(res, open(out, "w"), indent=1)
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main(*sys.argv[1:])
