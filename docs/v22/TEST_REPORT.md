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

## Offline suite (`npm test`): 177 of 177 pass

The V19 drift guard (`test_v19::test_baseline_has_no_differences`) compares the working tree with the V19 commit
`cab7a0c`. V20.3 changed two things on purpose:

- **The rendered order of the view buttons.** They now sit in per-section submenus.
- **One navigation step in two protected UI tests**, `tests/ui_smoke.py` and `tests/phase2/ui_lab_smoke.py`.

These two changes are listed in `data/v22/accepted_differences.json` with their exact old and new values. The guard
accepts only an exact match, so any other difference fails, including a further edit to either file. This was tested:
adding one line to `tests/ui_smoke.py` makes the guard fail.

A new test, `test_accepted_differences_are_only_the_v20_3_navigation_change`, pins that list to these two changes and
checks that the same ten views remain, only reordered.

The GitHub workflow `.github/workflows/ci.yml` now checks out the full history (`fetch-depth: 0`). The guard needs
`cab7a0c`, which a single-commit checkout does not contain.

**Simulated GitHub run.** A fresh clone of the repository was tested locally:

- `npm test`: 177 of 177 pass;
- the registry schema check passes;
- the stack rebuild reproduces the published SHA-256.

This was run on a local Python 3.13. GitHub runs Python 3.11, which was not tested.

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
