"""NASA GIBS (Global Imagery Browse Services) WMS imagery decoded to physical values with the layer's published
GIBS colormap (v1.3), then aggregated to ASTERRO cells. Same method as the V17 MODIS LST ingestion
(src/data/ingestion/modis_lst_gibs.py), generalised to any GIBS colormap.

Raw      : data/v19/raw/gibs/asterro_gibs_<LAYER>.json.gz holds, for every requested date, the PNG exactly as
           served (base64), its URL, retrieval time and SHA-256, plus the colormap XML as served and its SHA-256.
Decoding : every RGBA pixel is matched to a colormap entry by its RGB value. An entry with a value interval
           [a, b) decodes to its midpoint (quantisation +-(b-a)/2); open-ended bins (-INF / +INF) are censored and
           become missing; classification entries decode to their class code; nodata entries become missing.
           Fully transparent pixels whose RGB is not a colormap entry are missing.
Grid     : pixel centres are assigned to the ASTERRO cell whose centre is nearest (row = round((lat+90)/0.5),
           column = round((lon+180)/0.625)), as in V17.
Validation (a failure stops the build): PNG and colormap hashes match; the PNG size equals the requested size;
           no opaque pixel carries a colour absent from the colormap; one RGB never maps to two meanings.
Limits   : GIBS imagery is a visualisation product. Values are quantised to the colormap bins, censored at its ends,
           and WMS resampling is nearest-neighbour at the requested resolution. These are not the science files
           (HDF/NetCDF), which require an Earthdata Login.
"""
import base64, hashlib, io, re
import numpy as np
from PIL import Image
from .common import NLAT, NLON, load_raw

ENTRY = re.compile(r"<ColorMapEntry\s+([^>]*?)/>")
ATTR = re.compile(r'(\w+)="([^"]*)"')


class ValidationError(Exception):
    pass


def parse_colormap(xml):
    """rgb int -> dict(kind='value'|'class'|'nodata'|'censored', v=float|int|None, transparent=bool)."""
    lut = {}
    for m in ENTRY.finditer(xml):
        a = dict(ATTR.findall(m.group(1)))
        r, g, b = (int(x) for x in a["rgb"].split(","))
        key = (r << 16) | (g << 8) | b
        tr = a.get("transparent") == "true"
        if a.get("nodata") == "true":
            e = {"kind": "nodata", "v": None, "transparent": tr}
        elif "value" in a and a["value"].startswith("[") and "," not in a["value"]:
            e = {"kind": "value", "v": float(a["value"].strip("[]")), "half": 0.0, "transparent": tr}
        elif "value" in a and a["value"].startswith("["):
            lo, hi = a["value"].strip("[]()").split(",")
            if "INF" in lo and "INF" in hi:
                e = {"kind": "censored", "v": None, "transparent": tr, "bin": a["value"]}
            elif "INF" in hi:      # open-ended top bin: kept at its lower bound and flagged (a value "at least lo")
                e = {"kind": "censored_high", "v": float(lo), "transparent": tr, "bin": a["value"]}
            elif "INF" in lo:      # open-ended bottom bin: kept at its upper bound and flagged ("below hi")
                e = {"kind": "censored_low", "v": float(hi), "transparent": tr, "bin": a["value"]}
            else:
                lo, hi = float(lo), float(hi)
                e = {"kind": "value", "v": (lo + hi) / 2, "half": (hi - lo) / 2, "transparent": tr}
        elif "value" in a:
            e = {"kind": "value", "v": float(a["value"]), "half": 0.0, "transparent": tr}
        else:
            sv = a.get("sourceValue", "")
            if sv.startswith("["):  # e.g. [250] classification codes in a mixed map
                e = {"kind": "class", "v": int(float(sv.strip("[]"))), "transparent": tr}
            else:
                e = {"kind": "class", "v": [int(x) for x in sv.split(",")] if "," in sv else int(sv), "transparent": tr}
        if key in lut and lut[key] != e:
            raise ValidationError(f"colour {a['rgb']} has two meanings in the colormap")
        lut[key] = e
    if not lut:
        raise ValidationError("empty colormap")
    return lut


def decode(png_bytes, lut, width, height, want="value"):
    """Return (values float32 [H*W] NaN-missing, stats). want='value' or 'class'."""
    im = Image.open(io.BytesIO(png_bytes))
    if im.size != (width, height):
        raise ValidationError(f"PNG size {im.size} differs from the request {(width, height)}")
    a = np.asarray(im.convert("RGBA"))
    # Key = RGB plus an opacity bit. GIBS writes transparent pixels as (0,0,0,0) whatever their meaning, so a
    # transparent pixel may only decode through a colormap entry that is itself transparent; an opaque entry that
    # happens to share the RGB (e.g. EVI 0.95-0.975 is opaque black) must never claim a transparent pixel.
    alpha = a[..., 3]
    k = (((a[..., 0].astype(np.int64) << 16) | (a[..., 1].astype(np.int64) << 8) | a[..., 2]) << 1) | (alpha > 0)
    u, inv = np.unique(k.ravel(), return_inverse=True)
    vals = np.full(len(u), np.nan, np.float32)
    kind = np.zeros(len(u), np.int8)          # 0 unknown, 1 value/class, 2 nodata, 3 censored both ends, 4 other class, 5 >= top bin, 6 < bottom bin
    for i, key in enumerate(u):
        e = lut.get(int(key) >> 1); opaque = bool(key & 1)
        if e is None: continue
        if not opaque and not e["transparent"]: continue      # transparent pixel, opaque entry: no meaning
        if e["kind"] == "value" and want == "value": vals[i], kind[i] = e["v"], 1
        elif e["kind"] in ("censored_high", "censored_low") and want == "value": vals[i], kind[i] = e["v"], (5 if e["kind"] == "censored_high" else 6)
        elif e["kind"] == "class" and want == "class": vals[i], kind[i] = (e["v"][0] if isinstance(e["v"], list) else e["v"]), 1
        elif e["kind"] == "nodata": kind[i] = 2
        elif e["kind"] == "censored": kind[i] = 3
        else: kind[i] = 4
    v = vals[inv]; kk = kind[inv]; al = alpha.ravel()
    unknown_opaque = int(np.sum((kk == 0) & (al > 0)))
    if unknown_opaque:
        raise ValidationError(f"{unknown_opaque} opaque pixels carry colours absent from the colormap")
    stats = {"pixels": int(v.size), "decoded": int(np.isfinite(v).sum()), "nodata": int((kk == 2).sum()),
             "censored": int((kk == 3).sum()), "other_class": int((kk == 4).sum()), "transparent_unmapped": int(((kk == 0) & (al == 0)).sum()),
             "at_least_top_bin": int((kk == 5).sum()), "below_bottom_bin": int((kk == 6).sum())}
    return v, stats, (kk == 5)


def pixel_cells(width, height):
    lat = 90 - (np.arange(height) + 0.5) * 180.0 / height
    lon = -180 + (np.arange(width) + 0.5) * 360.0 / width
    ci = np.clip(np.rint((lat + 90) / 0.5).astype(int), 0, NLAT - 1)
    cj = np.rint((lon + 180) / 0.625).astype(int) % NLON
    return (ci[:, None] * NLON + cj[None, :]).ravel()


def cell_mean(v, cells, min_frac=0.5):
    """Cell mean of finite pixel values; NaN where fewer than min_frac of the cell's pixels decoded."""
    n = np.bincount(cells, minlength=NLAT * NLON).astype(float)
    ok = np.isfinite(v)
    s = np.bincount(cells, weights=np.where(ok, v, 0.0), minlength=NLAT * NLON)
    c = np.bincount(cells, weights=ok.astype(float), minlength=NLAT * NLON)
    with np.errstate(invalid="ignore", divide="ignore"):
        m = s / c
    m[(c == 0) | (c < min_frac * n)] = np.nan
    return m, c / np.maximum(n, 1)


def class_fractions(v, cells, classes):
    n = np.bincount(cells, minlength=NLAT * NLON).astype(float)
    out = {}
    for k in classes:
        out[k] = np.bincount(cells, weights=(v == k).astype(float), minlength=NLAT * NLON) / np.maximum(n, 1)
    return out


def load_bundle(layer):
    d = load_raw(f"gibs/asterro_gibs_{layer}.json.gz")
    if hashlib.sha256(d["colormap_xml"].encode("utf-8")).hexdigest() != d["colormap_sha256"]:
        raise ValidationError(f"{layer}: colormap hash mismatch")
    items = []
    for it in d["items"]:
        if it.get("status") != 200:
            items.append({**it, "png": None}); continue
        b = base64.b64decode(it["png_b64"])
        if hashlib.sha256(b).hexdigest() != it["sha256"] or len(b) != it["bytes"]:
            raise ValidationError(f"{layer} {it['time']}: PNG hash or size mismatch")
        items.append({k: it[k] for k in ("time", "url", "utc", "bytes", "sha256")} | {"png": b})
    return d, items


def monthly_series(layer, scale=1.0, min_frac=0.5):
    """Decode every image of a monthly layer; return (dates, cell means [T, NCELL] scaled, report,
    top-censored flags [T, NCELL]: True where any pixel of the cell was in the open-ended top bin, so the cell mean
    is a lower bound)."""
    d, items = load_bundle(layer)
    lut = parse_colormap(d["colormap_xml"]); W, H = d["width"], d["height"]; cells = pixel_cells(W, H)
    dates, rows, tops, tot = [], [], [], {}
    for it in items:
        if it["png"] is None: continue
        v, st, top = decode(it["png"], lut, W, H, "value")
        for k in st: tot[k] = tot.get(k, 0) + st[k]
        m, _ = cell_mean(v, cells, min_frac)
        ft = np.bincount(cells, weights=top.astype(float), minlength=NLAT * NLON) / np.maximum(np.bincount(cells, minlength=NLAT * NLON), 1)
        dates.append(it["time"]); rows.append(m * scale); tops.append(ft > 0)
    rep = {"layer": layer, "images": len(rows), "requested": len(items), "width": W, "height": H, "colormap_url": d["colormap_url"],
           "colormap_sha256": d["colormap_sha256"], "first": dates[0] if dates else None, "last": dates[-1] if dates else None,
           "first_utc": min(i["utc"] for i in items if i.get("utc")), "last_utc": max(i["utc"] for i in items if i.get("utc")), "pixels": tot,
           "image_sha256": {it["time"]: it["sha256"] for it in items if it["png"] is not None}}
    rep["top_bin_value"] = next((e["v"] * scale for e in lut.values() if e["kind"] == "censored_high"), None)
    return dates, np.array(rows), rep, np.array(tops)


def snow_lower_bound(layer="MODIS_Terra_L3_Snow_Cover_Monthly_Average_Pct"):
    """Detected snow cover per cell and image, as a LOWER BOUND: sum of detected snow-cover percentages over all of
    the cell's pixels divided by the number of pixels. GIBS renders 0 % snow, cloud, polar night and no data alike
    as fully transparent pixels, which therefore count as 0 here: a value is the snow cover that was detected, and
    the absence of detection is not evidence of no snow."""
    d, items = load_bundle(layer)
    lut = parse_colormap(d["colormap_xml"]); W, H = d["width"], d["height"]; cells = pixel_cells(W, H)
    n = np.bincount(cells, minlength=NLAT * NLON).astype(float)
    dates, rows, tot = [], [], {}
    for it in items:
        if it["png"] is None: continue
        v, st, _ = decode(it["png"], lut, W, H, "value")
        for k in st: tot[k] = tot.get(k, 0) + st[k]
        rows.append(np.bincount(cells, weights=np.where(np.isfinite(v), v, 0.0), minlength=NLAT * NLON) / np.maximum(n, 1)); dates.append(it["time"])
    rep = {"layer": layer, "images": len(rows), "requested": len(items), "width": W, "height": H, "colormap_url": d["colormap_url"],
           "colormap_sha256": d["colormap_sha256"], "first": dates[0], "last": dates[-1], "pixels": tot,
           "first_utc": min(i["utc"] for i in items if i.get("utc")), "last_utc": max(i["utc"] for i in items if i.get("utc")),
           "image_sha256": {it["time"]: it["sha256"] for it in items if it["png"] is not None}, "lower_bound": True}
    return dates, np.array(rows), rep


def climatology(dates, series, min_years=3):
    """Month-of-year climatology [12, NCELL] (NaN with fewer than min_years valid years) and years used."""
    months = np.array([int(t[5:7]) for t in dates])
    out = np.full((12, series.shape[1]), np.nan); ny = np.zeros((12, series.shape[1]), np.int16)
    for m in range(1, 13):
        s = series[months == m]
        c = np.isfinite(s).sum(0)
        with np.errstate(invalid="ignore"):
            mean = np.nanmean(np.where(np.isfinite(s), s, np.nan), 0) if len(s) else np.full(series.shape[1], np.nan)
        mean[c < min_years] = np.nan
        out[m - 1], ny[m - 1] = mean, c
    return out, ny
