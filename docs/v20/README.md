# ASTERRO V20: release report

Interface version `asterro-v20-ui-1.0.0`. Engine `tai-sim-1.0.0` (unchanged). Data layers `tai-v19-data-2.0.0` plus the
V20 USGS MRDS product. Related documents: `DESIGN_RESEARCH.md`, `DATASET_AUDIT.md` (generated), `TEST_REPORT.md`.

## A. Scientific completion

### A1. Starting point (Phase 1)

- The V19x final archive (`asterro_v19x_final.tar.gz`, SHA-256 `97a900af…b714`) and patches 0010–0013 were written to the
  user's `Downloads/asterro_data/work/` and their hashes were checked on the Mac against the build copies. All matched.
- Repository at the start: commit `8ef528d`, clean working tree, 13 local commits after `origin/main` (`60e0c16`), never
  pushed. V19x was fully incorporated (engine, UI, data products, tests).
- Baseline tests at the start: 167/167 Python and every Node suite passing; 21 browser suites passing (V19x test report).

### A2. Dataset audit (Phase 2)

`DATASET_AUDIT.md` lists all 130 datasets with eight separate statuses: Discovered, Metadata verified, Downloaded,
Parsed, Validated, Integrated, Used in calculation, Available offline. Totals:

| Status | Datasets |
|---|---|
| Discovered | 128 |
| Metadata verified | 80 |
| Downloaded | 48 |
| Parsed | 48 |
| Validated | 38 |
| Integrated | 48 |
| Available offline | 38 |

Used in calculation: 3 Earth predictors and 7 target-side rows feed the six-dimension engine; 26 feed the data-layer
analyses (Science domains, Local Impact); 12 earlier V19 rows serve the V19 domain views or context; 82 were not
obtained (48 blocked, 32 need a NASA Earthdata Login, 2 not investigated).

One finding stated plainly: two of the engine's three Earth predictors (NASA POWER and MODIS Aqua LST) carry the V19
registry state `integrated_awaiting_validation`. They are checksum-verified against the published stack, but no
independent re-validation of the original downloads was recorded. V20 does not change that state.

### A3. New science in V20 (bounded attempts)

| Domain | Attempt | Result |
|---|---|---|
| Geology and mineralogy | USGS Mineral Resources Data System (MRDS), complete CSV, through the user's desktop browser | **Integrated.** 25,791,223-byte archive, SHA-256 `31be4baa…a5477`, 304,632 records (19 with unusable coordinates excluded). Per land cell: records within 100 km, producers, nearest record, top three commodities. 29,762 land cells have a record within 100 km. Shown in Local Impact, labelled "not NASA", with its limits. Listed in the Catalogue as CACHED. |
| Mineralogy (spectral) | EMIT L2B minerals, ASTER | Not attempted again: both need a NASA Earthdata Login (recorded in V19x). No credential was requested or used. |
| Water, ice, permafrost; dust, wind, atmosphere; biology | | Covered by the V19x data layers (POWER, GIBS, GBIF). No new source was reachable without authentication. |
| Caves and subsurface | | No global, openly downloadable cave dataset was identified. No regional catalogue was assembled in this pass; the domain stays "no data". |
| Moon and Mars | | Unchanged from V19 (MOLA, LOLA, Diviner, MEDA, gazetteer). |

The desktop link to the user's computer dropped during this pass. No further downloads were possible after that point,
and none were retried.

MRDS limits, also shown in the app: it is a catalogue of reported sites, not a composition map or a resource estimate.
About 88 % of the records are in the United States, so counts reflect reporting density as much as geology. An empty
cell means "no record", never "no minerals". USGS lists no planned updates.

### A4. What did not change

The six dimensions, the seven profiles, the thresholds (match 0.85, partial 0.60, minimum coverage 80 %), the 300 km
separation rule and determinism are unchanged. The baseline-protection tests (`test_phase2`, `test_phase3`, `test_v19`)
pass. No baseline file is edited: `index.src.html` and `js/07_main.js` keep their protected hashes, and the V20 changes
are a separate layer.

## B. Design research (Phase 3)

Both sites were visited in a real browser and their computed styles were read; see `DESIGN_RESEARCH.md`.

- **Adopted:** an immersive first screen with navigation folded into one Menu control; grouped navigation with short
  group nouns; the real product (the live globe) as the hero visual; theme and language as visible utilities.
- **Adapted:** the brief's navy palette instead of white or near-black; glass only on floating surfaces; small radii.
- **Not copied:** no wordmark, imagery, icon font, copy, layout or code from either site; no sparkle icon,
  announcement banner, carousels or marketing grids.

## C. Product redesign (Phases 4–7)

- **Tokens:**
  - navy foundation `#0B1D3A`, with `#102552` and `#1E3A8A` for chrome;
  - near-white reading surfaces `#F8FAFC`, ink `#0B1D3A`, slate `#334155` and `#64748B` (darkened to `#526175` for
    secondary text on tinted surfaces, for AA contrast);
  - refined blue `#3B82D8` for the active tab and focus, sky `#93C5FD` for primary actions on navy, pale blue `#DBEAFE`
    for selected surfaces;
  - coral `#FD6E6E` only for warnings.
- **Type:**
  - Helvetica, with Helvetica Neue, Arial and Liberation Sans as metric-compatible fallbacks;
  - Playfair Display italic only for the highlighted hero word, with a Georgia fallback;
  - the baseline page still links three other web fonts (the protected `index.src.html` is not edited). V20
    removes that stylesheet link at start-up and no element uses those faces, so their font files are not loaded.
- **Hero:** "Planetary *Intelligence*" in five languages (two words each). The ASTERRO name and the tagline "Find
  Earth's environmental analogues for worlds beyond Earth." are kept. No testimonial, partner, award or invented count.
- **First screen:** no tab bar. Menu, Settings, language and Search Earth are visible. The tabs return, with their
  ids, order and behaviour, as soon as a view opens.
- **Logo:** always returns Home, by click and by keyboard.
- **Navigation:**
  - Discover: Home, Globe, Global Discovery, Target Explorer, Atlas.
  - Analyze: Research Lab, Local Impact, Compare, Difference Lens, Candidate Characterization, Robustness Lab.
  - Plan: Portfolio, Trajectory, Mission and Operations Profiles, Scenarios.
  - Evidence: Passport, Trace, Reproduce, Reports, Journal.
  - Data and Trust: Catalogue, Sources, Data Gaps, Trust Centre, Methodology.

  These are 25 destinations, and each calls an existing view or function. The menu is a modal dialog (focus trap,
  Escape, focus returned) and works as a full-width drawer on phones.
- **Settings:** Terms, Privacy and a new Scientific Disclaimer (also at `#disclaimer`); language; accessibility (globe
  rotation, text size; system reduced-motion respected); appearance (detail mode, high contrast); data and offline
  (copy source, checksum, dates, network, offline app, Verify, Check for updates); location privacy (forget saved
  places); About with versions.
- **Globe:** the 3D globe is now the default at every width. The baseline switched phones to the flat map; V20 keeps
  the globe unless the person picks Map.
- **Glass:** only on `[data-glass]` surfaces (Menu and Settings buttons, globe controls, legend, the two dialogs). There
  is a solid fallback where `backdrop-filter` is unsupported and in high contrast.
- **Motion:** there are no transitions or animations, and nothing depends on hover.
- **Higgsfield:** not used. Generated imagery would add no scientific value, and the brief forbids fake scientific
  imagery. Nothing was purchased.

## D. Feature preservation

No feature, tab, id or test was removed. Every earlier suite runs unchanged, with three exceptions, each required by
the V20 brief and documented in `TEST_REPORT.md`:

1. The journey test now expects the new hero title.
2. The design audit allows glass on `[data-glass]` surfaces only.
3. The design audit's pastel rule ignores near-white slate tints, which have almost no chroma, and the exact pale-blue
   selected state. Every other pastel is still flagged.

## E. Verification

Every number is in `TEST_REPORT.md`. All runs used the final build.

- **Non-browser:** 176/176 Python tests, every Node suite, and the new V20 catalogue test (23/23).
- **Browser:** all 20 suites pass, including the new `ui_v20_smoke` (50 checks); there are 1,196 numbered checks
  across the 17 suites that print them.
- **Viewports:** 320–1920 px in portrait and landscape show no sideways scroll, and the globe is the default view at
  every size.
- **Screenshots:** every major view at 1440 px, and the opening screen, menu and results at the listed sizes. They
  are in the outputs folder.
- **Performance:** start-up and search time are within 0.6 s of V19x on the same machine. Opening the menu or
  Settings takes under 12 ms.

## F. Release state

- Local commits only. Nothing was pushed: earlier pushes from this environment were refused (HTTP 403), and the V19x
  brief said not to push. No deployment was made, and the earlier hosted preview was not updated.
- A git bundle of the full history, the V20 patch and the release documents are in the session outputs.
- The link to the user's computer dropped during this pass. The V19x archive and patches 0010–0013 were saved to
  `Downloads/asterro_data/work/` and verified before that. The V20 files could not be written to the Mac, so they are
  delivered in the conversation instead.
- Not done:
  - Playfair Display is not embedded for offline use. The font package could not be downloaded from this
    environment, so offline devices show Georgia for the hero word.
  - No cave dataset was added.
  - No credential-gated NASA data was obtained.
