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
