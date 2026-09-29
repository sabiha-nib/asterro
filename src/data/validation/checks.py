"""Data-quality checks on the predictor stack and targets (used by tests/test_data.py)."""
import json, os
import numpy as np

PLAUSIBLE = {  # physical plausibility bounds (units as stored)
    "aridity": (0.0, 1.0), "annual_temperature_range": (0.0, 80.0), "elevation": (-450.0, 8850.0),
    "slope": (0.0, 60.0), "surface_roughness": (0.0, 3000.0), "lst_diurnal_range": (-30.0, 80.0),
}


def check_stack(stack):
    v = stack["valid"]
    out = {"n_valid": int(v.sum())}
    for c, (lo, hi) in PLAUSIBLE.items():
        a = stack[c][v]
        f = a[np.isfinite(a)]
        out[c] = dict(finite=float(np.isfinite(a).mean()), min=float(f.min()), max=float(f.max()),
                      in_bounds=bool((f >= lo).all() and (f <= hi).all()))
        assert np.isnan(stack[c][~v]).all(), f"{c}: values outside valid mask"
    return out


def check_targets(targets, criteria):
    for t in targets:
        for key in ("id", "body", "name", "variables", "units", "sources", "source_urls", "methodology",
                    "proxy_flags", "limitations"):
            assert key in t, f"{t.get('id')}: missing {key}"
        assert set(t["variables"]) == set(criteria), f"{t['id']}: criteria mismatch"
        assert len(t["sources"]) == len(t["source_urls"]) and all(u.startswith("https://") for u in t["source_urls"])
        for c, v in t["variables"].items():
            if v is None:
                assert "NOT APPLICABLE" in t["methodology"][c], f"{t['id']}.{c}: null without explanation"
            if t["proxy_flags"].get(c):
                assert t["methodology"][c].startswith("PROXY"), f"{t['id']}.{c}: proxy not disclosed"
    return True
