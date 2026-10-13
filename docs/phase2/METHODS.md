# ASTERRO Phase II — Scientific methodology of the new features

Every Phase II result is an **analysis beside the baseline**. The baseline Analogue Score is never
modified or replaced. Each section below answers the same twelve questions:

1. What the feature does
2. Question addressed
3. Inputs
4. Origin of the inputs
5. Calculations
6. Assumptions
7. Missing data
8. What the output means
9. What it does not mean
10. How to reproduce it
11. How it is tested
12. Limitations

Notation: *s_c* is the criterion similarity `clip(1 − |e − t|/(max − min), 0, 1)` and *S* is the
baseline Analogue Score. "Rank" is the cell rank among eligible cells (score descending, then cell
id ascending). All formulas are implemented in `app/frontend/phase2/lab_engine.js` and, for
replayable analyses, independently in `src/phase2/analysis.py`.

---

## 1. Analogue Robustness Laboratory

1. **What it does.** Re-ranks all 76,781 cells under alternative weight configurations. It reports
   each candidate's rank distribution, how often it stays near the top, which single weight moves
   it most, and what happens when one criterion is removed.
2. **Question.** Is a candidate's high rank stable under reasonable alternative weightings, or
   does it depend on one criterion?
3. **Inputs.**
   - Baseline target, weights and normalisation ranges.
   - The predictor stack.
   - Candidates: the baseline top-20 distinct sites, plus the picked cell if any.
4. **Origin.** `public/data/stack.bin`, `targets.json` and `app.json` (all baseline, unchanged).
5. **Calculations.**
   - **Designs:**
     - one-at-a-time — each active weight ×0.5 and ×2 separately (2k configurations);
     - full factorial — every combination of ×{0.5, 1, 2} (3^k configurations, deterministic
       enumeration, includes the baseline);
     - seeded sample — each weight ×2^u, u ~ U(−L, L) independently (mulberry32 PRNG, recorded
       seed, L ≤ 2).
   - **Per configuration:** each candidate's exact rank.
   - **Per candidate:**
     - baseline rank;
     - min, nearest-rank 25th / 50th / 75th percentile, and max;
     - fraction of configurations in which it is within the top *q* % of eligible cells;
     - fraction of configurations in which it is within the top-N cells.
   - **Classification:**
     - STABLE if the top-*q* % fraction ≥ *f_s* (default 0.95, bounds 0.8–1);
     - MODERATELY SENSITIVE if ≥ *f_m* (default 0.5, bounds 0.3–0.95, below *f_s*);
     - HIGHLY SENSITIVE otherwise;
     - INSUFFICIENT EVIDENCE if fewer than 10 configurations were run, or the candidate's weight
       coverage is below 100 %.
   - **One-at-a-time sensitivity:** max |log₂(rank_factor / rank_baseline)| for each criterion; the
     "driver" is the criterion with the largest value.
   - **Ablation:**
     - the candidate set is the baseline top-20 distinct sites;
     - for each active criterion, set its weight to 0 and recompute the order and the top-20
       distinct sites;
     - report the overlap with the baseline top-20 (exact cell match), and Spearman ρ of the
       ranks of the baseline top-1,000 cells.
6. **Assumptions.**
   - The tested weight space (multipliers ½–2) represents "reasonable" alternatives.
   - Normalisation, criteria and targets are held fixed.
7. **Missing data.** Handled exactly as in the baseline: missing Earth values are excluded and the
   score is renormalised; a cell with weight coverage below 0.80 gets effective score −1. A
   candidate missing any active criterion is classed INSUFFICIENT EVIDENCE.
8. **Meaning.** How sensitive the rank is to weights within the tested space.
9. **Not meaning.** "Stable" is not scientific validation, is not robustness to other
   methodological choices, and a sample frequency is not a real-world probability.
10. **Reproduce.** Lab → Robustness writes a Vault record. Use Vault → Replay, or
    `python scripts/replay_experiment.py record.json`.
11. **Tested.**
    - The experimental path is bitwise-identical to `TAIEngine` for every profile and both
      targets, the cross min rule holds, and the Python fixtures are reproduced.
    - Exact ranks equal full-sort ranks, including ties.
    - Design sizes, determinism and bounds are checked; the classification rules are checked on
      synthetic runs.
    - The seeded sampler matches between JS and Python.
    - A browser-exported 729-configuration record is replayed identically by the Python
      implementation; a tampered record is detected.
12. **Limitations.**
    - Ranks are cell ranks, not distinct-site positions.
    - The ablation overlap counts exact cells only, so it undercounts a site that moved to a
      neighbouring cell.

## 2. Multi-Objective Analogue Discovery

1. **What it does.** Computes the Pareto front of criterion similarities over a pool of top
   cells. It also builds a deliberately diverse portfolio, and compares three candidate sets.
2. **Question.** Which cells offer different trade-offs, and do the top sites cover distinct
   environments?
3. **Inputs.**
   - Pool: the top *n* eligible cells (default 800, bounds 50–3,000).
   - Selected objectives (criteria).
   - Set size *k* (3–20) and redundancy δ.
4. **Origin.** Baseline stack and targets.
5. **Calculations.**
   - **Dominance:** cell a dominates cell b iff *s_c(a) ≥ s_c(b)* for every selected criterion
     and > for at least one. Cells missing any objective are "not evaluable".
   - **Cross mode:** the per-criterion similarity is min(s_Mars, s_Moon), only for criteria
     defined for both targets.
   - **The three sets:**
     - Set A: baseline top-*k* distinct sites.
     - Set B: greedy max–min diversity (farthest-point) in range-normalised criterion space (RMS
       distance), restricted to score ≥ the *k*-th baseline distinct site and ≥ 300 km separation.
     - Set C: Pareto-front cells taken in score order with 300 km separation.
   - **Metrics for each set:**
     - mean score;
     - min and mean environmental distance;
     - min and mean geographic separation;
     - redundant pairs (distance < δ);
     - per-criterion coverage (set spread ÷ pool spread);
     - missing values;
     - stable share (when a matching robustness run exists).
6. **Assumptions.** Range-normalised RMS distance is a reasonable measure of environmental
   difference.
7. **Missing data.** Not evaluable for Pareto purposes; never treated as optimal. Distances use
   only criteria that both cells have.
8. **Meaning.** A Pareto cell offers a different trade-off.
9. **Not meaning.** Not universally better. Set B is a heuristic and is not globally optimal; no
   objective function combining the metrics is defined.
10. **Reproduce.** A Vault record (parameters and selected cells); re-run with the same
    parameters.
11. **Tested.** The Pareto front matches between JS and Python on random points, NaN handling is
    checked, and the UI walk-through runs it.
12. **Limitations.** With six objectives a large share of the pool is non-dominated (462 of 800
    for Jezero, General profile), which is expected in high dimensions.

## 3. Spatial Analogue Microclimate Atlas

1. **What it does.**
   - Shows each criterion's similarity across a 3×3, 5×5 or 7×7 window of **whole cells** around
     the candidate.
   - Gives window statistics and a least-squares spatial gradient.
   - Gives the terrain distribution inside the target window and a scale ladder.
2. **Question.** Is the candidate's similarity spatially representative, or does the area vary
   strongly?
3. **Inputs.**
   - Earth: baseline stack cell values.
   - Targets: the MOLA / LOLA 60 × 60 bins (926.6 m) of the target windows.
4. **Origin.** `data/raw/terrain_planets.npz` (the inputs of the target values), processed by
   `scripts/build_phase2_data.py`.
5. **Calculations.**
   - **Window statistics:** mean, median, sample SD, nearest-rank IQR, min–max and
     valid-fraction over the valid window cells.
   - **Gradient:** a least-squares plane z = a + gx·x + gy·y (x east, y north, km) — magnitude
     and bearing.
   - **Target windows:** slope and elevation histograms and percentiles.
6. **Assumptions.** None beyond the descriptive statistics.
7. **Missing data.** Ocean or invalid cells are hatched; cells beyond the pole are off-grid (not
   wrapped). **Earth sub-cell data are unavailable**, and the module states: "Sub-cell
   environmental characterization unavailable at the current data resolution."
8. **Meaning.** Variation **between** neighbouring ~55 km cells, and within the target window.
9. **Not meaning.**
   - Not within-cell variation.
   - Neighbours are context only and are never part of the candidate's score footprint.
   - A similar regional mean is not site-level characterisation.
10. **Reproduce.** Deterministic from the stack; open the module for the same cell.
11. **Tested.**
    - Window centring and off-grid handling are checked.
    - Statistics use only valid cells.
    - Target-window means equal the target slope values, and the elevation SD equals the
      target roughness (`test_phase2.py`).
12. **Limitations.** Source pixels (GMTED 30″, MODIS 0.1°) were not retained. Restoring them
    needs re-ingestion with network access to USGS / NASA.

## 4. Planetary Uncertainty Explorer

1. **What it does.** For one cell and target, lists the uncertainty sources for each criterion.
   It quantifies only those the data support, by recomputing the score with documented
   alternative inputs, and gives a min–max sensitivity envelope.
2. **Question.** How far could documented alternatives move the comparison, and which
   uncertainties cannot be quantified?
3. **Inputs.**
   - MODIS yearly day−night LST (2016–2025).
   - The MODIS colour-map bin (0.6 K).
   - MEDA Ls-bin and per-sol day−night values.
   - Diviner summer and winter values.
   - Target-window slope median.
   - Modis coverage.
   - Neighbour SD.
4. **Origin.** The baseline bundle, `targets.json` `raw_reference`, and `context.json`. The
   per-sol MEDA values are derived from `data/raw/mars_meda.json`, using LTST hours 13 and 1.
5. **Calculations.**
   - Score recomputed with the baseline formula after substituting one input:
     - each yearly value;
     - e ± 0.6 K (worst-case decoding bound on the day−night difference: ±0.3 K on each term);
     - each Ls-bin value or each season;
     - per-sol p10 and p90;
     - the window median slope.
   - Envelope: min and max over the combinations (Earth thermal value × target thermal value ×
     target slope statistic).
   - Each criterion is assessed as "characterised" (both sides), "partially" (one side), "not
     characterised", or "proxy".
6. **Assumptions.** The alternatives are plausible stand-ins for the reference value.
   Cross-instrument comparability is assumed (labelled ASSUMED).
7. **Missing data.** Shown as UNAVAILABLE, not estimated:
   - POWER, GMTED and MODIS instrument accuracy;
   - Earth interannual temperature-range variability;
   - Mars inter-annual variability.
8. **Meaning.** The spread of the score under documented alternative inputs.
9. **Not meaning.** Not a confidence interval, and no probability is attached. The decoding bound
   is deterministic, not statistical.
10. **Reproduce.** Deterministic from the published data.
11. **Tested.** Through the UI walk-through. The MEDA per-sol mean is consistent with the target
    (`test_phase2.py`).
12. **Limitations.** Only one criterion (thermal) and terrain slope have target-side alternatives.

## 5. Analogue Failure-Mode Laboratory

1. **What it does.**
   - Decomposes the score into points lost per criterion.
   - Lists planetary factors outside the model, with the evidence actually held.
   - Gives an activity-specific review checklist.
   - Searches the whole field for counterexamples.
2. **Question.** How could an apparent match mislead a particular objective?
3. **Inputs.**
   - The baseline breakdown (`TAIEngine.detail`).
   - `catalog.MISSING_FACTORS` and `catalog.ACTIVITIES`.
   - MODIS day / night LST.
   - MEDA ground T at 13–14 and 01–02 LTST.
   - Diviner T14 / T02.
   - MEDA pressure.
4. **Origin.** Baseline data, `context.json`, and `targets.json` raw references.
5. **Calculations.**
   - **Points lost:** 100·w_c(1 − s_c)/Σw (these sum with *S* to 100).
   - **Counterexamples:**
     - (a) top-800 cells with any s_c < τ;
     - (b) cells ranked 801 to the 10th percentile with s_c ≥ σ on a chosen criterion;
     - (c) cells in the top 1 % under one mission profile but outside the top 10 % under another;
     - (d) top-1 % cells that fall outside the top 10 % when the proxy criteria get weight 0.
6. **Assumptions.** The activity checklist is editorial (ASSUMED). It contains no thresholds.
7. **Missing data.** An Earth value that is missing is shown as excluded. Unmodelled factors are
   UNAVAILABLE.
8. **Meaning.** Where and why the match is weak, and which differences are invisible to the
   score.
9. **Not meaning.** No risk score, and no safety, suitability, habitability or certification
   judgement.
10. **Reproduce.** A Vault record of counts and parameters; deterministic.
11. **Tested.** Through the UI walk-through on Mars, Moon and cross. Catalogue consistency is
    tested (an UNMODELED factor never claims evidence; checklists carry no numbers).
12. **Limitations.** Counterexample thresholds are user-adjustable conveniences, not physical
    limits.

## 6. Planetary Evidence Graph

1. **What it does.** Builds a typed provenance graph for one cell and criterion (or all), and
   highlights the upstream lineage of any node.
2. **Question.** Which data and calculations actually support a displayed result?
3. **Inputs.**
   - `app.json` (datasets, `criteria.earth_source`).
   - `targets.json` (values, status, methodology).
   - The provenance manifest (raw files, scripts and checksums; target sources per criterion;
     unverified list).
   - The baseline breakdown.
   - Vault records.
4. **Origin.** As listed. The manifest is copied into `context.json` at build time.
5. **Calculations.** No inference. Each node and edge corresponds to an explicit record field.
   - **Node types:**
     - planetary target, criterion, source dataset, dataset version (raw file);
     - measurement, Earth candidate, scoring configuration;
     - analytical experiment, derived metric, evidence gap;
     - research finding, reproducibility artifact.
   - **Edge types:**
     - measured by, derived from, compared against;
     - contributes to, affected by, depends on;
     - reproduced by, limited by, conflicts with, supported by.
   - **Conflicting evidence:** Diviner summer vs winter ΔT, and the MEDA Ls-bin minimum vs
     maximum.
6. **Assumptions.** None. Unknown metadata is shown as "unknown".
7. **Missing data.** A missing Earth value becomes an evidence-gap node; proxy and N/A statuses
   become gap nodes.
8. **Meaning.** The recorded evidence chain behind a result.
9. **Not meaning.** Not a judgement of evidence quality beyond the recorded statuses.
10. **Reproduce.** Deterministic from the published files.
11. **Tested.** The UI walk-through checks that all 12 node types and all 10 edge types occur.
12. **Limitations.** The dataset-version node is the raw-file checksum. Upstream product DOIs are
    given where the dataset records hold them.

## 7. Cross-Planet Evidence Comparator

1. **What it does.**
   - Puts the Mars and Moon fingerprints side by side on the shared normalisation, with
     compatibility flags.
   - Shows each candidate's per-target scores, and the per-criterion difference for criteria
     measured directly for both targets.
2. **Question.** Where do the targets differ measurably, and where does a candidate resemble one
   more than the other?
3. **Inputs.** Targets, baseline breakdown, `profileFor()`.
4. **Origin.** Baseline.
5. **Calculations.** Compatibility rules come from status, method and source; the difference is
   s_Mars − s_Moon.
6. **Assumptions.** The rule table, documented in the source.
7. **Missing data.** N/A criteria are flagged as not comparable.
8. **Meaning.** The directions of difference.
9. **Not meaning.** No unified score is created; the existing min rule is unchanged.
10. **Reproduce.** Deterministic.
11. **Tested.** UI walk-through.
12. **Limitations.** Aridity and elevation are identical proxies for both targets, so they carry
    no discriminating information.

## 8. Planetary Analogue Evolution Observatory

1. **What it does.**
   - Shows the yearly MODIS day−night LST series with a Theil–Sen slope and a Mann–Kendall test,
     plus a stability classification.
   - Shows yearly MODIS coverage.
   - Shows the POWER monthly climatology (with its first harmonic) and the Mars Ls-bin air
     temperatures.
   - Compares candidates over the common MODIS window.
2. **Question.** How does the environment vary over the observed period, and is the evidence
   sufficient?
3. **Inputs.**
   - Stack: `lst_diurnal_range_yearly`.
   - Phase II series: `t2m_monthly`, `prec_monthly`, `modis_n_year`.
   - MEDA bins.
4. **Origin.**
   - `data/raw/power_climatology.npz` (months 1–12, int16 at 0.01).
   - `data/raw/modis_lst.npz` (`n_year`).
5. **Calculations.**
   - Theil–Sen median slope.
   - Mann–Kendall S with tie correction, continuity-corrected z, and a two-sided normal p.
   - **Classes:**
     - fewer than 8 years → insufficient;
     - p < 0.05 → "monotonic change detected (exploratory)";
     - yearly range ≤ 2 × 0.6 K → stable (indistinguishable from decoding precision);
     - otherwise → interannual variation.
   - **Coverage per year:** n_year / (Σ n_year / (coverage × 10)). Σ n_year = n_clim is tested.
   - **Harmonic:** first-order least squares on 12 equal months.
6. **Assumptions.** Years are independent for the Mann–Kendall test. Collections 006 / 061 are
   assumed comparable; this is unverifiable, and is flagged.
7. **Missing data.** Missing years are marked ×; change detection is not run with fewer than
   8 years.
8. **Meaning.** Observed historical variability.
9. **Not meaning.** No forecast, no extrapolation, and no equivalence to planetary seasons. The
   Earth and Mars calendars are not aligned.
10. **Reproduce.** Deterministic from the published data.
11. **Tested.**
    - Theil–Sen, Mann–Kendall and harmonic match between JS and Python.
    - Series values equal the raw inputs within int16 rounding, and the monthly range reproduces
      the baseline criterion (`test_phase2.py`).
12. **Limitations.**
    - n = 10 gives the test low power.
    - POWER provides a climatology only, with no interannual values.

## 9. Mission Requirement Translator

1. **What it does.** Lets the user state measurable conditions on documented cell statistics,
   maps each one to its evidence, and evaluates candidates.
2. **Question.** Which candidates can the available evidence show to meet the user's analytical
   requirements?
3. **Inputs.**
   - Variable (from `catalog.REQUIREMENT_VARIABLES`) and operator: ≤, ≥ or between.
   - Threshold or thresholds.
   - Optional: contiguous area (km²), required resolution (km), required record length (years).
4. **Origin.** Thresholds are always **user-defined** (labelled "User-defined analytical
   requirement"). The example set is labelled as examples.
5. **Calculations.**
   - **MEETS:** a finite value that satisfies the condition, and that also satisfies the area
     condition when one is set. The area is the 8-connected region of qualifying cells, summed in
     km².
   - **FAILS:** otherwise.
   - **PARTIAL:**
     - the required resolution is finer than the cell; or
     - the data record is shorter than required; or
     - the variable is static and a temporal requirement was set.
   - **CANNOT:** no finite value.
6. **Assumptions.** The cell-mean statistic is what is tested (stated with every requirement).
7. **Missing data.** Never a match (CANNOT).
8. **Meaning.** Whether a stated analytical condition is supported at cell scale.
9. **Not meaning.** No engineering suitability, and the Analogue Score never overrides a failed
   requirement; the two are shown in separate columns.
10. **Reproduce.** Export the requirement set (JSON); a Vault record can be replayed in the
    browser.
11. **Tested.**
    - Meets, fails and cannot are checked; missing values are never a match.
    - Resolution, years and area logic are checked, and invalid requirements are rejected.
    - A browser replay reproduced a record.
12. **Limitations.** Only the variables in the stack can be tested.

## 10. Observation Value Engine

1. **What it does.** States why formal value-of-information (VOI) analysis is blocked. It then
   ranks candidate pairs whose order flips across the tested weightings, identifies the criterion
   driving each flip, and issues a recommendation for each pair with its audit trail.
2. **Question.** Which additional measurement would most help distinguish ambiguous candidates?
3. **Inputs.** A Robustness record for the current configuration (pair flips and one-at-a-time
   flips).
4. **Origin.** The Robustness Laboratory.
5. **Calculations.**
   - Pairs with flip fraction ≥ 20 %.
   - Driver: the criterion with the most one-at-a-time reversals, then the largest weighted Δs.
   - The recommendation text is a fixed template filled with these values.
6. **Assumptions.** The heuristic itself (labelled INFERRED).
7. **Missing data.** Without a robustness run, nothing is recommended.
8. **Meaning.** An evidence-priority suggestion with its trigger.
9. **Not meaning.** No expected information gain, value or probability. Of the six formal VOI
   conditions, four are unmet, and the module lists them.
10. **Reproduce.** Through the linked robustness record.
11. **Tested.** UI walk-through. The pair-flip counting is unit-tested.
12. **Limitations.** Limited to weight-driven ambiguity.

## 11. Analogue Research Mission Planner

1. **What it does.** Assembles a structured preliminary plan from recorded outputs, and exports
   it as Markdown or JSON. The plan contains:
   - objective and candidates;
   - baseline scores;
   - criterion matches;
   - robustness results;
   - requirements;
   - evidence gaps;
   - proposed measurements, labelled automatic or user-defined;
   - suggested questions, labelled as suggestions;
   - checklist;
   - reproducibility configuration and records;
   - limitations and assumptions.
2. **Question.** How can a discovery become a reproducible preliminary investigation plan?
3. **Inputs.** Outputs of the other modules.
4. **Origin.** As listed.
5. **Calculations.** None beyond assembly.
6. **Assumptions.** Listed in the plan.
7. **Missing data.** Gaps are listed explicitly.
8. **Meaning.** A starting point for a study.
9. **Not meaning.** Not a validated mission plan, safety assessment or site certification.
10. **Reproduce.** The plan embeds the baseline snapshot and record ids.
11. **Tested.** The UI walk-through checks generation and the evidence gaps. The Review module
    can check the plan's language.
12. **Limitations.** Research questions are templates.

## 12. Scientific Reproducibility Vault

1. **What it does.** Stores, verifies, replays, compares and exports experiment records.
2. **Question.** Can a reviewer see what was tested and reproduce it?
3. **Inputs.** Records written by the modules.
4. **Origin.** Browser localStorage (one browser only), or imported JSON.
5. **Calculations.**
   - **Verification:**
     - the configuration hash equals the record id;
     - the outputs hash matches;
     - the stack SHA-256, algorithm version and Phase II version match.
   - **Replay:** recompute and compare the canonical-JSON SHA-256 of the outputs.
6. **Assumptions.** None.
7. **Missing data.** Missing dependencies (a different stack or version, or an unsupported
   module) are reported exactly, and replay is blocked.
8. **Meaning.** Integrity and reproducibility of a record.
9. **Not meaning.** Not a scientific validation of its content.
10. **Reproduce.** `python scripts/replay_experiment.py <package>` handles robustness and
    ablation.
11. **Tested.**
    - In the browser, replays reproduced the robustness, ablation and requirements records.
    - The Python replays reproduce the browser records, and tampering is detected.
    - Record ids match between JS and Python hashes.
12. **Limitations.** Browser storage is per viewer. Export a record to keep or share it.

## 13. Scientific Review

1. **What it does.**
   - Answers six fixed questions deterministically from computed outputs, tagging each sentence
     with its evidence category and source.
   - Flags guardrail phrases (equivalence, certification, safety, suitability, validation,
     habitability, authority, proof, optimality, probability, future projection).
   - Flags percentages that match no displayed score.
2. **Question.** Is a statement supported by the available evidence?
3. **Inputs.** Computed outputs and the user's text.
4. **Origin.** As listed.
5. **Calculations.** Fixed templates and regular expressions.
6. **Assumptions.** The flags are heuristics.
7. **Missing data.** A missing analysis gives an UNAVAILABLE answer.
8. **Meaning.** Prompts for review.
9. **Not meaning.** No flag does not mean correct. Negated statements are flagged too (for
   example, "not certified").
10. **Reproduce.** Deterministic.
11. **Tested.** Guardrail unit tests and the UI walk-through.
12. **Limitations.** **The language-model copilot is not implemented.** The static build has no
    model service, and none may touch the scoring pipeline.
