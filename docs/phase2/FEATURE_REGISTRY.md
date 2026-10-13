# ASTERRO Phase II — Feature registry

**Statuses used:** Implemented · Partially implemented · Experimental · Planned · Blocked by
missing data · Blocked by validation requirements · Not implemented.

"Tested" means a test was executed and its result observed (see [TEST_REPORT.md](TEST_REPORT.md)).
The machine-readable copy is `docs/phase2/feature_registry.json`.

| # | Feature | Module | Status | Data dependencies | Tests | Known limitations |
|---|---|---|---|---|---|---|
| 0 | Evidence-before-assertion protocol | `lab_engine.js` `claim()`; all `ui_*` | **Implemented** | — | Node: claim validation (4 rejection cases, freeze) | Categories assigned by module authors; not audited per claim by a third party |
| 1 | Analogue Robustness Laboratory (weight sensitivity, ranking stability, ablation, OAT drivers) | `ui_02_robust.js`, `lab_engine.js`, `src/phase2/analysis.py` | **Implemented** | Baseline stack, targets | Node: bit-parity, exact ranks, designs, bounds, classification. Python: replay of browser records (729-config factorial, ablation), tamper detection. UI walk-through | Tests weight space only; cell ranks, not distinct-site positions |
| 2 | Multi-Objective Analogue Discovery (Pareto, diversity, portfolios) | `ui_03_portfolio.js` | **Implemented** | Baseline stack | Node + JS/Python Pareto parity; UI | Set B is a heuristic, not globally optimal; no Vault replay (re-run instead) |
| 3 | Spatial Analogue Microclimate Atlas | `ui_04_atlas.js` | **Partially implemented** | Stack neighbourhood; MOLA/LOLA target windows | Node: window/off-grid; Python: target-window statistics | **Earth sub-cell characterisation blocked by missing data** (source pixels not retained) |
| 4 | Planetary Uncertainty Explorer | `ui_05_uncert.js` | **Implemented** (quantified where data allow) | MODIS yearly, decoding bin, MEDA bins/sols, Diviner seasons, window bins | UI; data-consistency tests | Instrument accuracy of POWER, GMTED and MODIS: **blocked by missing data**. No probability model (by design) |
| 5 | Analogue Failure-Mode Laboratory | `ui_06_failure.js`, `catalog.py` | **Implemented** | Stack, targets, MEDA ground T, Diviner T | Python: catalogue consistency; UI (Mars, Moon, cross) | Activity checklist is editorial |
| 6 | Planetary Evidence Graph | `ui_07_graph.js` | **Implemented** | app.json, targets.json, provenance manifest, Vault | UI: all 12 node types, all 10 edge types | Upstream product versions limited to what dataset records hold |
| 7 | Cross-Planet Evidence Comparator | `ui_08_xplanet.js` | **Implemented** | Stack, targets | UI | Proxies identical for both targets carry no discriminating information |
| 8 | Planetary Analogue Evolution Observatory | `ui_09_temporal.js` | **Implemented**; trend detection **Experimental** | MODIS yearly (10 yr), POWER monthly climatology (Phase II series) | JS/Python parity (Theil–Sen, Mann–Kendall, harmonic); series values = raw inputs | n = 10 years; POWER has no interannual values; MODIS collection per year unknown |
| 9 | Mission Requirement Translator | `ui_10_reqs.js` | **Implemented** | Stack; user thresholds | Node: status logic incl. missing data / resolution / years / area; browser replay | Cell-mean statistics only |
| 10 | Observation Value Engine | `ui_11_obsval.js` | **Partially implemented**: qualitative evidence-priority done; formal VOI **blocked by validation requirements** (4 of 6 conditions unmet) | Robustness record | Pair-flip unit test; UI | Weight-driven ambiguity only |
| 11 | Analogue Research Mission Planner | `ui_12_planner.js` | **Implemented** | Outputs of other modules | UI (generation, gaps) | Questions are templates |
| 12 | Scientific Reproducibility Vault | `ui_13_vault.js`, `scripts/replay_experiment.py` | **Implemented** | Browser localStorage | Browser replays (robustness, ablation, requirements) reproduced; Python replay; JS/Python record-id hash parity | Per-browser storage; replay limited to the three modules named |
| 13 | Scientific Review: deterministic Q&A and claim check | `ui_14_review.js` | **Implemented** | Computed outputs | Guardrail unit tests; UI | Heuristic flags; negations flagged |
| 13b | Scientific Review Copilot (language model) | — | **Not implemented** | Would need a model service | — | Not available in the static build; must never affect scoring |
| D | Phase II data products | `scripts/build_phase2_data.py` → `public/data/phase2/` | **Implemented** | `data/raw/*` (checksummed) | Python: checksum, values equal raw inputs, Σ n_year = n_clim | 7 MB series, loaded on demand |
