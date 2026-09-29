"""Minimal offline test runner (used only where `pytest` cannot be installed).
Provides pytest.approx / pytest.raises and runs every test_* function in tests/.
CI and the Higgsfield build sandbox run the real pytest."""
import importlib, math, pathlib, sys, traceback, types

class _Approx:
    def __init__(self, v, rel=1e-6, abs=1e-12):
        self.v, self.rel, self.abs = v, rel, abs
    def __eq__(self, o):
        return math.isclose(float(o), float(self.v), rel_tol=self.rel or 0, abs_tol=self.abs or 0)

class _Raises:
    def __init__(self, exc): self.exc = exc
    def __enter__(self): return self
    def __exit__(self, t, v, tb):
        if t is None: raise AssertionError(f"did not raise {self.exc}")
        return issubclass(t, self.exc)

pt = types.ModuleType("pytest")
pt.approx = lambda v, rel=1e-6, abs=1e-12: _Approx(v, rel, abs)
pt.raises = _Raises
sys.modules.setdefault("pytest", pt)
root = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
fails = n = 0
for f in sorted((root / "tests").glob("test_*.py")):
    mod = importlib.import_module(f"tests.{f.stem}")
    for name in sorted(dir(mod)):
        if name.startswith("test_"):
            n += 1
            try:
                getattr(mod, name)()
                print(f"PASS {f.stem}::{name}")
            except Exception:
                fails += 1
                print(f"FAIL {f.stem}::{name}\n{traceback.format_exc()}")
print(f"\n{n - fails}/{n} passed")
sys.exit(1 if fails else 0)
