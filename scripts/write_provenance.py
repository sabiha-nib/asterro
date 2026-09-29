"""Write data/metadata/provenance.json and data/provenance/manifest.json (per-criterion DIRECT /
PROXY / N/A status, sources, missing-data rules, checksums, verified / unverified items).
provenance.json lists every raw input, its SHA-256, the script that produced it
(with the script's SHA-256) and the dataset record shown in the app's DATA view."""
import hashlib, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.build_web import DATASETS

RAW = {
    "power_climatology.npz": ("src/data/ingestion/power_climatology.py", ["nasa_power"]),
    "modis_lst.npz": ("src/data/ingestion/modis_lst_gibs.py", ["modis_aqua_lst"]),
    "terrain_earth.npz": ("src/data/ingestion/terrain.py", ["gmted2010"]),
    "terrain_planets.npz": ("src/data/ingestion/terrain.py", ["mola", "lola"]),
    "mars_meda.json": ("src/data/ingestion/mars_meda.py", ["meda"]),
    "meda_pressure.json": ("src/data/ingestion/meda_pressure.py", ["meda"]),
    "moon_diviner.json": ("src/data/ingestion/moon_diviner.py", ["diviner"]),
    "labels.npz": ("src/data/ingestion/geo_context.py", ["natural_earth"]),
}


def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


EARTH_SOURCE = {"aridity": ["nasa_power"], "annual_temperature_range": ["nasa_power"], "elevation": ["gmted2010"],
                "slope": ["gmted2010"], "surface_roughness": ["gmted2010"], "lst_diurnal_range": ["modis_aqua_lst"]}
TARGET_SOURCE = {
    "mars_jezero": {"aridity": [], "annual_temperature_range": ["meda"], "elevation": ["gmted2010", "meda"],
                    "slope": ["mola"], "surface_roughness": ["mola"], "lst_diurnal_range": ["meda"]},
    "moon_south_pole": {"aridity": [], "annual_temperature_range": [], "elevation": ["gmted2010"],
                        "slope": ["lola"], "surface_roughness": ["lola"], "lst_diurnal_range": ["diviner"]},
}
MISSING_RULES = {
    "earth_value_missing": "NaN (or non-finite) Earth value: the criterion is dropped for that cell and the score is "
                           "renormalised over the remaining active weights; weight coverage is reported. Never imputed.",
    "coverage_rule": "coverage = sum of active weights with a finite Earth value / sum of active weights; a cell with "
                     "coverage < 0.80 keeps its score but is not ranked (effective score -1).",
    "target_not_applicable": "null target value (status N/A): criterion excluded from every score for that target; "
                             "does not reduce coverage.",
    "aridity_undefined": "Hargreaves PET = 0 (every monthly mean T < -17.8 C): aridity is NaN, not 0 and not 1.",
    "invalid_cell": "Not land in GMTED2010 (< 50 % valid 30\" pixels) OR no MODIS LST diurnal range OR no POWER T2M: "
                    "cell excluded from the stack.",
}
UNVERIFIED = [
    "Diviner hour02 bin numbering is assumed to follow hour14 (hour14 = LTIM53-56 was verified; hour02 was not "
    "separately checked).",
    "MODIS LST was decoded from NASA GIBS rendered imagery through the published colormap (0.6 K bins); values were "
    "not cross-checked against the MYD11C3 HDF science files.",
    "NASA POWER climatology values were taken as served by the API; they were not cross-checked against MERRA-2 files.",
    "Licence statements summarise each provider's published data policy; they have not been legally reviewed.",
    "No analogue ranking has been validated against field studies or expert-selected analogue sites.",
]
VERIFIED = [
    "Raw input SHA-256 values match between the ingestion sandbox and this repository (inputs[].sha256).",
    "Rebuilding the stack from the raw inputs in an independent environment (Higgsfield sandbox, numpy 2.4.6, "
    "zarr-python 3.1.6) reproduced public/data/stack.bin with identical SHA-256; the zarr-python store equalled the npz.",
    "The built-in Zarr v2 writer's output was read back exactly by zarr-python 3.1.6 and xarray 2026.7.0.",
    "Diviner summer hour14 map = mean of PDS LTIM53-56 products (13.00-14.00 h), rms 6.9e-6 K over 794,601 pixels.",
    "JS engine scores are bitwise identical to the Python reference for both targets (tests/test_js_parity.mjs).",
]


def manifest(repo, prov):
    T = json.load(open(os.path.join(repo, "data/targets.json")))["targets"]
    stack = json.load(open(os.path.join(repo, "data/metadata/stack_build.json")))
    app = json.load(open(os.path.join(repo, "public/data/app.json")))
    ds = {d["id"]: d for d in DATASETS}
    crit = []
    for c in app["criteria"]:
        per = {}
        for t in T:
            cid = c["id"]
            per[t["id"]] = dict(status=t["status"][cid], comparison=t["comparison"][cid], value=t["variables"][cid],
                                unit=t["units"][cid], method=t["methodology"][cid],
                                proxy_method=t.get("proxy_method", {}).get(cid),
                                sources=[dict(id=k, dataset=ds[k]["dataset"], url=ds[k]["url"]) for k in TARGET_SOURCE[t["id"]][cid]])
        crit.append(dict(id=c["id"], label=c["label"], unit=unitmap(c["id"]), normalization_range=app["ranges"][c["id"]],
                         earth_sources=[dict(id=k, dataset=ds[k]["dataset"], version=ds[k]["version"], url=ds[k]["url"],
                                             license=ds[k]["license"]) for k in EARTH_SOURCE[c["id"]]],
                         targets=per))
    return dict(product="ASTERRO - Planetary Analogue Intelligence", algorithm_version=app.get("algorithm_version", "tai-sim-1.0.0"),
                generated_by="scripts/write_provenance.py",
                grid=stack["grid"], n_valid_cells=stack["n_cells"],
                predictor_stack=dict(web_bundle="public/data/stack.bin", sha256=stack["sha256"], bytes=stack["bytes"],
                                     zarr="data/predictor_stack.zarr", npz="data/predictor_stack.npz",
                                     zarr_writer=stack.get("zarr_written")),
                normalization=dict(rule="min-max over all valid Earth cells UNION all non-null target values; one fixed "
                                        "table shared by every target and profile", ranges=app["ranges"]),
                criteria=crit, missing_data_rules=MISSING_RULES,
                raw_inputs=prov["inputs"], derived_checksums=prov["derived"], datasets=DATASETS,
                verified=VERIFIED, unverified=UNVERIFIED,
                interpretation="Analogue Scores measure similarity of selected modelled variables under a weighting "
                               "profile. They do not establish geological equivalence, engineering suitability, "
                               "habitability, safety or mission-site certification.")


def unitmap(c):
    return {"aridity": "index (P/PET, saturated at 1)", "annual_temperature_range": "K", "elevation": "m",
            "slope": "deg", "surface_roughness": "m", "lst_diurnal_range": "K"}[c]


def main(repo="."):
    out = dict(note="Raw inputs were produced in a Higgsfield cloud sandbox with direct access to the NASA/USGS/PDS "
                    "servers and relayed as files; every relayed file was verified against the SHA-256 printed in "
                    "the sandbox before use.", inputs=[], datasets=DATASETS,
               derived={f: sha(os.path.join(repo, p)) for f, p in
                        [("predictor_stack.npz", "data/predictor_stack.npz"), ("stack.bin", "public/data/stack.bin"),
                         ("targets.json", "data/targets.json")]})
    for f, (script, ds) in RAW.items():
        p = os.path.join(repo, "data/raw", f)
        out["inputs"].append(dict(file=f, sha256=sha(p) if os.path.exists(p) else None, bytes=os.path.getsize(p) if os.path.exists(p) else None,
                                  produced_by=script, script_sha256=sha(os.path.join(repo, script)), datasets=ds))
    json.dump(out, open(os.path.join(repo, "data/metadata/provenance.json"), "w"), indent=1)
    os.makedirs(os.path.join(repo, "data/provenance"), exist_ok=True)
    json.dump(manifest(repo, out), open(os.path.join(repo, "data/provenance/manifest.json"), "w"), indent=1)
    print(json.dumps(out["derived"], indent=1))


if __name__ == "__main__":
    main(*sys.argv[1:])
