"""USGS Mineral Resources Data System (MRDS): per-cell mineral-occurrence context on the ASTERRO grid.

Source: https://mrdata.usgs.gov/mrds/mrds-csv.zip (USGS; file dated 2022-08-23; metadata edition 20160315,
"Maintenance_and_Update_Frequency: None planned"; access and use constraints: none). The archive is retained at
data/v19/raw/mrds/asterro_mrds-csv.zip and its SHA-256 is pinned below; any other file is refused.

What it is: a catalogue of reported mineral sites (mines, prospects, occurrences, plants). What it is not: a map of
mineral composition, a resource estimate, or a global survey. About 88 % of the records are in the United States, so
a count reflects reporting density as much as geology, and an empty cell means "no record", never "no minerals".

For every valid land cell (cell centre = grid point) the module derives:
  n_100km        records within 100 km of the cell centre (great-circle)
  producers      of those, records whose development status is Producer or Past Producer
  nearest_km     distance to the nearest record (only stored when <= 100 km)
  nearest        index into a small table of the records that are nearest to some cell (name, id, commodity, status)
  top            up to three primary commodities among the records within 100 km, by count
Records with unparsable or out-of-range coordinates are counted and excluded.
"""
import csv, io, zipfile, collections
import numpy as np
from scipy.spatial import cKDTree
from src.v19x.common import RAW, valid_cells, cell_centres, sha256_file, NLON
import os

RAW_FILE = os.path.join(RAW, "mrds", "asterro_mrds-csv.zip")
RAW_SHA256 = "31be4baaa86b082787bc74989146183db21badf7157db39b3f0a6fe0b38a5477"
URL = "https://mrdata.usgs.gov/mrds/mrds-csv.zip"
R_EARTH = 6371.0088
RADIUS_KM = 100.0


def _xyz(la, lo):
    la, lo = np.radians(la), np.radians(lo)
    return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], -1)


def load(path=RAW_FILE):
    h = sha256_file(path)
    if h != RAW_SHA256:
        raise ValueError(f"MRDS archive hash mismatch: {h}")
    z = zipfile.ZipFile(path)
    names = z.namelist()
    if "mrds.csv" not in names:
        raise ValueError(f"mrds.csv missing from archive: {names}")
    rows, bad = [], 0
    with z.open("mrds.csv") as f:
        for x in csv.DictReader(io.TextIOWrapper(f, encoding="utf-8", errors="replace", newline="")):
            try:
                la, lo = float(x["latitude"]), float(x["longitude"])
            except (TypeError, ValueError):
                bad += 1; continue
            if not (-90 <= la <= 90 and -180 <= lo <= 180):
                bad += 1; continue
            com = (x["commod1"] or "").split(",")[0].strip()
            rows.append((la, lo, x["dep_id"], x["site_name"].strip(), com, x["dev_stat"].strip(), x["country"].strip()))
    return rows, {"raw_sha256": h, "records": len(rows) + bad, "excluded_bad_coordinates": bad, "used": len(rows)}


def per_cell(rows):
    vc = valid_cells(); la, lo = cell_centres(vc)
    pts = np.array([[r[0], r[1]] for r in rows])
    tree = cKDTree(_xyz(pts[:, 0], pts[:, 1]))
    chord = 2 * np.sin(RADIUS_KM / R_EARTH / 2)
    cxyz = _xyz(la, lo)
    dist, nn = tree.query(cxyz, k=1)
    nearest_km = 2 * R_EARTH * np.arcsin(np.clip(dist / 2, 0, 1))
    hits = tree.query_ball_point(cxyz, chord)
    com_names, com_idx = [], {}
    def cidx(c):
        if c not in com_idx: com_idx[c] = len(com_names); com_names.append(c)
        return com_idx[c]
    table, tindex, cells = [], {}, {}
    for i, h in enumerate(hits):
        if not h: continue
        prod = sum(1 for j in h if rows[j][5] in ("Producer", "Past Producer"))
        cc = collections.Counter(rows[j][4] for j in h if rows[j][4])
        top = [cidx(c) for c, _ in sorted(cc.items(), key=lambda kv: (-kv[1], kv[0]))[:3]]
        j = int(nn[i])
        if j not in tindex:
            r = rows[j]; tindex[j] = len(table)
            table.append([r[2], r[3], r[4], r[5], r[6], round(r[0], 5), round(r[1], 5)])
        cells[str(int(vc[i]))] = [len(h), prod, round(float(nearest_km[i]), 1), tindex[j], top]
    return {"cells": cells, "commodities": com_names, "nearest_table": table,
            "table_fields": ["dep_id", "site_name", "commodity", "dev_stat", "country", "lat", "lon"],
            "cell_fields": ["n_100km", "producers_100km", "nearest_km", "nearest", "top_commodities"]}


def country_share(rows):
    c = collections.Counter(r[6] for r in rows)
    n = len(rows)
    return [[k, v, round(100 * v / n, 1)] for k, v in c.most_common(8)]
