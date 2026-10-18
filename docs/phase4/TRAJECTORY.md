# Discovery Trajectory

The Trajectory tab is ASTERRO's signature interaction. It answers a question that a ranked list and a static map
cannot: **which conclusions survive my own analytical choices, and which ones are artefacts of them?**

## What it does

Every configuration a user settles on in Explore is recorded together with the deterministic engine's own result
for it. A configuration is a combination of target, weights and scoring configuration. The result is the
effective-score field over all 76,781 cells, the cell ranks and the 20 distinct sites.

Three kinds of action add a configuration:

- **Explicit actions** are recorded at once: a slider release, a keyboard step, a profile button, a target
  switch.
- **Live slider drags** are recorded once the drag settles (650 ms). Rapid steps of the same slider within 1.5 s
  are combined into one configuration.
- **"Add declared profiles"** computes the six editorial profiles for the current target. It does not change the
  Explore state.

At most 12 configurations are kept.

The trajectory is then analysed and drawn:

| Output | Definition |
|---|---|
| Leading group | The first K distinct sites (K = 5, 10 or 20; default 10), under the unchanged 300 km rule |
| Track | For each candidate in the union of the leading groups: its distinct-site position in each configuration, or "out" |
| Class | **stable** = in the leading group in every configuration; **entered** = not in the first, in the last; **left** = in the first, not in the last; **transient** = otherwise |
| Cell rank range, median, score range | Taken from the engine's rank array and effective scores. "Ineligible" = coverage below 80 % |
| Displaced by a nearby site | The candidate's own score would have qualified it for the leading group, but a leading site within 300 km scores at least as high. This is a separation effect, not a loss of similarity |
| Transition | The assumptions that changed between two consecutive configurations, the share of the leading group kept, entries, exits, and the largest cell-rank movements |
| Attribution | A single changed assumption makes the step attributable to it. Several changes are reported jointly and are not separated |
| Decomposition | ΔS = Σ_c Δk_c, with k_c = w_c·s_c / Σw over the criteria that have an Earth value. This is exact (tested to 1e-12 against the engine's score change). Raising one weight raises its k and lowers every other k, because Σw grows |
| Separating evidence | For the selected candidate and a competitor in the last configuration, the criterion similarities and their gap, sorted by gap size. This includes criteria with weight 0 ("weighting it would separate them") and criteria without a target measurement ("a compatible measurement could separate them") |

The profile is a label derived from the weights, and the scoring configuration follows from the target. Neither
is counted as a separate assumption.

## Discovery story

For the selected candidate, the story is assembled from the numbers above by a fixed template. No language model
is used. It covers:

- **target and candidate**, with the score and coverage;
- **matching** criteria (s ≥ 0.85), **partial** matches (≥ 0.60) and **mismatches** (< 0.60), each with values;
- the **dominant** contribution;
- the criteria that are **not measured**: no target value, no Earth value, or a proxy rule. Proxies are scored and
  marked "[proxy]";
- the **configuration**, the **data sources** and the **limitations**;
- **one next research question**, chosen by rule.

Its labels are calibrated:

| Label | Condition |
|---|---|
| Strong environmental resemblance on the compared criteria | Score ≥ 0.85 and no mismatch |
| Candidate analogue | Score ≥ 0.60 |
| Robust under the N tested configurations | Stable in at least 3 configurations |
| Depends on this configuration | In the leading group at most once |
| Requires additional characterization | Any proxy, missing target value or missing Earth value |

The story never uses "breakthrough", "safe" or "suitable" (this is tested). It exports as Markdown.

## What it is not

Stability here is **sensitivity to the configurations in this trajectory**. It is not measurement uncertainty,
data-quality uncertainty or model uncertainty, and the interface states this next to every summary. The Phase II
robustness laboratory remains the place for systematic weight-perturbation designs.

## Reproducibility

**Export.** "Export trajectory" writes `asterro.trajectory/1`, with one entry per configuration:

- target;
- scoring configuration;
- weights;
- normalisation ranges;
- the expected ten distinct sites (cell id and score to 1e-12).

**Replay.**

- `python3 scripts/replay_trajectory.py file.json` recomputes every configuration with the Python reference engine.
  It handles legacy targets, cross-planet and registry targets. Before scoring it checks the stack hash, the
  target and the ranges.
- Exit codes: **0** every configuration reproduced; **1** a configuration differs, or its ranges differ from this
  build; **2** cannot replay.
- "Import & replay" in the browser recomputes each configuration and reports REPRODUCED, DIFFERS or best-effort
  per configuration. It refuses a file computed on a different predictor stack.

## Tests

- `tests/phase4/test_trajectory_engine.mjs` (26 checks, real stack):
  - positions and ranks equal the engine's;
  - the class rule and the displaced rule hold;
  - single and joint attribution;
  - the exact decomposition;
  - weight-0 and N/A handling in the separating-evidence table;
  - calibrated story labels and forbidden claims;
  - export and validation;
  - fixture determinism.
- `tests/test_phase4.py`:
  - the six-configuration fixture (Jezero × 4, Shackleton, cross-planet) is REPRODUCED in Python;
  - a tampered weight is detected;
  - a wrong stack is blocked;
  - changed ranges are reported.
- `tests/phase4/ui_trajectory_smoke.py` (24 checks): drives the real slider by keyboard, the profile buttons and
  the target quick-switch; checks that the recorded field equals the live engine result; checks that the profile
  sweep leaves Explore unchanged; covers export → Python replay, import → browser replay, the story export,
  keyboard selection, an accessibility audit and the phone layout.
