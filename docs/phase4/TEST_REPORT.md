# Phase IV — Test report

Every suite below was run in the build environment for the final state of this phase: Linux,
Python 3.11, Node 20, and Playwright Chromium with SwiftShader.

| Suite | Command | Result |
|---|---|---|
| Python (baseline, Phase II, III, IV) | `npm run test:py` | **84/84 passed**, including 19 Phase IV registry tests |
| JS ↔ Python parity | `npm run test:js` | ALL PARITY CHECKS PASSED |
| Phase II engine | `npm run test:phase2` | 65/65 passed |
| Phase III engine | `npm run test:phase3` | 132/132 passed |
| Phase IV registry engine | `npm run test:phase4` | **74/74 passed** |
| Stack rebuild from raw inputs | CI step (`build_stack` + `sha256sum`) | `cfbe1bf5…72e63`, identical to the published stack |
| Baseline UI smoke | `python3 tests/ui_smoke.py` | Exit 0. #1 Altiplano at 85.0 %; mobile overflow 0. The only console error is the Google Fonts request, which the sandbox blocks. |
| Phase II UI smoke | `python3 tests/phase2/ui_lab_smoke.py` | Exit 0. `baseline_unchanged: true`; no errors; mobile overflow 0. |
| Phase III UI smoke | `python3 tests/phase3/ui_atlas_smoke.py` | Exit 0. `baseline_unchanged` and `baseline_top_same` true; both records REPRODUCED; no errors; mobile overflow 0. |
| Phase IV UI smoke | `python3 tests/phase4/ui_phase4_smoke.py` | **75/75 checks passed** |
| Scenario-set replay | `python3 scripts/replay_scenario.py tests/phase4/fixtures/scenario_gale.json` | REPRODUCED (4 scenarios × 20 sites) |

## What the new suites check

### `tests/test_phase4.py` (registry)

**Rejections.** The schema rejects each of the following:

- duplicate ids;
- bad or NaN coordinates;
- infinite values;
- unknown statuses;
- bad units;
- missing provenance;
- unknown datasets;
- values attached to MISSING criteria;
- readiness levels outside 1–4, or levels that do not follow from the checks;
- scoring enabled below L3;
- catalogued-only locations that are not L1;
- datasets missing a licence;
- bad comparison experiments.

**Model and counts.**

- **Readiness:** model 3.0.0; 16 targets at L4 and 17 at L2; the cumulative rule holds per target.

**Parity.**

- **Catalogue:** the source catalogue and gazetteer match the published locations.
- **Fingerprints:** the atlas fingerprints match the registry fingerprints.
- **Legacy targets:** values and ranges unchanged.
- **Copying:** no two targets share a fingerprint.
- **Explore ranges:** recomputed from the stack and equal to the registry.

**Integrity.**

- **Raw manifest:** its checksums match the retained raw files.
- **Offline regeneration:** passes, and fails explicitly when its inputs are missing.
- **Script checksums:** match. This test caught a real drift during development, when a script
  changed after a build.
- **Thumbnails:** exist as real files.
- **Secrets:** a scan finds none.
- **Scenario replay:** a scenario set replays in Python, and a tampered set is detected.

### `tests/phase4/test_registry_engine.mjs` (engine)

**Atlas.**

- **Hierarchy:** the body → region → location → target chain is consistent.
- **Search:**
  - alias, exact, diacritic-folded, prefix and word matches;
  - an empty result when nothing matches;
  - deterministic results.
- **Locations:** filters (including terrain category) and sorting.
- **Quick actions:** each disabled action comes with a reason.

**Comparison.**

- **Compatibility matrix:** checked.
- **Blocking:** an unsupported aggregate, or targets with no shared DIRECT criterion, are blocked.
- **Legacy cross-planet minimum:** bit-identical to the baseline min rule over all 76,781 cells, with
  identical distinct sites. This test found and fixed a real bug: the legacy pair must use each
  target's own criteria.
- **Pareto:** non-dominance checked.
- **Three-target minimum:** checked.
- **Per-criterion aggregate:** produces no summed score.
- **DIRECT-only field:** bit-identical to the Phase III atlas engine.

**Validation.**

- Recall@k and labelled precision arithmetic.
- Metrics withheld when labels are insufficient.
- Ocean, uncited and synthetic cases rejected.
- Records containing synthetic cases labelled.

**Mismatch.** Class rules and determinism.

**Scenario Lab.**

- Scenario 1 is bit-identical to the Phase III field.
- The recorded vectors, ranges and sites are complete.
- Browser replay matches; a tampered set fails.
- A catalogued-only id is refused.
- Contributions sum to the score.

**Collections.**

- Merge: identical skipped, conflicts reported, new ids added; nothing overwritten.
- The richer item kinds validate.
- An item without a snapshot is refused.

**Provenance export.** Checked.

### `tests/phase4/ui_phase4_smoke.py` (browser)

**Explore and reproduction.**

- 14 L3+ registry targets are registered in Explore, with no range disagreement.
- Shackleton opens from the quick-switch, under its own ranges.
- Its exported record is reproduced by `scripts/reproduce_registry.py`: stack, ranges, fingerprint,
  cell score/rank and top-3 all OK.

**Phase II Lab.** It shows a notice for a registry target.

**Legacy targets.** After switching back to Jezero, the field, ranges and distinct sites are
bit-identical, and cross-planet uses the legacy table.

**Atlas.**

- Alias search and the combobox Enter key.
- Tree keyboard navigation.
- L1 (catalogued) actions disabled, each with its reason.
- Regions, list and table modes.
- Readiness and terrain-category filters.
- Latitude sort.
- Favourites persist across a reload.
- Breadcrumbs, the data panel and the active-target quick switch.

**Comparison Lab.**

- Minimum over the 3 shared DIRECT criteria.
- Pareto.
- Legacy regression in the browser: IDENTICAL.
- Terrain-only mean.
- Saving to a collection.

**Scenario Lab.**

- 3 scenarios, the rank-change chart and robust candidates.
- The **exported set is reproduced by the Python engine**.
- The set re-imports and replays in the browser.
- It saves to a collection.

**Validation.** Refusals, withheld metrics and the holdout note.

**Mismatch Explorer.** Classes, the chart with its text alternative, and saving an Earth cell.

**Expedition.** Choosing an objective sets the profile and shows the research questions.

**Provenance export.** The schema is correct, and the L2 filter returns 17 targets.

**Collections.**

- Create and export.
- Conflict import: nothing is overwritten.
- An invalid import is refused.
- A rich collection (comparison, Earth cell, scenario set) round-trips.

**Accessibility audit** (5 views): no unnamed controls, missing alt text, unlabelled SVG charts,
duplicate ids or positive tabindex, and text contrast ≥ 4.5:1 (3:1 for large text).

**Offline.**

- The service worker caches 49/49 core files.
- **Offline reload:** the app starts, the stack hash verifies and the registry loads from the cache.

**Mobile (390 px).** No horizontal overflow.

**Page errors.** None.

## Existing tests that were updated (assertions not weakened)

- **`tests/test_phase3.py` and `tests/phase3/test_atlas_engine.mjs`.**
  - The Phase III readiness rule is still asserted, now on `readiness_v1`, and is unchanged.
  - Added: the reference results are the targets at level ≥ 2, the model carries 12 checks, and L1
    targets are never ranked.
- **`tests/phase3/ui_atlas_smoke.py`.** It reaches modules through the two-level module bar and opens
  "Target cards" explicitly.
- **Protected files.** The Phase III preservation test (79 SHA-256-protected baseline and Phase II
  files, including `scripts/reproduce.py`) passes. Registry records use the separate
  `scripts/reproduce_registry.py`.

## Not run

- **axe-core:** could not be installed, because the npm and PyPI registries were unreachable. The
  in-page audit above was used instead.
- **Screen reader:** no real screen-reader session.
- **Devices:** no physical mobile, touch or GPU device.
