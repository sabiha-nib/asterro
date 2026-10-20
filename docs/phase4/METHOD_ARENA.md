# Mismatch Signatures and Method Arena

Two views in the Atlas workspace:

- **Compare → Mismatch signatures**
- **Research → Method Arena**

Both analyse the target and weights currently active in Explore. The target can be any legacy target or any
readiness ≥ 3 registry target. The ranges are those that belong to the target: the legacy table, or
`explore-target-v1`. The engine is `app/frontend/phase4/methods_engine.js` (`asterro-methods-1.0.0`). The baseline
Analogue Score, weights, ranges and ranking are never altered.

## Mismatch signatures — how Earth fails to match a target

For every active criterion c (weight > 0 and a target value), each eligible Earth cell gets a signed,
range-normalised difference:

  δ_c = (e_c − t_c) / (max_c − min_c)

This is the quantity the baseline turns into s_c = clip(1 − |δ_c|, 0, 1). The signature discretises δ_c using the
**baseline's own thresholds** (match s ≥ 0.85, partial s ≥ 0.60):

| Code | Condition |
|---|---|
| ≈ | \|δ\| ≤ 0.15 (within the match threshold) |
| + / − | 0.15 < \|δ\| ≤ 0.40 (Earth moderately higher / lower) |
| ++ / −− | \|δ\| > 0.40 (Earth much higher / lower) |
| ? | no Earth value in this cell |

**Mismatch families.** Cells with identical codes fail to match the target *in the same way*. Families are an
**exact partition** of the eligible cells: no clustering and no parameters. For each family the view shows:

- its size and share;
- how many criteria match;
- its best site and best score;
- its mean score;
- its distinct sites (300 km rule), on the map.

**Fails the same way.** For a selected site, the view lists:

- other distinct sites with the identical signature, at least 300 km away;
- the nearest signatures by Euclidean distance in δ.

Two sites with the same signature can have different scores. What they share is the direction and size class of
every difference.

**Earth ceiling.** Per criterion, the view gives the best similarity any valid Earth cell reaches and how many cells
lie within the match threshold. It does not depend on the weights. A criterion with **no** cell within the match
threshold is a **structural limit**: no weighting can make it match. Being slightly outside the Earth range is
reported but is not a limit while cells still match.

**Example (Jezero, general profile).**

- The 76,781 eligible cells fall into 171 families.
- The LST diurnal range (75.9 K) lies above every valid Earth value (−6.9 to 41.9 K), so its best s is 0.589.
  This is the only structural limit.
- Every high-scoring Jezero analogue therefore carries "−−" on the thermal criterion.

## Method Arena — how much a conclusion depends on the scoring rule

The arena keeps the baseline unchanged and computes three alternative rules on identical data, target and weights:

| Method | Rule | Purpose |
|---|---|---|
| **baseline** (tai-sim-1.0.0, authoritative) | S = Σ w·s / Σw over criteria with an Earth value; s = clip(1 − \|e − t\| / (max − min)); coverage ≥ 0.80 | The ASTERRO score |
| **quantile** | s = 1 − \|F(e) − F(t)\|, with F the mid-rank empirical CDF over valid Earth cells; same weighted mean and coverage rule | Insensitive to extreme range end-points; invariant to monotone re-expression of a variable (tested). A target outside Earth's range maps to F = 0 or 1 |
| **minimum** | S = min over active criteria with an Earth value of s; coverage ≥ 0.80 | Non-compensatory: a strong match elsewhere cannot hide a poor match. Weights only select criteria |
| **strict** | Baseline formula; eligible only when every active criterion has an Earth value | Removes cells whose score rests on renormalised partial data |

**Agreement measures** (per pair of methods):

- Spearman ρ, over cells eligible under both methods;
- overlap of the leading 10 distinct sites;
- Jaccard index of the top 100 cells;
- whether the #1 site is the same.

**Method-robust sites** are in the top 100 cells under every rule. Agreement shows robustness to the rule; it does
**not** show that any method is scientifically correct.

**Data counterfactual — leave one Earth source out.** Under the baseline rule, every criterion supplied by one
source is given weight 0:

- NASA POWER: aridity and annual temperature range;
- GMTED2010: elevation, slope and roughness;
- MODIS LST: the thermal criterion.

The criteria are excluded, never imputed. The result reports how many leading sites survive and whether #1 changes.
Removing a source that leaves no active criterion is blocked.

**Example (Jezero, general profile).**

- Baseline × quantile: ρ = 0.58, with 1 of the leading 10 shared.
- Baseline × strict: ρ = 1.00, with 10 of 10 shared (no leader rests on partial data).
- 4 sites are method-robust: Altiplano, Cordillera Occidental (Bolivia), Cordillera Occidental (Peru) and Atacama.
- Without GMTED2010 none of the leading 10 survive; without NASA POWER 2 survive; without MODIS 3 survive and #1 is
  unchanged.

## Integrity and tests

- **The arena's baseline is checked against Explore's live field.** It must match bit for bit, and the view says
  so. Results computed under an earlier configuration are hidden after a weight or target change.
- **`tests/phase4/test_methods_engine.mjs` (37 checks):**
  - baseline = engine, bit for bit, for four targets;
  - known-answer tests for each method;
  - degenerate ranges and negative weights refused;
  - missing values never scored as 0;
  - zero-weight criteria have no influence under any method;
  - minimum ≤ baseline;
  - strict ⊂ baseline;
  - quantile is invariant to a monotone transform and the baseline is not;
  - the families are an exact partition;
  - the signature codes follow the thresholds;
  - the "fails the same way" rules hold;
  - the drop-source results equal the engine with those weights at 0;
  - determinism.
- **`tests/test_methods.py`:** an **independent numpy re-implementation** of all four methods, the families, the
  ceiling and the drop-source counterfactual. It reproduces the JS engine's leading sites to 1e-12. This checks the
  implementation, not the science.
- **`tests/phase4/ui_methods_smoke.py` (19 checks):** the views in the browser. It re-scores an exported arena report
  in Python, checks that stale results are hidden, and runs an accessibility audit and the phone layout.

## Limitations

- The alternative rules are analytical counterfactuals, not validated improvements. The baseline remains the
  authoritative score.
- δ uses the configuration's normalisation ranges, so signatures inherit their choice.
- No measurement-uncertainty model exists for the Earth stack. These analyses therefore cover **rule** and **data
  source** sensitivity, not measurement uncertainty. Weight sensitivity is covered by the Phase II robustness lab and
  the Discovery Trajectory.
