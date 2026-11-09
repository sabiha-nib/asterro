# Design system (Atlas and Research Laboratory redesign)

The design layer is in four files:

- `app/frontend/phase4/q1_design.css` (loaded last);
- `app/frontend/phase4/ui_26_design.js`;
- `app/frontend/phase4/ui_27_lab_flow.js`;
- `app/frontend/phase4/ui_28_atlas.js`.

These files change presentation and add workflow. They remove no view, control, route, dataset, report or score.
Every number shown comes from the existing engine.

## Prohibited elements and how they are kept out

`tests/phase4/ui_design_audit.py` reads the computed style and visible text of every visible element. It covers:

- the landing, the Atlas (with and without a selected place) and all seven Laboratory steps;
- the trace sheet and the legal dialogs;
- three sizes: 1440 × 900, 820 × 1180 and 390 × 844;
- Bengali and German as well as English.

| Prohibited | How it is excluded | Audited as |
|---|---|---|
| Harsh gradients, dot grids | No gradient in the design layer. The Phase IV hero gradient is replaced by a flat surface. The only colour ramps left are data scales (similarity legend, slider fill, dimension track) | `background-image` containing a gradient, outside data scales |
| Lucide icons, sparkle icons, emojis | No icon library. The three landing entries are numbered 1–3; the earlier symbols ◐ ✦ ⇄ were removed | Extended-pictographic and sparkle characters in the visible text |
| Pure white backgrounds | Graphite surfaces only. The lightest background is `#1D232A` | Background RGB ≥ 250 |
| Rainbow, neon, pastel, purple | One palette:<br>• graphite `#0D1014` / `#12161B` / `#171C22` / `#1D232A`;<br>• text `#E9ECEF` / `#AEB6BF` / `#8D96A0`;<br>• Mars terracotta `#C9784F`;<br>• Moon steel `#9FB3C8`;<br>• muted readings `#7FB08A` / `#C9A55A` / `#C8695B`.<br>The violet and lavender of the previous pass are gone. Extension status colours now use the same tokens | Hue 255–320°; saturation > 0.85 at mid lightness; light saturated backgrounds |
| Drop shadows, liquid glass | `box-shadow`, `text-shadow` and `backdrop-filter` are off everywhere | Computed values |
| Hover animations, animated arrows | Every transition and animation is off. Hover changes colour instantly | Transition duration, animation name |
| Excessively rounded corners | 6 px on controls, 8 px on panels and dialogs | Radius > 8 px on boxes larger than 24 px |
| Coloured left stripes | The accent stripe on the selected candidate was removed. Selection is a flat tint | Left border ≥ 2 px thicker than the other borders |
| Inter, Geist, Space Grotesk | System stack: SF Pro / Helvetica Neue / Instrument Sans / Segoe UI / Roboto. Bengali keeps Noto Sans Bengali and the other Bengali stacks | Computed font family |
| Terminal aesthetics | Monospace only in code, hashes and identifiers. Labels use sentence case without tracking | Monospace on non-code text |
| Three cards in a row, bento grids | The landing "ways in" is a numbered vertical list. The Laboratory is one ordered list of steps | Three equal bordered boxes on one row; grids with mixed spans |
| Em dashes | Rendered text, placeholders, titles and labels are normalised to an en dash. This runs after the route translator, which therefore still sees the source text | U+2014 in visible text and attributes |
| Checkmark bullets | Rendered checkmarks become a filled dot ● | U+2713 / U+2714 / U+2611 / U+2705 |
| "It's not X, it's Y" copy | "Processes, not only places" is rewritten as "Processes as well as places" in five languages | "not just", "it's not" … in visible text |
| Fake testimonials, three pricing tiers | None exist | Marketing vocabulary in visible text |
| Missing Terms of Service / Privacy Policy | Both added, in five languages: see below | Links and dialogs tested |

## Atlas

- **The 3D Earth globe is the centre.** At ≥ 1181 px the planetary atlas moves to a 340–410 px side panel and the globe
  takes the remaining width. At 1440 px that is 714 px of 1440 px, against about 345 px before. The candidate list
  stays on the right.
- **The globe is the default projection in the Atlas.** Phones open the Atlas on the 3D globe; elsewhere the existing
  default is unchanged. The Globe / Map switch stays.
- **Layers on request.** The five analysis layers are behind one "Layers" button in this view.
- **Context on selection.** Selecting a candidate (on the globe or in the list) opens a short card on the globe:
  - the place, coordinates, landscape type and climate class;
  - the engine's score for the current target;
  - where it is alike and where it differs;
  - "Full analysis" (the step-by-step Lens) and "Compare in the laboratory" (opens Laboratory step 3 for that place).
  - With nothing selected, the card explains what the marked places are.
- Everything the Atlas had before is still in the side panel: hierarchy, search, readiness filters, regions, list,
  table, target cards, comparison, research and records.

## Research Laboratory

A numbered workflow sits above the fourteen research modules, which are unchanged and always visible. One step is
open at a time, with Back and Next:

1. **Target.** Mars or Moon in one click; every analytical target is listed in Advanced view.
2. **Earth candidate.** The 20 leading distinct places, or the place selected on the globe.
3. **Compare.** Earth value, target value, similarity *s* and reading for the six dimensions. The three versioned
   absolute temperatures are added in Advanced view.
4. **Weights.** Mission profiles in one click. "Show all weights" switches to Advanced and opens every slider. The
   original analysis is never overwritten.
5. **Differences and missing data.** Conditions that differ, and the engine's missing-evidence items. Missing data is
   never counted as zero.
6. **Evidence.** The Earth datasets (provider, version, resolution) and the target sources, plus "Trace this result"
   and the evidence-graph module.
7. **Reproduce.** The reproduction record (algorithm, target, cell, weights, stack hash), "Reproduce this result"
   (the existing sheet) and the detailed report download.

## Terms of Service and Privacy Policy

- **Where they are linked:** the landing, the weight console on every view, the Atlas side panel and the Laboratory.
- **How they open:** in a dialog, by click or by address (`#terms`, `#privacy`), with focus on the heading. Escape
  and Close return focus to where it was.
- **What they state** (the factual basis is checkable in the code):
  - **Terms:** free and open, not NASA-endorsed, no warranty, not a safety or landing certification, dataset licences
    stay with their providers, code under the Apache License 2.0, contact via the public repository.
  - **Privacy:** no accounts, cookies or analytics. Language, view, journal and research queue are in local storage,
    and a service worker caches app files. Fonts are requested from Google Fonts, which shares the IP address with
    Google. Exports stay on the device, and the host may keep request logs.
- **Status:** these are plain-language texts written for this project. No lawyer has reviewed them.

## Limits

- The globe's atmospheric rim is drawn by the protected globe renderer (`app/frontend/js/02_globe.js`) in the
  similarity colour. It is not CSS, so the audit does not cover it, and it was left unchanged.
- Fallback fonts were used for testing, because the web fonts are unreachable here.
- No physical-device or screen-reader session took place.
