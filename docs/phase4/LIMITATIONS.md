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

## Software

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
