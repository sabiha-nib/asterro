# Globe-first workspace

This step adds to the existing application without replacing anything. The baseline engine, scores, profiles,
ranking, distinct-site rule, constellations, evolution, trace, reproduce, reports, routes and tests are unchanged. The
baseline frontend files (`app/frontend/js/*`, `engine.js`, `index.src.html`, `styles.css`) stay byte-identical;
`tests/phase3/fixtures/protected_sha256.json` verifies this. Everything new lives in `app/frontend/phase4/`:

- `ui_15_dimensions.js` — the six-dimension panel;
- `ui_16_globe.js` — the landing globe, the narrated reveal and the data layers;
- `ui_17_journal.js` — the missions comparison, the portfolio and the Exploration Journal;
- `ui_99_i18n_dom.js` — workspace translation;
- `i18n_50_de.js` — German;
- `p8_global.css` — styles for all of the above;
- additions to `journey_engine.js`.

## The globe is the first thing you can use

- **Landing.** On screens wider than 760 px, the globe behind the landing text responds at once. You can drag and
  zoom it, and clicking a land cell starts the search and opens that place. On phones the landing keeps its scrolling
  layout.
- **"Where on Earth should we look?"** This is the new first action on the landing screen. A card over the globe
  narrates the real search in eight steps:
  1. the target;
  2. its fingerprint;
  3. the Earth cells that qualify under the 80 % rule;
  4. the strongest distinct candidate (the globe flies to it);
  5. its score and weight coverage;
  6. the closest matches (s ≥ 0.85);
  7. the largest differences, in points lost;
  8. why it ranked there: points lost compared with the next distinct site, plus near-ties within 1 point.

  Every number is read from the engine after it has run. The card can be paused, stepped and folded. With
  reduced motion it shows every step at once. It is not a modal: the globe, rail and panels stay usable. When it
  finishes it offers the Lens, "Change my mind?" and the Passport.
- **Layers.** Two layers are added to Similarity, Constellations and Change. Both are drawn with the existing
  shader:
  - **Coverage** marks each cell by the share of the active weight that has an Earth value:
    - every weighted condition measured;
    - ranked, but part of the weight unmeasured;
    - not ranked (below 80 %).

    Under the General profile no cell falls below 80 %: missing aridity leaves 5/6 coverage. Under Science
    instrument testing, aridity carries 3 of 9 weight units, so 14,750 cells drop below 80 % and are not ranked. The
    count equals the engine's unranked cells.
  - **Dimension** paints one criterion's similarity s to the target, with the criterion chosen in the legend. On
    cross-planet it falls back to the similarity field.
- **Globe and map** are one canvas: the existing projection morph. Selection, layers and markers are therefore
  always in sync.

## The six dimensions, explained in place

Each weight slider now shows:

- a plain-language line and its unit;
- a small scale with the target value (diamond) and the selected place (dot);
- a "not used in this score" state when its weight is 0 or the target has no value.

The ⓘ button opens one explanation panel with:

- what the dimension measures;
- the target value, its status and how it was obtained (quoted from the target record);
- the selected place's value, its similarity s, its weight and its contribution in points (from `detailFor`);
- the statement that a weight is the emphasis the user chose, not a measure of scientific importance.

The sliders, ids and behaviour are the baseline's. The rail's existing ▲ / ▼ / NEW markers show how rankings move
after a change.

## Robustness, coverage and the calculation

- **Robustness label** (in "Change my mind?"). The label is decided by a documented rule over the declared mission
  profiles only:

  | Label | Rule |
  |---|---|
  | Stable across the tested profiles | The conclusion holds under every profile |
  | Sensitive to weighting assumptions | It holds under at least half |
  | Ranking changes under the tested assumptions | It holds under fewer than half |
  | Insufficient evidence | The place is not ranked, or fewer than two profiles could be tested |

  Data-source and proxy tests stay listed separately. Near-ties (leading sites within 1 point) are listed. For the
  Altiplano and Jezero, the conclusion holds under 1 of 5 other profiles, so the label is "Ranking changes".
- **Coverage meter** (in Missing pieces). It shows, for each active dimension, whether an Earth value exists and its
  share of the weight, against the 80 % rule. It says whether the place cannot be evaluated adequately, which is not
  the same as scoring poorly. It also reports how many of the 10 leading sites are fully measured.
- **The calculation** (in Trust). The score is written out with the place's own numbers: d, s, w, k per criterion,
  Σw, Σk = S, and the coverage. Ties go by score and then cell id; leading sites are 300 km apart; match and partial
  thresholds apply per criterion. The view states that the score is not a probability.

## Same Earth, different mission · Portfolio

- **Same Earth, different mission.** Choose two declared profiles. The view shows:
  - the 10 leading distinct sites under each;
  - which sites stay, enter or leave;
  - the exact weight changes;
  - for one site, the change in each criterion's contribution. These changes add up exactly to the change in score.

  Example: under General and Rover mobility, 2 of the 10 leaders are shared. The Altiplano's own score rises
  (85.0 % → 90.8 %) as slope and roughness gain weight, but other places gain more, so it moves from #1 to #22.
- **Portfolio.** Choose up to six leading places. The view shows:
  - a criteria × places table of s, with glyphs as well as colours;
  - which criteria are matched by at least one place, by none, or by more than one;
  - what each place uniquely contributes;
  - the closest pair distance and each place's coverage.

  The engine's greedy team is offered as a labelled suggestion. Nothing is called optimal.

## The Exploration Journal

The journal has an optional 10-step expedition, eight achievements and four challenges. Progress is kept in this
browser only.

**Achievements unlock only when the real action has happened.** The browser suite checks this. For example:

- Evidence First needs both the Sources row and Missing pieces;
- viewing a passport does not unlock Reproducibility Pioneer, but downloading one whose re-score matched does.

**Challenge answers come from `AsterroJourney.challenges` on the bundled data:**

- a leading site with a closer thermal match than #1;
- the dimension that costs #1 the most (thermal);
- why a place is not ranked under Science instrument testing (the 80 % coverage rule, not low similarity);
- two leading sites within 1 point whose largest cost is a different dimension.

A small chip on the globe shows expedition progress and opens the journal.

## Languages: English, বাংলা, Español, Français, Deutsch

- **Where to choose.** The language control is in the header: a globe icon and the language code over a native
  select. It is no longer in the weight panel. The landing screen and the journey header also offer it.
- **German** is complete: every one of the interface's keys, with German number formats (85,0 %, 76.781).
- **What is translated in every language.** The workspace is now translated as well as the journey:
  - header, tabs, tab tooltips, target buttons;
  - globe controls and layer legends, status line, readout;
  - ranking rail;
  - Explore panel: fingerprint, DNA, match / mismatch, data quality, empty states, cross-planet notes;
  - weight console and profiles;
  - the reveal card;
  - screen-reader announcements for search and target changes.

  The baseline views render English; `ui_99_i18n_dom.js` then replaces their phrases from an exact catalogue, whose
  English entries are the baseline text character for character (checked by `test_i18n.mjs`). Strings with numbers
  or names use templates, and numbers are re-formatted for the locale.
- **What is not translated.** These stay as they are:
  - place names (Natural Earth) and registry target names;
  - the brand wordmark;
  - target method notes, which are quoted from source records in English, as tooltips and in the ⓘ panel;
  - formulas.

  The other research tabs (Compare, Scenarios, Discover, Data, Method, Lab, Trajectory, Atlas) remain English and
  show a localised notice.
- **Switching language keeps the state.** Target, selection, weights, tab and layer are kept, and no number
  changes. The browser suite checks this through all five languages.
- **Translation status.** The বাংলা, Español, Français and Deutsch texts were **written by Claude (an AI model) and
  have not been reviewed by native speakers**. The interface says so.

## Tests

| Suite | Checks | What |
|---|---|---|
| `tests/phase4/test_journey_engine.mjs` | 53 | Adds: the robustness-label rule and known answers; near-ties; Σk = S; missions leaders equal the baseline under each profile and Σ Δk = ΔS; portfolio matches and distances; every challenge answer is verified against the data |
| `tests/phase4/test_i18n.mjs` | 52 | Adds German, five languages with identical key sets and placeholders; the 75 workspace phrases are verbatim baseline text; profile and criterion labels equal the registry; German number formats; constellation-name composition |
| `tests/phase4/ui_journey_smoke.py` | 70 | Adds Deutsch, plus the Missions, Portfolio and Journal screens in every language |
| `tests/phase4/ui_global_smoke.py` | 39 | Header control (not in the weight panel); all tabs visible at 1512 px with the registry loaded; clicking land on the landing globe opens that place; the reveal states the engine's results; Coverage and Dimension layers equal the engine (14,750 unranked under Science instrument testing); the dimension panel; language switching keeps the state; no English left in the workspace in bn / es / fr / de; journal unlocks only on real actions and the challenge answers are the data's; missions and portfolio equal the engine; phone width in five languages; accessibility of the new controls |

## Limitations

- No new datasets were integrated. No verified acquisition (download, licence check, regridding onto the
  0.5° × 0.625° stack, validation) was possible in this build environment. The interface names those gaps rather
  than implying them.
- The other research tabs are English only.
- The translations are unreviewed.
- The suites run in English and in the four languages on a 1512 px desktop and a 390 px phone. Tablets were not
  tested separately.
- The landing globe is not draggable on phones, where the landing text scrolls.
- The journal's progress is per browser, with no account or server.
- The robustness label is about the declared profiles. It is not a statistical confidence.
