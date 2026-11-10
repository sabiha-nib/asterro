"""Environmental cube for the app: one Int16 array per variable, aligned with the app's valid-cell order.

value = stored * scale (+ add); stored == NODATA (-32768) means missing. The manifest records, per variable, its
units, dataset(s), evidence kind, native resolution, period and whether it is a lower bound. The cube is a
versioned, hashed file loaded on demand and kept offline in IndexedDB by the app (ui_33_store.js).
"""
import hashlib, json, os
import numpy as np
from .common import VERSION, valid_cells, p

NODATA = -32768


class Cube:
    def __init__(self):
        self.vc = valid_cells(); self.n = len(self.vc); self.vars = []; self.arrays = []

    def add(self, vid, values_grid_or_cells, scale, meta, on_cells=False):
        v = np.asarray(values_grid_or_cells, float)
        v = v if on_cells else v[self.vc]
        q = np.full(self.n, NODATA, np.int16)
        ok = np.isfinite(v)
        s = np.rint(v[ok] / scale)
        if s.size and (s.min() < -32767 or s.max() > 32767):
            raise ValueError(f"{vid}: values do not fit the Int16 scale {scale}: {v[ok].min()} .. {v[ok].max()}")
        q[ok] = s.astype(np.int16)
        self.vars.append({"id": vid, "scale": scale, "n_valid": int(ok.sum()), **meta}); self.arrays.append(q)

    def write(self, outdir, sources):
        os.makedirs(outdir, exist_ok=True)
        buf = b"".join(a.astype("<i2").tobytes() for a in self.arrays)
        open(os.path.join(outdir, "cube.bin"), "wb").write(buf)
        for k, v in enumerate(self.vars):
            v["offset"] = k * self.n * 2
        man = {"schema": "asterro.v19x.cube/1", "version": VERSION, "n": self.n, "dtype": "int16le", "nodata": NODATA,
               "cell_order_sha256": hashlib.sha256(self.vc.astype("<i4").tobytes()).hexdigest(),
               "bytes": len(buf), "sha256": hashlib.sha256(buf).hexdigest(), "variables": self.vars, "sources": sources}
        open(os.path.join(outdir, "cube.json"), "w").write(json.dumps(man, ensure_ascii=False, indent=1))
        return man
