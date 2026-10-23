# Discovery Journey and interface languages

The **Discovery Journey** is a story-led way into ASTERRO for people who are not planetary scientists. It is
reached from:

- the landing screen: **Start with a discovery**;
- **Explain this place**, next to *Trace result* for a selected site;
- a door at the top of the **Discover** tab;
- the notice shown on research views in a language other than English.

The journey opens in an accessible full-screen dialog. Focus is trapped inside it, Esc closes it and returns focus,
and the arrow keys move through the Reveal.

The interface can be shown in **English, বাংলা (Bengali), Español, Français and Deutsch**. Choose the language in the
header (globe icon), on the landing screen or in the journey header. A `?lang=bn|es|fr|de` URL parameter also works.
(German and the translation of the globe workspace were added in the next step: see GLOBE_WORKSPACE.md.)

Every number in the journey comes from `app/frontend/phase4/journey_engine.js` (`asterro-journey-1.0.0`), which runs
on the unchanged baseline engine:

- the same per-criterion similarity, weighted mean and 80 % coverage rule;
- the same tie-break and the same 300 km distinct-site rule.

The engine returns data only; the interface chooses the words. **Language never changes a result.** The browser test
checks that the score, rank, per-criterion states and every sensitivity result are identical in all four languages.

## What it shows

| Part | What it is | Computed from |
|---|---|---|
| **Discoveries** (A) | Five story cards, computed live from the bundled, checksum-verified data (badge: *bundled data · checksum verified* when the stack's SHA-256 was verified in the browser; *offline copy* when the browser reports no network) | See below |
| **Reveal** (B) | Seven steps for one Earth place against one target: the Earth place · the other world · where they agree · where they differ · the measurements behind it · a different objective · in summary. Back / Next / Skip / arrow keys; no motion when the system asks for reduced motion | `lens`, `objectives`, `reveal` |
| **Lens** (C) | Each criterion is classed *similar* (s ≥ 0.85), *partly similar* (0.60 ≤ s < 0.85), *different* (s < 0.60), *unknown here* (no Earth value), *not compared* (no target value) or *not weighted*. Each class has a glyph as well as a colour: ≈ ~ ✕ ? — ○. A drawing places the Earth value, the target value and the match zone on one scale. The objective can be switched across the six declared profiles, and the view names the differences that cost most under that objective | `lens` |
| **Change my mind?** (D) | Tests one stated conclusion: "this place is leading site *k*", or its rank when it is not a leading site. It is re-tested under every other declared profile, without each Earth source, without the target's proxy values, and without each criterion. Every alternative lists exactly which weights changed | `changeMind` |
| **Missing pieces** (E) | Typed evidence gaps in plain language, each linked to a dataset, a sensitivity result, the target measurements or the scoring rule: N/A target values, missing Earth values, proxy values, structural limits (no Earth cell within the match threshold), thin MODIS coverage, partial coverage, source or proxy dependence, resolution, temporal coverage, and what is not measured at all | `missing` |
| **Trust** (J) | Seven evidence rows: target measurements, Earth data here, structural limits, robustness, reproducibility, sources, and what this does not tell you. There is **deliberately no combined trust score**, and the engine test checks that none exists | `trust` |
| **Other worlds** (G) | One Earth place against every scoring-enabled target: 2 legacy targets plus the readiness ≥ 3 registry targets. Each row shows its own normalisation and configuration, the number of criteria compared and the criteria not compared. Rank is shown because raw scores of different configurations are not comparable | `multiWorld` + baseline ranks |
| **Through time** (H) | The score with each year's MODIS day–night range in place of the 2016–2025 mean. This is the existing `evolution()`: only that criterion has yearly values | baseline `evolution` |
| **Passport** (F) | `asterro.passport/1` for one result. Exports: JSON, a 1200 × 675 PNG drawn on a canvas from the same data, and Print (a passport-only print style). *Save to My Research* stores it as an `earth_cell` collection item with a provenance snapshot. The passport re-scores from its own contents | `passport`, `rescore` |
| **Team of places** (I) | The fewest Earth places, at least 300 km apart, that together match every active criterion (s ≥ 0.85). The view also lists the criteria that no place on Earth can match | `team` |

### The five discoveries, from the bundled data

All five use the *General analogue* profile (equal weights).

1. **Jezero Crater:** the #1 distinct site is the Altiplano, Bolivia, at 85.0 %. 4 of 6 criteria agree within the
   match threshold.
2. **Lunar South Pole:** the #1 distinct site is the Kunlun Mountains, China, at 84.3 %.
3. **Thermal limit:** Jezero's day–night surface temperature range (75.9 K) is above every valid Earth cell. The
   largest Earth value is 41.9 K, in the Atacama. The best possible similarity on that criterion is s = 0.59, whatever
   the weights.
4. **A team:** no single place matches Jezero on all 6 criteria. Two places, at least 300 km apart, match 5 between
   them. The thermal criterion cannot be matched anywhere on Earth.
5. **Shackleton crater** (registry target, `explore-target-v1`): the #1 site is the Kunlun Mountains, China, at
   81.1 %.

**Example: Change my mind? for the Altiplano and Jezero.** The Altiplano's position as leading site 1 holds under 7
of 14 alternatives, with ranks from 1 to 143. It breaks under:

- the Rover, EVA, Habitat and Instrument profiles;
- removing GMTED2010, where it falls to rank 143, in agreement with the Method Arena's drop-source result;
- removing the target's proxy values (aridity and elevation), where it falls to rank 25;
- removing elevation.

So the summary says "partial analogue: 4 of 6 agree" and "held under exactly half of the alternatives".

### Calibrated wording

The summary level counts agreeing criteria, so it never claims more than the per-criterion test supports:

- **close:** all compared criteria agree;
- **partial:** at least half agree;
- **weak:** fewer than half agree.

An 85.0 % score with 4 of 6 agreeing criteria is therefore *partial*, not *close*.

Robustness is described as:

- **all:** every alternative holds;
- **most:** more than half hold;
- **half:** exactly half hold;
- **few:** fewer than half hold;
- **untested:** *Change my mind?* has not been run yet.

Every summary ends with the scope statement: similar measured conditions only; no physical, geological, biological or
engineering equivalence; not validated in the field. The passport and the Trust view also state that ASTERRO is not
endorsed by NASA.

## Interface languages

- **Files.** `i18n_00_core.js` holds the core: `tx(key, vars)`, the English fallback, `setLang`, Intl number, percent,
  date and list formatting, and the `asterro:lang` event. The four dictionaries are `i18n_10_en.js`,
  `i18n_20_bn.js`, `i18n_30_es.js` and `i18n_40_fr.js`.
- **Choosing a language.** The choice is remembered in `localStorage` (`asterro.lang`) or set by `?lang=`.
  `<html lang>` follows the choice, which gives correct screen-reader pronunciation and hyphenation.
- **What is translated.** The header tabs, the target buttons, the landing screen, the quick-switch prompt, and the
  whole journey (every screen above, including the downloaded PNG).
- **What is not translated.** The research views (Explore panel, Compare, Scenarios, Discover, Data, Method, Lab,
  Trajectory, Atlas) and the weight console are not translated yet. In another language they show a localised notice
  saying so, with a link to the journey. Their numbers are the same in every language. *(Superseded by the completion pass: every research view is now translated — see `COMPLETION_QA.md`.)*
- **Preserved in every language.** Dataset and product names (NASA POWER, MODIS Aqua LST (MYD11C3), USGS GMTED2010,
  MOLA, LOLA, Diviner, MEDA), units, configuration and schema ids, algorithm versions, Natural Earth place names and
  registry target names. They are marked `translate="no"`. Target method notes are quoted from the source records in
  English, and the interface says so.
- **Number formats.**
  - বাংলা uses Bengali digits (৮৫.০%).
  - Spanish and French use a decimal comma.
  - French uses a narrow no-break space before `%` and before `? ! : ;`.
  - Spanish uses a no-break space before `%`.
- **Bengali font.** Bengali text uses Noto Sans Bengali from Google Fonts when online, and otherwise the system's
  Bengali font (Bangla Sangam MN or Kohinoor Bangla on macOS, Nirmala UI or Vrinda on Windows; the test machine used
  FreeSans). Small monospaced, letter-spaced labels switch to the body font for Bengali so that conjuncts render
  correctly.
- **Translation status.** The বাংলা, Español and Français texts were **written by Claude (an AI model)** for this
  project. They are complete drafts, not placeholders. **They have not yet been reviewed by
  native speakers.** The locale files are marked `status: "draft-unreviewed"`, and every non-English journey screen
  says so. A native-speaker review is the first open item.

## Tests

- **`tests/phase4/test_journey_engine.mjs` (40 checks, real stack).**
  - Fields, ranks and leading-site positions equal the baseline bit for bit.
  - The points lost sum exactly to 1 − score.
  - The lens states follow the thresholds; N/A, missing and zero-weight criteria cost nothing.
  - Every objective and every *Change my mind?* alternative is re-scored independently from its stated weights.
  - The GMTED2010 result agrees with the Method Arena.
  - Team members really match what they claim and are at least 300 km apart. The criteria the team cannot match
    equal the Arena's structural limits. There is also a known-answer test.
  - The missing pieces are linked and ordered.
  - The Trust view has no combined score.
  - The seven reveal steps and the calibrated summary levels are checked.
  - The passport re-scores, including after an edited weight.
  - Results are deterministic.
- **`tests/test_journey.py` (3 tests).** An independent numpy re-scoring of the passport, from the stack and from the
  passport's own contents, and of every *Change my mind?* alternative's rank and leading-site position.
- **`tests/phase4/test_i18n.mjs` (40 checks).**
  - The same key set and placeholders in every language.
  - No empty strings, and no string left in English.
  - Every key used by the code and every dynamic key family exists.
  - Dataset names, ids and units are preserved, and the no-endorsement statement is present.
  - The English source equals the baseline labels character for character.
  - Intl formats are correct (Bengali digits, decimal comma) and French typography is checked.
- **`tests/phase4/ui_journey_smoke.py` (63 checks, Chromium).**
  - The default English interface is unchanged.
  - The stories equal the baseline ranking recomputed in the page.
  - Focus trap, Esc and focus return; the reveal by arrow keys, buttons and Skip.
  - The Lens objective switch gives the baseline rank, and the workspace weights are never touched.
  - Every *Change my mind?* alternative re-scores in the page.
  - Missing pieces, Trust, Other worlds and Through time.
  - The passport JSON is re-scored in Python; the PNG is 1200 × 675; Print; Save to My Research.
  - In bn, es and fr: no fallback key and no English words on any journey screen outside preserved terms; for
    Bengali, no Latin-script words except names, units and codes.
  - `html lang` follows the language; results are identical to English; the score uses the locale number format.
  - 390 px phone width in every language; `?lang=fr`; reduced motion; accessibility audit (names, duplicate ids, contrast).
  - The baseline is unchanged after the whole walk-through.

## Limitations

- ~~The research views and the weight console are English only.~~ Translated since the globe-workspace and
  completion passes (`GLOBE_WORKSPACE.md`, `COMPLETION_QA.md`).
- The translations have not been reviewed by native speakers.
- Natural Earth place names and registry target names stay in English.
- No new dataset was integrated in this step. No verified acquisition of a higher-resolution DEM or of other
  variables was possible in the build environment. *Missing pieces* says where more data would help instead of
  implying it exists.
- *Change my mind?* covers declared choices: profiles, sources, proxies and criteria. It does not cover measurement
  uncertainty, because no uncertainty model exists for the Earth stack. A conclusion that holds is robust to those
  choices, not proven.
- The team of places is a greedy cover. It is deterministic and documented, but it is not guaranteed to be the
  smallest possible team.
- *Through time* has yearly values for one criterion only.
- On wide screens in Spanish and French, the header tabs scroll horizontally, as they already did in English below
  about 1,300 px.
