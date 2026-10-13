# ASTERRO Phase II — Baseline preservation record

**Baseline:** git commit `7e7835a` in the build workspace. Its tree is byte-identical to GitHub
`sabiha-nib/asterro` commit `3073a87`; this was verified by hashing all 233 files on both sides.

## Existing files modified (all additive)

| File | Change | Why it was unavoidable | Verification |
|---|---|---|---|
| `scripts/build_web.py` | +5 lines. After the baseline JS and CSS have been read, the build appends `app/frontend/phase2/*.js` and `*.css`. | The page is a single file with inlined scripts, so new code cannot reach it any other way. The baseline content is emitted first and unchanged. | `public/data/app.json` is byte-identical to the baseline. The baseline UI walk-through gives output identical to the baseline build. Pixel comparison is below. |
| `package.json` | +2 scripts (`test:phase2`, `build:phase2`). `test` now also runs `test:phase2`. | CI runs `npm test`, so new tests must be reachable from it. `build`, `start`, `test:py` and `test:js` are unchanged. | `npm test` runs all baseline tests unchanged, plus the new ones. |
| `README.md` | A "Phase II" section appended at the end. | Documentation of the new features. The existing 27 sections are unchanged. | — |
| `public/index.html` | Regenerated build output. | Contains the appended Phase II code. | As for `build_web.py`. |

**Unchanged.** Every other baseline file is unchanged. `tests/test_phase2.py::test_p2_baseline_files_unchanged`
asserts this by SHA-256 against the baseline commit for 21 files:

- the engine, styles, page template and all seven UI modules;
- `src/compute/*`;
- `data/targets.json`, `data/predictor_stack.npz`;
- `public/data/stack.bin`, `public/data/targets.json`, `public/data/labels.json`.

`test_p2_app_registry_scientific_content_unchanged` asserts that the algorithm version, ranges,
profiles, thresholds, criteria and stack checksum are equal to the baseline.

## Integration boundary

- **Lab tab.** One tab button is appended at run time. Existing labels and order are unchanged.
- **`renderLeft()`.** It is wrapped by assignment; for every tab other than "lab" the wrapper calls
  the original function.
- **Global names.** A test fails if any Phase II top-level name redeclares a baseline name. This
  test was added after a collision (`graphSVG`) broke the Discover tab during development. That
  collision was found by the baseline UI walk-through and fixed by renaming the Phase II functions.
- **Read-only access.** Phase II reads `S`; it calls only the existing user actions `select()`,
  `setTarget()` and `openSheet()`, on explicit clicks.

## Behaviour checks

| Check | Result |
|---|---|
| Baseline Python tests (36) | pass, before and after |
| JS ≡ Python parity (`tests/test_js_parity.mjs`) | pass, before and after |
| Baseline UI walk-through (`tests/ui_smoke.py`) | output **identical** to the baseline build: top site, why-did-this-move text, trace formula, reproduce record, mobile overflow, console messages |
| Exported reproduce record from the new build | `scripts/reproduce.py`: stack ✓, cell score / rank ✓, top-3 ✓ |
| Pixel comparison of 16 baseline screenshots (baseline build vs Phase II build) | header: changed pixels only at x = 734–756 px (the new "LAB" label); left panel 0.00 %; right rail 0.00 %; globe 0.00–0.38 % (animation timing); mobile 0.00 % |
| Baseline state after running every Lab experiment | `S.res.eff`, the top site and `S.weights` unchanged (Lab walk-through) |
| Experimental scoring path vs baseline engine | bitwise identical for all 6 profiles + a custom weighting, both targets, cross-planet, and the Python reference fixtures |
| Start-up time | baseline 0.75–1.09 s, Phase II 0.86–0.90 s. No Phase II data is requested at start-up. |

## Pre-existing warnings (not caused by Phase II)

The only console error in both builds is that Google Fonts is unreachable from the test sandbox
(`ERR_TUNNEL_CONNECTION_FAILED`).
