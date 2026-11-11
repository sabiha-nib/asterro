# ASTERRO V20.1: visual transformation (UI only)

V20.1 is a presentation layer over V20 (`7bf00d0`). It consists of `w21_shell.css`, `ui_35_v21.js` and five small
catalogues, `i18n_9z0`–`9z4`.

V20.1 does not change:

- any score, weight, threshold, profile or the 300 km rule;
- any target, dataset or data file;
- any route, report, saved data, offline behaviour or privacy behaviour.

No feature was removed. Every existing tab, id and control is still in the page and still works.

## What changed

| Area | Before (V20) | V20.1 |
|---|---|---|
| Panels | Near-white side panel beside a navy globe | Every working surface is deep navy (`#0B1D3A`, cards `#102552`, selected `#1E3A8A`). Text is near-white and slate, and passes WCAG AA in all 19 views checked. |
| Navigation | Menu and Settings buttons in the header | Desktop has a 76 px navy rail: Home (logo), Discover, Analyze, Plan, Evidence, Data and Trust, Settings. Each group opens the navigation at that group. Phones and tablets keep the header Menu as a drawer. |
| Globe workspace | Three columns: 390 px panel, globe, 320 px ranking | The context panel is 348 px; the globe gets 1,000 of 1,440 px (it had about 730). The ranking floats over the globe as a navy panel that can be hidden, and the globe controls are moved clear of it. |
| Header | Two or three rows | One command row (brand, destination switch, All destinations, language, Search Earth) and a slim tab strip. |
| Moon and Mars selection | Text radios and a dropdown | A destination switch with each target's own shaded-relief thumbnail. **All destinations** opens a picker with Mars (18), Moon (15) and Both worlds tabs. |
| Opening screen | One left column | Three zones: title and actions on the left, the globe in the middle, ways in and destinations on the right. On phones it is a single column. |
| Phone | Desktop compressed | A 64 vh globe; the target switch as one wrapped card; pill tabs; horizontally scrolling layer controls; panels as navy sheets with rounded tops. |
| Controls | Square buttons | Pills for actions and segments, 8–12 px radii for panels, no shadows and no gradients. |

The destination picker reads every target from `data/registry.json` and shows its real name, position, 55.6 km
analysis window, readiness level and thumbnail. Targets at readiness 3 or higher open on the globe through the
existing code (`setTarget`, `a4ExploreOpen`). Targets below readiness 3 are marked "Atlas only" and open in the Atlas,
as before.

Colours used:

- the supplied navy and blue family;
- coral `#FD6E6E` for Mars and warnings;
- cyan `#B6DFED` for "both worlds".

The similarity colour scale and the match, partial and mismatch colours are data encodings and were not changed.

## Tests

| Run | Result |
|---|---|
| `npm test` (Python 176, every Node suite, V20 and V20.1 catalogue tests) | all pass |
| Browser suites, final build | see `TEST_REPORT.md` |

## Test change

`ui_v20_smoke.py`: on desktop, Menu and Settings are now opened from the rail (the header buttons are shown on tablets
and phones). The checks are unchanged in substance: the dialog opens, focus enters it, and Escape returns focus to the
button that opened it.
