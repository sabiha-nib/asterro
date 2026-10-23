# Translation-quality register

This register is for developers and reviewers. The interface itself does not show the review status as a warning.
It states the status once, in a short "Interface languages" section of the Method view.

**Native-speaker review: none has taken place for any language.** All of the বাংলা, Español, Français and Deutsch text
was written by Claude (an AI model) for this project. Nobody has reviewed or approved it. The automated checks below
measure completeness and consistency. They do not measure quality.

## Status per language

| | English | বাংলা (bn) | Español (es) | Français (fr) | Deutsch (de) |
|---|---|---|---|---|---|
| Role | canonical source, fallback | translation | translation | translation | translation |
| Interface keys (`i18n_10`–`50`): workspace, journey, journal, header, inventory | 713 (source) | 713 / 713 | 713 / 713 | 713 / 713 | 713 / 713 |
| Research-route catalogue (`i18n_71`–`74`): segment keys | 2 571 (source) | 2 571 / 2 571 | 2 571 / 2 571 | 2 571 / 2 571 | 2 571 / 2 571 |
| Routes covered | — | Compare, Scenarios, Discover, Data, Method, the 14 Lab modules, Trajectory, 23 Atlas modules, Trace / Reproduce / Report sheets, Markdown report | same | same | same |
| Automated validation | — | see "Checks" (passing) | passing | passing | passing |
| Terminology consistency (glossary, route entries) | — | 100 % | 99 % | 100 % | 99 % |
| Native-speaker review | n/a | **not reviewed** | **not reviewed** | **not reviewed** | **not reviewed** |

The catalogue is harvested from the running application. `scripts/i18n_harvest.py` sweeps every route, module and
target, and also runs every browser suite. A string that only appears in a state none of them reaches is not in the
catalogue. In production such a string falls back to English (see "Fallback").

## Checks (automated)

| Check | Where |
|---|---|
| Same key set and placeholders in all five languages; no empty or untranslated strings (interface keys) | `tests/phase4/test_i18n.mjs` |
| Route catalogues: every harvested key is translated; placeholders `{0}` `{nK}` `{pK}` are preserved; no English sentence is left; Bengali entries are in Bengali script; French high punctuation | `tests/phase4/test_routes_i18n.mjs` |
| Terminology against `docs/i18n/glossary.json` (≥ 95 % per language, no term below 80 %) | `scripts/i18n_terms_check.mjs` (run by the test above) |
| Country names come only from CLDR, through a reviewed ISO table | `tests/phase4/test_routes_i18n.mjs` |
| In the browser, every route and module in four languages and three targets: catalogue misses are listed; no English sentence is left outside names, identifiers and labelled quotations; switching back to English restores the English page exactly; numbers and state are unchanged | `tests/phase4/ui_routes_i18n_smoke.py` |
| Workspace and journey in five languages | `tests/phase4/ui_global_smoke.py`, `ui_journey_smoke.py` |

**Missing keys.**

- Interface keys: `tx()` records every miss in `I18N.missing`, and the tests fail on any miss.
- Route segments: `I18G.miss` collects each segment without a catalogue entry, together with its route. The routes
  suite lists them and bounds their number.
- Production never shows a raw key. A miss falls back to the English text.

## Content categories

| Category | Treatment |
|---|---|
| A. Interface text written by the application (labels, explanations, states, errors, tooltips, `aria-label`s, chart text, report prose) | Translated in full. |
| B. Dataset, product, instrument and mission names; citations; URLs; file names; identifiers; criterion codes (`SLOPE`, `THERM` …); status codes (`DIRECT`, `PROXY`, `N/A`, `MISSING`); version strings; hashes | Kept exactly as written. The translator detects these as identifiers (`i18gResidue`). |
| C. Text from source records: target method notes, dataset processing, licence and limitation notes, registry limitations | The translation is shown, followed by a labelled **"Original (English)"** disclosure that holds the verbatim English text (`lang="en"`). The reference beside it is unchanged. |
| D. Text the user wrote (collection names, validation case names and citations) | Never translated. It is treated as a name, so the sentence around it is translated and the user's words stay exactly as typed. |
| E. Place names | Natural Earth country names are localised through the browser's Unicode CLDR data (`Intl.DisplayNames`), via a reviewed Natural Earth → ISO 3166 table (`i18n_65_places.js`). Names without an ISO code of their own, and names that CLDR frames differently (Somaliland, N. Cyprus, Siachen Glacier, Palestine, Hong Kong, Macao …), stay as Natural Earth writes them. Physical regions (Altiplano, Sahara …), planetary feature names (IAU) and target names keep their canonical names in every language. No place name was invented. |

## Outstanding issues

1. **No native-speaker review (all four languages).** This is the main open item. Priorities for a reviewer:
   - the Method and Data texts;
   - the Lab module explanations;
   - Bengali scientific vocabulary (several terms are coined descriptively: পরিস্থিতি-সংকলন, উৎস-ইতিহাস, প্রস্তুতি-স্তর);
   - German compound nouns in narrow labels.
2. **Machine-coined terminology.** See `glossary.json`. The glossary is consistent, but no subject-matter specialist
   has chosen its terms.
3. **Natural Earth labels with broken encoding.** A few labels in the source data have damaged characters (`SÃ£o
   TomÃ© and Principe`, `CuraÃ§ao`, `CÃ´te d'Ivoire`, `Ãland`). In the four translations these appear correctly,
   because the name comes from CLDR. In English they are shown as the data has them. This is a data issue, and it is
   left unchanged so that the baseline stays the same.
4. **Physical region names** have no reliable localised source here and stay in English.
5. **Units.**
   - SI symbols (km, m, K, °C) stay as SI symbols.
   - বাংলা uses কিমি for km in some workspace templates and "km" in the research routes. Both are correct; the
     difference is a consistency item for review.
6. **Segments outside the harvested states** fall back to English until they are harvested and translated (run
   `scripts/i18n_harvest.py --suites`, then `scripts/i18n_catalogue.mjs` and `scripts/i18n_build_routes.mjs`).
7. **Bengali digits.** Numbers are shown in Bengali digits in বাংলা, including cell ranks. Code and hash values stay in
   ASCII.

## Review workflow

1. A reviewer edits the catalogue for their language directly:
   - interface keys in `app/frontend/phase4/i18n_N0_<lang>.js`;
   - route segments in `app/frontend/phase4/i18n_7N_routes_<lang>.js`.

   Each entry maps the English key to the translation. Placeholders must be kept.
2. Run the checks: `node tests/phase4/test_i18n.mjs`, `node tests/phase4/test_routes_i18n.mjs`, and
   `python3 tests/phase4/ui_routes_i18n_smoke.py`.
3. Record the review in this register: language, reviewer (name or role), date, scope (routes or modules), and
   issues found and fixed. Change "not reviewed" to "reviewed (scope)" **only** for the reviewed scope.
4. Glossary changes go to `docs/i18n/glossary.json` first. Then run `node scripts/i18n_terms_check.mjs`.

| Language | Reviewer | Date | Scope | Notes |
|---|---|---|---|---|
| বাংলা | — | — | — | not reviewed |
| Español | — | — | — | not reviewed |
| Français | — | — | — | not reviewed |
| Deutsch | — | — | — | not reviewed |
