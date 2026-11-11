# ASTERRO V20.3: test report

The local build was tested on 11 November 2026 against `public/index.html`, served from `public/` by a local static server.
Nothing was pushed or deployed.

## Browser (UI) suites: 21 of 21 pass

Every suite ran on the final build and every suite returned 0 failures.

| Suite | Result |
|---|---|
| `tests/ui_smoke.py` | pass |
| `tests/phase2/ui_lab_smoke.py` | pass |
| `tests/phase3/ui_atlas_smoke.py` | pass |
| `ui_phase4_smoke` | pass |
| `ui_trajectory_smoke` | pass |
| `ui_methods_smoke` | pass |
| `ui_journey_smoke` | pass |
| `ui_global_smoke` | pass |
| `ui_routes_i18n_smoke` | pass |
| `ui_journal_persist_smoke` | pass |
| `ui_responsive_smoke` (320–1920 px, portrait and landscape) | pass |
| `ui_ext_smoke` | pass |
| `ui_design_smoke` | pass |
| `ui_design_audit` | pass |
| `ui_layout_sweep` | pass |
| `ui_v17_smoke` | pass |
| `ui_v18_local_smoke` | pass |
| `ui_v19_smoke` | pass |
| `ui_v19x_smoke` | pass |
| `ui_v20_smoke` | pass |
| `ui_v21_smoke` | pass |

After the full run, three fixes were made:

- Dialog titles no longer show a focus box when the dialog opens.
- A space was added in "Readiness 4 · REPRODUCIBLE".
- On a slow first load, as in the claude.ai preview, a dashboard opened straight from Home could be drawn a moment before
  the ranked list existed. Its chart then stayed empty until the next visit. The dashboard now waits for the list, for
  at most 10 seconds.

The affected suites were run again on the final build and all pass:

- `ui_v21_smoke`
- `ui_v20_smoke`
- `ui_design_audit`
- `ui_journey_smoke`
- `ui_design_smoke`
- `ui_smoke`

The published preview was checked in a browser: sidebar, flyout submenu, Analyze and Plan dashboards.

## Offline suite (`npm test`): 175 of 176 pass

The one failure is `test_v19::test_baseline_has_no_differences`. It is a drift guard: it compares the working tree with
the fixed V19 commit `cab7a0c` and fails on any change to two things.

- **The order of the view buttons as rendered.** V20.3 replaces the horizontal tab row with per-section submenus, as the
  brief requires, so the rendered order is now Discover · Analyze · Plan · Evidence · Data and Trust.
- **Two protected test files, `tests/ui_smoke.py` and `tests/phase2/ui_lab_smoke.py`.** Their only change is the
  navigation step: the test opens the section before pressing a view button.

The guard reports exactly these two differences and nothing else: no engine, data, threshold, profile, route or dataset
difference. The test was left unchanged. Re-basing it on the V20.3 commit is a decision for the project owner.

## Test changes (navigation only; no check removed or loosened)

- **View buttons.** UI tests that pressed a view button now open its section first with a real click (on phones,
  through the section button), using a `nav_tab` helper in each file.
- **Protected hashes.** The hashes of the two protected test files were updated in:
  - `tests/phase3/fixtures/protected_sha256.json`
  - `data/v17/baseline.json`
  - `data/v19/baseline.json`
- **Navigation checks.** The header, tab-order and tab-bounds checks now measure the open section's view buttons.
- **V20 and V20.1 suites.** `ui_v20_smoke` and `ui_v21_smoke` now cover the sidebar, the dashboards and the new picker,
  where they used to cover the retired menu and rail.

## Known limits

- The claude.ai artifact preview cannot serve `.bin` files, so the V19 data layers show "unavailable" there. They work
  from a normal web server.
- The V20 multi-section menu dialog is still in the code but is no longer opened anywhere.
