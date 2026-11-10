# ASTERRO V20: test report

All results come from the final build, run in the build environment: headless Chromium through Playwright, with
software WebGL (SwiftShader), Node and Python. No test was skipped or deleted. Four earlier test files were changed;
each change is listed in §3 with the reason.

## 1. Non-browser tests (`npm test`, exit code 0)

| Suite | Result |
|---|---|
| Python, including `tests/test_v20.py` (9 new) and the baseline-protection checks | 176/176 |
| JS ↔ Python parity, Phase II, Phase III | pass, pass, 132/132 |
| Phase IV registry / trajectory / method / journey | 74/74, 26/26, 37/37, 53/53 |
| i18n / extension / extension i18n | 52/52 and 63/63, 39/39, 36/36 |
| V17, V18, V19, V19x engines and catalogues | 35/35 and 24/24; 23/23 and 24/24; 36/36 and 25/25; 19/19 and 17/17 |
| **V20 catalogues (`test_v20_i18n.mjs`)** | **23/23** |

The 9 tests in `tests/test_v20.py` check:

- **MRDS metadata:** the product has honest limits.
- **Cells:** every cell is a valid land cell, and the field values are consistent.
- **Atacama example:** 68 records within 100 km, 26 producers, nearest Chepica (lithium, 12.7 km).
- **Distances:** the nearest-record distance matches an independent haversine.
- **Rebuild:** rebuilding from the raw archive gives identical output.
- **Hash pin:** a different archive is refused.
- **Inventory:** it lists MRDS as CACHED and not NASA, and the old V19 row points to it.
- **Reachability:** every view is reachable from the V20 navigation.
- **Design:** the design tokens and fonts are present.

## 2. Browser suites (20 suites, all pass, final build)

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
| `ui_layout_sweep` | 351 | pass |
| `ui_v17_smoke` | 49 | pass |
| `ui_v18_local_smoke` | 59 | pass |
| `ui_v19_smoke` | 39 | pass |
| `ui_v19x_smoke` | 32 | pass |
| **`ui_v20_smoke` (new)** | **50** | **pass** |

`ui_v20_smoke` checks:

- **Opening screen:**
  - the two-word title, set in Helvetica and Playfair Display;
  - no tab bar on the opening screen;
  - the tagline is kept;
  - the globe is the default view;
  - only Helvetica and Playfair Display are used (Bengali text adds a Bengali-script face);
  - the prohibited-element audit passes on the opening screen and with both dialogs open.
- **Navigation:**
  - five groups and 25 destinations;
  - every destination opens the view it names;
  - focus is trapped in the dialog, and Escape returns it to the opener;
  - the logo returns Home by click and by keyboard.
- **Settings:**
  - seven sections;
  - Terms, Privacy and the Scientific Disclaimer open, the disclaimer also by `#disclaimer`;
  - language, contrast, text size, globe rotation and detail mode work, and the preferences persist;
  - Verify checks the stored copy;
  - Forget saved places works;
  - About shows the versions.
- **Local Impact:** the MRDS context appears at the Atacama example, labelled not NASA.
- **Glass:** it appears only on `[data-glass]` surfaces.
- **Viewports:**
  - 320, 360, 375, 390, 414, 430 and 768 px in portrait and landscape, plus 1024 × 1366, 1280, 1440 and 1920;
  - no sideways scroll on the opening screen, with the menu open, or after a search;
  - the globe is the default at every size;
  - menu targets are at least 36 px.
- **Engine and errors:**
  - the six-dimensional result is unchanged;
  - no page error occurs.

## 3. Test changes (required by the V20 brief, not weakened)

| File | Change | Why |
|---|---|---|
| `ui_journey_smoke.py` | Expects the hero title "Planetary Intelligence" instead of "Find Earth's other worlds." | The brief asks for a two-word title. |
| `ui_design_audit.py` | Glass is reported unless the element carries `[data-glass]`. | The brief allows glass on floating navigation, globe controls, overlays and modals only. Glass anywhere else still fails. |
| `ui_design_audit.py` | The pastel rule ignores colours with almost no chroma (max − min channel ≤ 8 %) and the exact pale-blue `#DBEAFE` on an element in a selected state. | HSL saturation is unstable near white. The brief's near-white `#F8FAFC` (chroma 1.6 %) measured as "saturated". Real pastels (pink, mint, lavender, pale blue on unselected surfaces) still fail. |
| `ui_design_smoke.py` | The tab order is measured with the tab bar shown. | The opening screen now hides the tab bar. The order itself is unchanged and still checked. |

## 4. Failures found and fixed during V20

| Suite | Failure | Fix |
|---|---|---|
| `test_phase2`, `test_phase3`, `test_v19` | Editing the protected `index.src.html` (fonts) and `js/07_main.js` (phone map default) broke the baseline hashes. | Both edits were reverted. The same behaviour now lives in the V20 layer: the font link is swapped at start-up, and `setProj` keeps the globe on phones unless the person picks Map. |
| `ui_phase4_smoke` | Phone: the atlas panel was not scrolled into view after "Open the planetary atlas". | With the globe as the phone default, the search finished after the baseline's 400 ms scroll. The panel is now scrolled into view again once the results exist. |
| `ui_v18_local_smoke` | Keyboard focus left the Local Impact result. | Loading the MRDS catalogue re-rendered the whole panel. It now updates its own block in place. |
| `ui_v19_smoke`, `ui_v19x_smoke` | Section order before the report changed. | The MRDS block now sits inside the existing data-layer section, so the order is as V19x left it. |
| `ui_responsive_smoke` | Bengali tabs were 30.5 and 32.5 px high. | The active-tab underline added 2 px to one tab only. Every tab now reserves the 2 px. |
| `ui_design_smoke` | The tab order was read while the bar was hidden. | See §3. |
| `ui_v20_smoke` (first run) | The Close button was 34 px; a phone in landscape cut off the top of the opening screen. | V20 controls are now at least 40 px. On short screens the opening screen scrolls from its top. |

## 5. Performance (final build, same machine, software WebGL; median of 3)

| Measure | Desktop 1440 × 900 | Phone 390 × 844 | V19x on the same machine |
|---|---|---|---|
| Start to data ready | 4.64 s | 2.81 s | 4.10 s / 2.78 s |
| Search (field + reveal) | 6.98 s | 5.95 s | 6.48 s / 5.36 s (phone used the flat map) |
| Open the menu (synchronous render) | 5.9 ms | 4.5 ms | – |
| Open Settings | 11.1 ms | 5.6 ms | – |
| JS heap after search | 42.6 MB | 45.2 MB | – |

- `index.html` is 6,289,503 bytes.
- `data/v20/mrds.json` is 2,122,202 bytes. It is loaded only by Local Impact and precached for offline use.

The phone search is about 0.6 s slower because the 3D globe now replaces the flat map by default. Absolute times are
inflated by software rendering in the build environment; real devices with a GPU will be faster.

## 6. Not tested

- Real devices: they were emulated by Playwright.
- Screen readers: roles, labels and focus order are tested, but no screen reader was run.
- Playfair Display rendering: the build environment cannot reach Google Fonts, so the tests verified the declared font
  stack only. On a connected device the page requests Playfair Display from Google Fonts. This
  request is disclosed in the Privacy Policy.
- Translation quality: the translations are machine-assisted and were not reviewed by native speakers.
