"""Build public/data/v20/mrds.json from the retained USGS MRDS archive (see src/v20/mrds.py).
    python3 scripts/build_v20_mrds.py
"""
import json, os, sys, hashlib
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.v20 import mrds
from src.v19x.common import p

rows, rep = mrds.load()
out = mrds.per_cell(rows)
out = {"schema": "asterro.v20.mrds/1", "dataset": "usgs_mrds", "agency": "USGS (not NASA)",
       "provider": "U.S. Geological Survey, Mineral Resources Program", "product": "Mineral Resources Data System (MRDS), full CSV",
       "url": mrds.URL, "file_date": "2022-08-23", "metadata_edition": "20160315", "maintenance": "None planned (USGS metadata)",
       "retrieved": "2026-11-11", "raw_sha256": rep["raw_sha256"], "radius_km": mrds.RADIUS_KM,
       "records": rep["records"], "used": rep["used"], "excluded_bad_coordinates": rep["excluded_bad_coordinates"],
       "country_share": mrds.country_share(rows),
       "limitations": "A catalogue of reported mineral sites, not a composition map or resource estimate. About 88% of records are in the United States, so counts reflect reporting density; an empty cell means no record, never no minerals. Not exploration or investment advice.",
       **out}
os.makedirs(p("public", "data", "v20"), exist_ok=True)
s = json.dumps(out, separators=(",", ":"), ensure_ascii=False)
open(p("public", "data", "v20", "mrds.json"), "w", encoding="utf-8").write(s)
print("cells", len(out["cells"]), "table", len(out["nearest_table"]), "bytes", len(s.encode()), "sha", hashlib.sha256(s.encode()).hexdigest()[:16])
