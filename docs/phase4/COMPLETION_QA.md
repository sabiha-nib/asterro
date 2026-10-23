# Completion and quality assurance

This pass completes the multilingual application. It adds to the existing application and replaces nothing. The
baseline engine, scores, profiles, ranking, routes, reports, reproduction and data are unchanged. The protected
baseline files (`tests/phase3/fixtures/protected_sha256.json`) are byte-identical. Everything new is in
`app/frontend/phase4/`, `scripts/`, `data/inventory/`, `docs/` and `tests/`.

## 1. Translation of every route

**How it works.** The research routes are drawn by their own modules, in English, and several of those modules are
protected files. `i18n_60_seg.js` translates what they draw, in place, one *segment* at a time. A segment is a run of
text and inline elements between block boundaries. Its key is the English text with these placeholders:

| Placeholder | Stands for |
|---|---|
| `{0}`, `{1}` … | inline elements |
| `{n0}` … | numbers |
| `{p0}` … | known proper names: Natural Earth places, targets, locations, missions, datasets, and text the user typed |

The four catalogues `i18n_71`–`74_routes_<lang>.js` map each key to a translation with the same placeholders.

**What happens when a segment is translated.**

- Inline elements are moved, never re-created. Listeners, ids and focus survive.
- Numbers are re-formatted for the locale: Bengali digits, decimal commas, grouping.
- Interface terms that arrive as names (criterion and profile labels) take their own translations.
- A `MutationObserver` (`ui_98_i18n_routes.js`) translates every render, including asynchronous ones: progress,
  lazy loads and worker results.
- Switching back to English restores the original nodes exactly.

**Coverage.** Every route and state is covered:

- Compare, Scenarios, Discover, Data and Method;
- the 14 Lab modules and Trajectory;
- the 23 Atlas modules;
- the Trace, Reproduce and Report sheets;
- the Markdown report that "Copy as Markdown" produces (`ui_97_i18n_report.js`);
- tooltips, `aria-label`s, placeholders and option groups;
- chart text in SVG.

The catalogue is harvested from the running application (`scripts/i18n_harvest.py`). The harvest is a sweep of
every tab, module and target, plus every browser suite run unchanged under a recording hook. That gives 2,571
segment keys, about 21,700 English words. The "English only" notice is gone from every route.

**Rules for different kinds of text.** See `docs/i18n/TRANSLATION_REGISTER.md` for the full rules.

- **Identifiers** stay as they are. These are dataset and product names, codes, versions, hashes, file names and URLs.
- **Source-record text** (method notes, dataset processing, licence and limitation notes) is shown translated,
  followed by a labelled "Original (English)" disclosure with the verbatim text.
- **Text the user wrote** (collection names, validation cases and citations) is never translated.

**Interface keys.** `i18n_00`–`50` gained the header, inventory, journal-store and language-section keys: 713 keys in
every language. `txP(key, n)` adds plural forms through `Intl.PluralRules`.

**Missing keys.**

- They are recorded in `I18N.missing` (keyed strings) and `I18G.miss` (segments), with their route. The tests fail
  on them.
- Production falls back to English and never shows a raw key.

**Place names.** Countries are localised through the browser's CLDR data, via a reviewed Natural Earth → ISO 3166
table (`i18n_65_places.js`). For example, Bolivia becomes Bolivien in German and বলিভিয়া in বাংলা.

The following keep their canonical names in every language:

- physical regions;
- IAU feature names;
- target names (Jezero Crater, Lunar South Pole, Shackleton);
- names that have no ISO code of their own, or that CLDR frames differently.

No place name was invented.

## 2. Translation review status

The four translations were written by Claude (an AI model). **No native speaker has reviewed them.**
`docs/i18n/TRANSLATION_REGISTER.md` records:

- coverage;
- the automated checks;
- terminology consistency;
- the review status;
- outstanding issues;
- the review workflow.

`docs/i18n/glossary.json` holds the multilingual terminology, which `scripts/i18n_terms_check.mjs` measures. The
interface states the status once, in the Method view's "Interface languages" section. The per-screen notes have
been retired.

## 3. Header

When the labels of the active language do not fit beside the brand, targets, language control and search, the tab
bar moves to its own full-width row (`ui_18_nav.js`). The baseline already uses this layout below 1,180 px. On a
phone, the tabs wrap onto a second line instead of scrolling.

- All nine tabs stay visible and clickable as tabs. No label is shortened, and nothing scrolls sideways.
- English at 1,512 px keeps its single row, as before.
- The language control stays in the header. It shows the language code: EN, ES, FR, DE, or বাংলা in its own script.
  The select inside it names every language in its own script.
- Switching language keeps the tab, target, weights and result.
- Below 1,181 px, the expedition chip joins the globe-control row, and the globe-control segments wrap instead of
  cutting labels off.

## 4. Bengali typography

| Item | Status |
|---|---|
| **Stack** | Noto Sans Bengali (SIL OFL 1.1, requested from Google Fonts when online), then Hind Siliguri, Kohinoor Bangla, Bangla Sangam MN (macOS), Nirmala UI, Vrinda (Windows), Shonar Bangla, Lohit Bengali, Mukti, FreeSans. Latin text keeps Instrument Sans, JetBrains Mono and Big Shoulders Display. Bengali text gets more line height and loses letter-spacing and upper-casing. |
| **Bundled font file** | None. The font could not be obtained legitimately here: Google Fonts, GitHub raw, npm and PyPI are all unreachable from the build machine (recorded in `data/inventory/probe.json`). No font file was fabricated. |
| **Verified in this build (FreeSans fallback)** | Every Bengali code point used by the catalogues is covered. The GSUB `beng`/`bng2` shaping tables are present. Conjuncts shape (ক্ষ is narrower than ক্‌ষ). Pre-base vowel signs combine. Regular and bold weights both render. Tab buttons keep one height. Wrapping shows no overflow at six viewports. All of this is checked in `ui_responsive_smoke.py`. |
| **Not verified** | Noto Sans Bengali itself. The build machine does not have it, and a check in the built-in browser on the user's computer could not run because that computer was not connected. On a machine that can reach Google Fonts it loads through the existing stylesheet link. |

## 5. Responsive layouts

`tests/phase4/ui_responsive_smoke.py` runs at six viewports: 390×844, 430×932, 768×1024, 1024×768, 1280×800 and
1512×982. Phones and tablets use touch emulation and taps.

**What it checks.**

- The header in all five languages.
- Every major interface in Deutsch and বাংলা, plus English at the tablet sizes:
  - the globe and its controls (including the legend and chip);
  - the dimension panel, opened by tap;
  - every research route;
  - the journey place view, Passport and Journal;
  - the Trace, Reproduce and Report sheets.
- For each of them:
  - no sideways overflow;
  - nothing past the viewport outside a scroller;
  - no overlapping controls;
  - close controls on screen;
  - no text under 9 px;
  - headings not under the header.

These are **simulated viewport checks** in headless Chromium. No physical phone or tablet was used.

## 6. Data inventory and Missing pieces

`scripts/build_inventory.py` builds `data/inventory/inventory.json`, `app/frontend/phase4/data_inventory.js` and
`docs/data/DATA_INVENTORY.md` from project state. The inputs are:

- the registry's dataset records;
- the provenance manifest;
- the raw files, re-hashed;
- a recorded reachability probe of candidate sources (`scripts/probe_data_sources.py`, HEAD requests only).

**Status of each source.**

| Status | Sources |
|---|---|
| Integrated | 16 (the registry datasets) |
| Known limitations | 9. Examples: aridity is missing in 14,750 cells; the MODIS LST is decoded from GIBS imagery; the NASA POWER values are unverified against MERRA-2. |
| Blocked: every candidate endpoint refused from this environment, on 2026-10-21 and again on 2026-10-23 | 15: TerraClimate, ERA5, MERRA-2, MYD11C3 HDF, NASADEM, SRTM, Copernicus DEM, ECOSTRESS, VIIRS, ESA WorldCover, SoilGrids, JRC GSW, Landsat, THEMIS, LROC |
| Not investigated | 1 (HiRISE) |

- **No new dataset was integrated.** No download succeeded, so nothing is "downloaded" or "verified".
- The six-dimension score and `tai-sim-1.0.0` are unchanged.
- For each candidate, the inventory records:
  - what it would add;
  - whether it could enter the score only as a versioned extension, or only as an evidence layer.

The Missing pieces checklist now carries, for every item, the inventory status of the sources behind it, with its
definition and the recorded reason. It also has a compact summary. The Data view lists the whole inventory.

## 7. Exploration Journal persistence

The journal still uses `localStorage` `asterro.journal.v1`, in the same shape (`{marks, unlocked, ch}`, plus
`resetAt`). Existing progress is kept as is (`ui_20_journal_store.js`).

**What is new.**

- Saving merges with what is stored (the earliest time wins), so two tabs never erase each other. A change in
  another tab merges in without a reload.
- A corrupt value is set aside as `…v1.corrupt`.
- Reset asks for confirmation, and a stale tab cannot bring reset progress back.
- Export and import move progress by file. An import re-derives achievements from the recorded actions only.
- The journal shows a progress summary and says plainly that progress is stored in this browser.

**What stays the same.**

- Language and target switches never touch the journal.
- Achievements still unlock only from recorded actions.

**There is no cloud sync.** ASTERRO has no account system or backend, and none was invented.

## 8. Tests added

| Suite | What it checks |
|---|---|
| `tests/phase4/test_routes_i18n.mjs` | Route catalogues: complete, placeholders, no English left, Bengali script; key and identifier rules; country table against CLDR; glossary consistency; review status recorded |
| `tests/test_inventory.py` (in `npm run test:py`) | Statuses; integrated = registry record; no candidate claims a download; blocked = probe; raw checksums; interface copy = inventory; reproducible rebuild; still six dimensions |
| `tests/phase4/ui_routes_i18n_smoke.py` | Every route and module, in four languages and three targets: misses, leftover English, quotations, English restored exactly, state and numbers unchanged |
| `tests/phase4/ui_journal_persist_smoke.py` | Old progress kept; reload; language and target switches; no double awards; two tabs; corrupt value; reset; export and import; scores untouched |
| `tests/phase4/ui_responsive_smoke.py` | Six viewports, header in five languages, interfaces, touch, Bengali shaping and coverage |

Updated: `tests/phase4/ui_journey_smoke.py`. It used to assert that research views show the "English only" notice.
It now asserts that they are translated and that the notice is gone, which is the requirement of this pass.

Results are in TEST_REPORT.md.

## 9. Acceptance

| Requirement | Status | Evidence |
|---|---|---|
| Complete localisation | **Done for every harvested state.** All routes, modules, sheets, the report, tooltips and labels are translated in bn, es, fr and de: 713 interface keys and 2,571 route keys. 0 catalogue misses and 0 leftover English sentences in the routes walk-through. Strings in states the harvest never reached fall back to English. | `test_routes_i18n.mjs`, `ui_routes_i18n_smoke.py` |
| Translation review | **Recorded honestly: not reviewed.** A register, glossary, terminology check and review workflow are in place. No native-speaker review took place. | `docs/i18n/TRANSLATION_REGISTER.md` |
| Source quotations | **Done.** The translation is shown with a labelled "Original (English)" disclosure holding the verbatim text, and the references are unchanged. | routes walk-through (25 on Data, 20 on Atlas › Sources) |
| Header | **Done.** No sideways scrolling; all tabs visible and hit-testable in five languages at six widths; language control in the header; state kept. | `ui_responsive_smoke.py`, `ui_global_smoke.py` |
| Bengali typography | **Partly done.** A Bengali font stack and typography are in place. Coverage of every code point used, shaping (conjuncts, vowel signs), weights, line heights and wrapping are verified with this machine's Bengali face (FreeSans). Noto Sans Bengali itself was **not** obtained or rendered here, and no font file was fabricated. | `ui_responsive_smoke.py` |
| Tablet usability | **Done in simulation.** 768×1024 and 1024×768, plus four other viewports, are tested with touch emulation. No physical device was used. | `ui_responsive_smoke.py` |
| Data integration | **No new dataset integrated (blocked).** The 15 candidates are recorded as blocked by the network policy, with probe evidence. Nothing is claimed as downloaded, and the score is unchanged. | `docs/data/DATA_INVENTORY.md`, `tests/test_inventory.py` |
| Missing pieces | **Done.** Statuses come from the generated inventory and the probe. | `ui_routes_i18n_smoke.py`, `tests/test_inventory.py` |
| Journal persistence | **Done (local only).** Existing progress is kept; it survives reloads and language and target switches; there are no double awards; tabs merge; export and import work. There is no cloud sync, because there is no backend. | `ui_journal_persist_smoke.py` |
| Regression safety | **Done.** All earlier suites pass, protected files are unchanged, and Altiplano is #1 at 85.0 %. | TEST_REPORT.md |
| Build and runtime | **Done.** `scripts/build_web.py` builds and the page runs; it is published as the artifact. | — |
