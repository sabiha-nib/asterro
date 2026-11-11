# ASTERRO V20.1: test report

All runs used headless Chromium through Playwright with software WebGL, plus Node and Python. No test was skipped or
deleted.

## 1. Non-browser tests (final build, `npm test`, exit code 0)

- Python: 176/176.
- Every Node engine and catalogue suite passes.
- New: `test_v21_i18n.mjs`, 12/12. It checks that the five catalogues have the same keys and placeholders, that no
  key overwrites an earlier one, that no sentence is left in English, and that there are no em dashes.

The baseline-protection tests (`test_phase2`, `test_phase3`, `test_v19`) pass: no protected file was edited.

## 2. Browser suites

**Full run of 21 suites.** All pass except one check in `ui_layout_sweep`, which was fixed afterwards (see §3).

| Suite | Checks | Result |
|---|---|---|
| `ui_smoke`, `ui_lab_smoke`, `ui_atlas_smoke` | (exit-code suites) | pass |
| `ui_phase4_smoke` | 75 | pass |
| `ui_trajectory_smoke` | 24 | pass |
| `ui_methods_smoke` | 19 | pass |
| `ui_journey_smoke` | 70 | pass |
| `ui_global_smoke` | 39 | pass |
| `ui_routes_i18n_smoke` | 27 | pass |
| `ui_journal_persist_smoke` | 16 | pass |
| `ui_responsive_smoke` | 113 | pass |
| `ui_ext_smoke` | 45 | pass |
| `ui_design_smoke` | 23 | pass |
| `ui_design_audit` | 165 | pass |
| `ui_layout_sweep` | 350 of 351 | one tablet overlap, fixed below |
| `ui_v17_smoke` | 49 | pass |
| `ui_v18_local_smoke` | 59 | pass |
| `ui_v19_smoke` | 39 | pass |
| `ui_v19x_smoke` | 32 | pass |
| `ui_v20_smoke` | 50 | pass |
| **`ui_v21_smoke` (new)** | 23 | pass |

**Final build.** The final build differs from the full-run build by one CSS rule: the "Hide ranking" button on tablets
moves below the opened layer list. The five suites that cover tablets and the shell were run again on the final build:
`ui_layout_sweep`, `ui_design_audit`, `ui_responsive_smoke`, `ui_v20_smoke` and `ui_v21_smoke`. Their results are in §4.

`ui_v21_smoke` checks:

- **Desktop rail:**
  - it has Home, five groups and Settings, and is deep navy;
  - each group opens the navigation at that group, and Escape returns focus.
- **Globe workspace:**
  - the globe takes at least 55 % of the width;
  - the ranking floats over the globe without covering a globe control;
  - the context panel and the ranking are navy.
- **Destination picker:**
  - Mars lists 18 destinations, Moon 15, and the current one is marked;
  - the 16 Mars targets below readiness 3 are Atlas only;
  - Shackleton opens on the globe;
  - Gusev opens in the Atlas;
  - Escape closes the picker and returns focus.
- **Contrast:** every text passes WCAG AA across 19 views (panels, console, dialogs, sheets, picker).
- **Phone sizes (320, 390, 700, 844 landscape):**
  - no rail and no sideways scroll;
  - the opening screen has no hidden overflow;
  - the target switch fits;
  - panels are navy;
  - the globe is the default.
- **Engine:** the six-dimensional result is unchanged and no page error occurs.

## 3. Failures found and fixed

| Found by | Problem | Fix |
|---|---|---|
| Contrast audit (own script, now part of `ui_v21_smoke`) | 18 text styles were unreadable on navy. Tables in quirks mode took the body colour, a V19 rule forced a light-theme grey, and one primary button kept white text. | `table{color:inherit}`; dark value for that grey; navy text on sky buttons. Result: 0 failures. |
| Picker | 0 destinations: the registry stores `body` as an object. | Read `body.name`. |
| Picker | Focus was lost when the catalogue finished loading. | Focus is restored to the title. |
| `ui_design_audit` | Pills (999 px) and 10–16 px radii on boxes; the hero grid used `span`, read as a bento grid. | Every radius is now at most 8 px; the hero uses explicit grid lines. |
| `ui_design_audit` | "Hiding the ranking widens the globe" measured the viewport width, but the ranking now floats over the globe. | The test now measures the globe width the ranking does not cover (documented test change). |
| `ui_responsive_smoke` | German phone: two layer buttons were off-screen in a scrolling strip. | The layer buttons wrap again. |
| `ui_layout_sweep` | At 1280 px the Atlas panel was wider than the globe, and the place card rose into the controls. On a tablet with the layers open, "Hide ranking" overlapped Layers. | The wide panel is capped at 34 vw; the card height is capped; the tablet toggle moves to 196 px. |
| Published artifact (checked in the browser) | Phones: the two hero destination cards wrapped into a hidden second column. | No wrapping; a new check in `ui_v21_smoke` covers it. |
| `ui_v20_smoke` | It clicked the header Menu and Settings buttons, which desktop now hides in favour of the rail. | Uses the rail on desktop (documented test change). |

## 4. Final-build rerun

See the summary at the end of this file.

| Suite (final build) | Checks | Result |
|---|---|---|
| `ui_layout_sweep` | 351 | pass |
| `ui_design_audit` | 165 | pass |
| `ui_responsive_smoke` | 113 | pass |
| `ui_v20_smoke` | 50 | pass |
| `ui_v21_smoke` | 23 | pass |

## 5. Published preview

The ASTERRO artifact was updated in place, to version 22. It was then opened in a real browser: the opening screen,
Search Earth (globe, default view) and the destination picker were all checked.

The artifact host does not serve `.bin` files, so `data/stack.bin` and `data/v19/env/cube.bin` are not published:

- `stack.bin`: the app uses the published base64 copy of the same stack, as in every earlier preview.
- `cube.bin`: the V19 environmental data layers show their "data unavailable" state in the preview only. In the
  repository and the release archive they work as before.
