# Phase IV — Limitations

## Scientific

- **No validation.** ASTERRO is not scientifically validated, and no reference cases ship with it.
  The Validation workspace evaluates rankings against cited cases that researchers enter; its
  records say explicitly that they are not validation claims.
- **Readiness is not validity.** A readiness level measures data completeness and reproducibility.
  It does not measure scientific validity, landing safety or habitability, and no location is
  presented as a safe landing site.
- **Terrain-only targets.** 17 analytical targets have terrain criteria only. For them, only
  labelled, exploratory partial comparisons exist; partial results on flat plains are often
  saturated (flagged).
- **Proxy criteria.** Aridity and the elevation proxy are rules, not measurements. They are excluded
  from Atlas comparisons by default, and included in Explore exactly as in the legacy baseline.
- **Scale differences.** Rover point measurements (MEDA, REMS) and coarse Diviner GCP bins are
  compared with 0.5° × 0.625° Earth cell means. This is stated per criterion, not corrected.
- **Explore normalisation.** `explore-target-v1` uses Earth ∪ the target's own values. Scores are
  comparable within one target, not across targets, and they are not legacy Analogue Scores.

- **Scenario Lab.** Scenario results show how sensitive a ranking is to analytical choices. They are
  not uncertainty estimates for the environment. Robust candidates are defined by a fixed threshold
  (rank ≤ 100 in every scenario).
- **Expedition objectives.** These map to the existing editorial profiles through a fixed table.
  They are not fitted to any study, and they assess no safety, access or suitability.
- **Readiness scale.** The scale changed during development, from levels 0–4 (2.0.0) to 1–4
  (3.0.0). Level-3 and level-4 assignments are identical under both, and only 3.0.0 is published.

- **Discovery Trajectory.** Stability is sensitivity to the configurations the user explored (at most 12), not
  measurement, data-quality or model uncertainty. When several assumptions change in one step their effects are
  reported jointly. The per-criterion decomposition is available for steps within one single-target
  configuration (not for target switches or the cross-planet minimum).

- **Method Arena.** The alternative rules are analytical counterfactuals, not validated improvements; the baseline
  stays authoritative. Agreement between rules is robustness to the rule, not correctness. No measurement-uncertainty
  model exists for the Earth stack, so rule and data-source sensitivity are analysed, not measurement uncertainty.
- **Mismatch signatures** use the configuration's normalisation ranges and the baseline thresholds; a shared
  signature is a shared direction and size class of difference, not physical equivalence.

- **Discovery Journey.** It explains the baseline; it adds no new science. *Change my mind?* covers declared choices
  (profiles, Earth sources, target proxies, criteria), not measurement uncertainty. The team of places is a
  deterministic greedy cover, not a proven minimum. *Through time* has yearly values for one criterion only. No new
  dataset was integrated: no verified acquisition of a higher-resolution DEM or of further variables was possible in
  this build environment, so *Missing pieces* names those gaps instead.

- **Globe-first workspace.** The robustness label is a rule over the declared profiles, not a statistical confidence.
  The landing globe is interactive only on screens wider than 760 px. The journal's progress is kept per browser.
  Tablets were not tested as a separate size (desktop 1512 px and phone 390 px were).

## Software

- **Interface languages.** বাংলা, Español, Français and Deutsch now cover every route:
  - the header, the landing and the globe workspace;
  - the Discovery Journey and the journal;
  - Compare, Scenarios, Discover, Data and Method;
  - the 14 Lab modules, Trajectory and the 23 Atlas modules;
  - the Trace, Reproduce and Report sheets, and the Markdown report.

  See `COMPLETION_QA.md`. What remains:
  - **No native-speaker review.** The four translations were written by Claude (an AI model) and **have not been
    reviewed by native speakers**. `docs/i18n/TRANSLATION_REGISTER.md` keeps the status and the review workflow.
  - **Strings in states the harvest never reached** fall back to English. The harvest is a sweep of every route,
    module and target, plus every browser suite.
  - **Source-record text** (method notes, dataset notes) is shown translated, with its English original beside it.
  - **Place names.** Physical-region and planetary feature names stay as their sources write them. Only country
    names are localised, through CLDR.
  - **Bengali font.** Bengali uses Noto Sans Bengali when Google Fonts is reachable, otherwise the platform's
    Bengali font. No font file is bundled, because none could be obtained legitimately in the build environment.
    Shaping and coverage were verified with that environment's fallback face (FreeSans). Noto Sans Bengali itself
    was not rendered there (see TEST_REPORT.md).
  - **Header.** In Spanish, French and German at desktop widths, the tab bar takes its own row under the header
    instead of scrolling (`ui_18_nav.js`).

- **Header width.** To fit the Trajectory tab, tab padding and letter-spacing are reduced on screens wider
  than 760 px; the baseline header therefore looks slightly tighter than before.

- **Phase II laboratory.** It runs only for the legacy targets; for registry targets it shows a
  notice instead of results.
- **Holdout analysis.** Not implemented, because nothing is fitted to labels.
- **Collections, favourites and reference cases.** These live in browser storage on one device and
  are exchanged by export/import. There is no server sync.
- **Offline use.**
  - It needs one full online visit first.
  - Fonts and external links need the network.
  - The Phase II series is cached only after first use.
  - `app.json`, `targets.json` and `labels.json` are not individually hashed (the stack, grids,
    sub-cell data, series and registry are).
- **Accessibility checks.** axe-core could not be installed (package registries were unreachable
  during this build). Accessibility was checked with an in-page audit instead: accessible names, alt
  text, labelled SVGs, duplicate ids, positive tabindex and WCAG text contrast in the Atlas views,
  plus keyboard tests of the tree and the search combobox. No screen-reader session was performed.
- **WebGL.** Smoke tests render with SwiftShader, and globe screenshots under headless rendering
  can be blank. No physical-GPU or touch-device test was run.
- **Registry build time.** The registry `built_utc` timestamp changes at every build, so the
  registry SHA-256 recorded in the atlas changes too. This is expected.

## Planetary Analogue Intelligence expansion

- **No new external dataset.** Every data-provider host refused the build environment's connections (re-probed
  2026-11-06), so the 20 sources labelled "Available for future integration" were not ingested. The extension uses
  only data already retained in the repository.
- **Absolute temperatures.** Earth values are clear-sky MODIS monthly means and NASA POWER 2 m air. Mars values come
  from one rover per target over one Mars year. Moon values are Diviner window means at hours 14 and 2. Mars air
  pressure is about a hundredth of Earth's, so "air temperature" is the same quantity in a very different medium.
- **Processes.** Thresholds (99th percentiles, 3,000 m, 250 mm, 5 °C, −30 °C) are ASTERRO's choices. They find
  conditions, not the processes themselves. Six processes are described only.
- **Frequently cited analogue sites.** The 17 sites were compiled from general knowledge, with approximate centres
  (±50 km). This is not a literature review, and "beyond the familiar" means only "outside this list".
- **Extended profiles.** The weights are design choices, not fitted or validated. The 8 profiles that need unmeasured
  conditions are not built.
- **Translations.** The 495 extension keys in bn, es, fr and de are machine-assisted and not reviewed by native
  speakers.
- **Research queue.** It is stored in this browser only. There is no account, server or sync.

## Challenge-compliance and design pass

- **Indirect indicators are not observations.** Permafrost, ice-cap climate, dust-storm, aeolian, salt, sedimentation,
  fluvial and erosion settings come from climate classes, named regions and terrain or climate thresholds. They say
  where a process is expected, not that it occurs, and never that a resource exists.
- **Köppen–Geiger** is computed from a ~50 km reanalysis climatology (NASA POWER, MERRA-2, 2001–2020). Alpine tundra
  (ET) in high mountains counts as "polar and tundra" in the environment filter.
- **Environment type** is the label of a named Natural Earth region polygon. A large desert contains many terrains,
  and cells outside named regions have no type.
- **Illumination** is noon solar-elevation geometry only: no atmosphere, terrain shadowing or measured irradiance.
- **Still missing: geology, mineralogy, surface materials, caves and lava tubes, wind and aerosols, surface water,
  biology, thermal inertia, impact structures on Earth.** No dataset could be retrieved (network refused). These are
  labelled "no data" everywhere and never approximated.
- **Navigation.** The nine views are grouped visually (Explore · Discover · Compare · Learn · My research) but stay
  individually visible. Two protected baseline tests address them directly, and a five-item menu that hides views
  would break that contract.
- **Simple view** hides technical tags around the weight sliders but not the sliders themselves, because the protected
  baseline test sets a weight directly.
- **Design** was checked in headless Chromium (SwiftShader) at 390, 820, 1180 and 1440 px. It was not checked on
  physical devices, with a screen reader, or with the real SF / Instrument Sans fonts (web fonts are unreachable here,
  so fallback fonts were used).

## Atlas and Research Laboratory redesign

- **Terms of Service and Privacy Policy** are plain-language texts. No lawyer has reviewed them, and the translations
  have not been reviewed by native speakers.
- **Em dashes and checkmarks** are replaced when the page is drawn: em dashes become en dashes, checkmarks become
  filled dots. The source catalogues and the protected baseline sources still contain them.
- **The globe's rim glow** is drawn by the protected WebGL renderer and was not changed.
- **The prohibited-element audit** checks computed CSS and visible text. It cannot see pixels drawn on the globe
  canvas.

## Version 15

- **No new dataset was integrated.** The brief asks for additional NASA and other provider data (for example more
  thermal, mineralogy or illumination layers). This environment cannot reach any data provider, package registry or
  GitHub, so nothing new could be downloaded, processed or checked. The interface names only the datasets already in
  the build. It does not claim any integration that did not happen.
- **"Closest exploration operation"** is the operation with the highest mean similarity under the existing
  operation rules. It ranks environments. It does not judge operational suitability.
- **Process settings in step 7** are the existing rule-based process environments that match the cell. They indicate
  a setting, not an observed process.
- **The glossary and the new strings** are written in plain language in five languages. They have not been reviewed
  by native speakers.
- **The layout sweep** measures boxes, overlaps and computed contrast. It cannot judge visual balance; the screenshots
  were also inspected by eye.
- **Panel colour.** To pass the pastel check, the stone panels were made slightly less warm. Colour now comes from
  the semantic accents rather than the panel surface.

## V17

See `docs/v17/README.md` (section 14) and `docs/v17/DATA_REGISTRY.md`.

- **No new dataset.** 0 of 47 provider endpoints and neither package registry were reachable from the build
  environment. Every new V17 variable is derived from data already retained (NASA POWER, MODIS LST, GMTED2010).
- **Four domain modules are blocked** (geology, mineralogy, dust and atmosphere, biology) and give no result; the Earth
  side of caves and subsurface has no data.
- **Proxies.** Freeze–thaw months use monthly means of daily air-temperature extremes; permafrost climate is mean
  air temperature below 0 °C. Neither observes ground ice.
- **Novelty** is relative to a short list of sites compiled from general knowledge; it is not importance or discovery.
- **Unsupervised groups** are statistical groupings of twelve coarse variables, reproducible only with the recorded
  scikit-learn version.
- **Reference constants** (gravity, composition, day length) were transcribed from the NASA NSSDCA fact sheets and not
  re-retrieved.
- **Translations** of the V17 strings are machine-assisted and have not been reviewed by native speakers.
