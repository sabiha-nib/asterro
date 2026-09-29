"""Minimal, dependency-free writer for the Zarr v2 storage specification
(https://zarr-specs.readthedocs.io/en/latest/v2/v2.0.html).

Used when the `zarr` package is not installed so that data/predictor_stack.zarr is always
produced. Layout: a group (.zgroup/.zattrs), one directory per array with .zarray/.zattrs and
chunk files named "i.j[.k]"; chunks are C-order little-endian bytes compressed with zlib
(numcodecs id "zlib", i.e. plain zlib.compress streams); consolidated metadata in .zmetadata.
Readable with zarr-python (>=2.x, and 3.x via zarr_format=2) and xarray.open_zarr.
"""
import itertools, json, math, os, shutil, zlib
import numpy as np

LEVEL = 6


def _dtype_str(a):
    d = a.dtype.newbyteorder("<") if a.dtype.byteorder not in ("|", "=") or a.dtype.itemsize > 1 else a.dtype
    return np.dtype(d).str  # e.g. '<f4', '|u1'


def _fill(a):
    if np.issubdtype(a.dtype, np.floating):
        return "NaN"
    return 0


def write_array(root, name, a, chunks, attrs=None, meta=None):
    a = np.ascontiguousarray(a)
    if a.dtype == np.bool_:
        a = a.astype(np.uint8)
    a = a.astype(a.dtype.newbyteorder("<"), copy=False)
    path = os.path.join(root, name)
    os.makedirs(path, exist_ok=True)
    chunks = tuple(int(min(c, s)) if s else 1 for c, s in zip(chunks, a.shape))
    zarray = dict(zarr_format=2, shape=list(a.shape), chunks=list(chunks), dtype=_dtype_str(a),
                  compressor=dict(id="zlib", level=LEVEL), fill_value=_fill(a), order="C", filters=None)
    grid = [range(math.ceil(s / c)) for s, c in zip(a.shape, chunks)]
    for idx in itertools.product(*grid):
        sl = tuple(slice(i * c, min((i + 1) * c, s)) for i, c, s in zip(idx, chunks, a.shape))
        block = a[sl]
        if block.shape != chunks:                       # edge chunk: pad to full chunk size
            full = np.full(chunks, np.nan if np.issubdtype(a.dtype, np.floating) else 0, dtype=a.dtype)
            full[tuple(slice(0, n) for n in block.shape)] = block
            block = full
        with open(os.path.join(path, ".".join(map(str, idx))), "wb") as f:
            f.write(zlib.compress(np.ascontiguousarray(block).tobytes(), LEVEL))
    zattrs = dict(attrs or {})
    json.dump(zarray, open(os.path.join(path, ".zarray"), "w"), indent=1)
    json.dump(zattrs, open(os.path.join(path, ".zattrs"), "w"), indent=1)
    if meta is not None:
        meta[f"{name}/.zarray"] = zarray
        meta[f"{name}/.zattrs"] = zattrs


def write_group(path, arrays, group_attrs):
    """arrays: list of (name, ndarray, chunks, attrs)."""
    shutil.rmtree(path, ignore_errors=True)
    os.makedirs(path)
    meta = {".zgroup": dict(zarr_format=2), ".zattrs": group_attrs}
    json.dump(meta[".zgroup"], open(os.path.join(path, ".zgroup"), "w"))
    json.dump(group_attrs, open(os.path.join(path, ".zattrs"), "w"), indent=1)
    for name, a, chunks, attrs in arrays:
        write_array(path, name, a, chunks, attrs, meta)
    json.dump(dict(zarr_consolidated_format=1, metadata=meta), open(os.path.join(path, ".zmetadata"), "w"), indent=1)


def read_array(path, name):
    """Reference reader (used by tests) - independent of zarr-python."""
    z = json.load(open(os.path.join(path, name, ".zarray")))
    shape, chunks, dt = tuple(z["shape"]), tuple(z["chunks"]), np.dtype(z["dtype"])
    out = np.empty(shape, dt)
    for idx in itertools.product(*[range(math.ceil(s / c)) for s, c in zip(shape, chunks)]):
        raw = zlib.decompress(open(os.path.join(path, name, ".".join(map(str, idx))), "rb").read())
        blk = np.frombuffer(raw, dt).reshape(chunks)
        sl = tuple(slice(i * c, min((i + 1) * c, s)) for i, c, s in zip(idx, chunks, shape))
        out[sl] = blk[tuple(slice(0, x.stop - x.start) for x in sl)]
    return out
