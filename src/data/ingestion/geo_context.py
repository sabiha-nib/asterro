"""Context layers (NOT used in any similarity computation).

1. Natural Earth 1:50m admin-0 countries and geography regions (public domain) -> per-cell
   country and named-region labels on the POWER grid, so result lists can say "Chile" or
   "Atacama Desert" instead of bare coordinates. Point-in-polygon on cell centres; cells
   whose centre falls outside every polygon get the nearest polygon within 1 degree.
2. Natural Earth 1:110m coastline polylines for the globe outline.
3. NASA GIBS BlueMarble_ShadedRelief (Blue Marble, MODIS composite) 2048x1024 JPEG as a
   dimmed visual basemap.
4. Hillshades of the actual MOLA (Jezero) and LOLA (south pole) DEM windows used for the
   target fingerprints -> SCIENTIFIC DATA thumbnails (no generative imagery).
"""
import io, json, subprocess, sys, zipfile
import numpy as np, requests

NE = "https://naciscdn.org/naturalearth/"
NLAT, NLON = 361, 576


def ne(path):
    r = requests.get(NE + path, timeout=120); r.raise_for_status()
    z = zipfile.ZipFile(io.BytesIO(r.content)); z.extractall("ne"); return z.namelist()


def labels():
    import shapefile
    from shapely.geometry import shape, Point
    from shapely.strtree import STRtree
    ne("50m/cultural/ne_50m_admin_0_countries.zip")
    ne("50m/physical/ne_50m_geography_regions_polys.zip")
    ne("110m/physical/ne_110m_coastline.zip")
    out = {}
    lat = -90 + 0.5 * np.arange(NLAT); lon = -180 + 0.625 * np.arange(NLON)
    for key, fn, field in [("country", "ne/ne_50m_admin_0_countries.shp", "NAME"),
                           ("region", "ne/ne_50m_geography_regions_polys.shp", "NAME")]:
        sf = shapefile.Reader(fn, encoding="latin1")
        names_f = [f[0] for f in sf.fields[1:]]
        geoms, names, feat = [], [], []
        for sr in sf.shapeRecords():
            rec = dict(zip(names_f, sr.record))
            geoms.append(shape(sr.shape.__geo_interface__)); names.append(str(rec.get(field) or rec.get("name") or ""))
            feat.append(str(rec.get("FEATURECLA", "")))
        tree = STRtree(geoms)
        idx = np.full((NLAT, NLON), -1, np.int16)
        for i in range(NLAT):
            for j in range(NLON):
                p = Point(lon[j], lat[i])
                hits = tree.query(p, predicate="intersects")
                if len(hits):
                    idx[i, j] = int(min(hits, key=lambda h: geoms[h].area))  # most specific
                elif key == "country":
                    k = tree.nearest(p)
                    if geoms[k].distance(p) <= 1.0:
                        idx[i, j] = int(k)
        out[key] = dict(idx=idx, names=names, featurecla=feat)
    sf = shapefile.Reader("ne/ne_110m_coastline.shp")
    lines = [[[round(x, 2), round(y, 2)] for x, y in s.points] for s in sf.shapes()]
    return out, lines


def bluemarble():
    q = dict(SERVICE="WMS", REQUEST="GetMap", VERSION="1.3.0", LAYERS="BlueMarble_ShadedRelief",
             CRS="EPSG:4326", BBOX="-90,-180,90,180", WIDTH=2048, HEIGHT=1024, FORMAT="image/jpeg")
    r = requests.get("https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi", params=q, timeout=120)
    r.raise_for_status(); open("bluemarble_2048.jpg", "wb").write(r.content)


def hillshade(z, az=315, alt=35, px=926.6):
    gy, gx = np.gradient(z, px)
    slope = np.arctan(np.hypot(gx, gy)); aspect = np.arctan2(-gx, gy)
    a, e = np.radians(az), np.radians(alt)
    hs = np.sin(e) * np.cos(slope) + np.cos(e) * np.sin(slope) * np.cos(a - aspect)
    return np.clip(hs, 0, 1)


def thumbs():
    """Higher-resolution crops (native DEM pixels) of the same windows, rendered as hillshade."""
    import rasterio
    from rasterio.windows import from_bounds
    from PIL import Image
    S3 = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/"
    ds = rasterio.open("/vsicurl/" + S3 + "Mars_MGS_MOLA_DEM_mosaic_global_463m.tif")
    R = 3396190.0; lat0, lon0 = 18.38, 77.58
    half = 27798.8 / R * 180 / np.pi * 1.35
    w = from_bounds(np.radians(lon0 - half / np.cos(np.radians(lat0))) * R, np.radians(lat0 - half) * R,
                    np.radians(lon0 + half / np.cos(np.radians(lat0))) * R, np.radians(lat0 + half) * R, ds.transform)
    z = ds.read(1, window=w.round_offsets().round_lengths()).astype(float)
    hs = hillshade(z, px=463.09)
    Image.fromarray((hs * 255).astype(np.uint8)).resize((320, 320), Image.LANCZOS).save("thumb_jezero_mola.png")
    ds = rasterio.open("/vsicurl/" + S3 + "Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif")
    # polar: reproject a small stereographic grid by sampling the equirectangular DEM
    Rm = 1737400.0; n = 320; half_m = 27798.8 * 1.35
    xs = np.linspace(-half_m, half_m, n)
    X, Y = np.meshgrid(xs, -xs)
    rho = np.hypot(X, Y); c = 2 * np.arctan(rho / (2 * Rm))
    lat = -(90 - np.degrees(c)); lon = np.degrees(np.arctan2(X, Y))
    wz = from_bounds(ds.transform.c, np.radians(-90) * Rm, ds.transform.c + ds.width * ds.transform.a,
                     np.radians(-88.2) * Rm, ds.transform).round_offsets().round_lengths()
    zz = ds.read(1, window=wz).astype(float) * float(ds.scales[0])
    wt = ds.window_transform(wz)
    col = ((np.radians(lon) * Rm - wt.c) / wt.a).astype(int) % zz.shape[1]
    row = np.clip(((np.radians(lat) * Rm - wt.f) / wt.e).astype(int), 0, zz.shape[0] - 1)
    zp = zz[row, col]
    hs = hillshade(zp, px=2 * half_m / n)
    Image.fromarray((hs * 255).astype(np.uint8)).save("thumb_southpole_lola.png")


def main():
    lab, lines = labels()
    np.savez_compressed("labels.npz", country_idx=lab["country"]["idx"], region_idx=lab["region"]["idx"])
    json.dump(dict(country_names=lab["country"]["names"], region_names=lab["region"]["names"],
                   region_featurecla=lab["region"]["featurecla"], coastline_110m=lines,
                   sources=dict(countries=NE + "50m/cultural/ne_50m_admin_0_countries.zip",
                                regions=NE + "50m/physical/ne_50m_geography_regions_polys.zip",
                                coastline=NE + "110m/physical/ne_110m_coastline.zip")),
              open("labels.json", "w"))
    bluemarble(); thumbs()
    subprocess.run("zip -q geo_context.zip labels.npz labels.json bluemarble_2048.jpg thumb_jezero_mola.png thumb_southpole_lola.png", shell=True, check=True)


if __name__ == "__main__":
    main()
