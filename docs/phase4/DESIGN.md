# Design layer

`app/frontend/phase4/q1_design.css` and `ui_26_design.js` change presentation only. No control, view, route or number
was removed. Every result shown comes from the same engine.

## Principles

- **Calm surface, depth on demand.** A beginner sees one promise, three ways in, and a plain-language card. Weights,
  status tags, traces, method and data stay one click away.
- **A clean base.** The palette:

  | Role | Colour |
  |---|---|
  | Cosmic navy | `#070B1A` |
  | Electric blue (focus, selection) | `#4C8DFF` |
  | Soft violet | `#9B7BFF` |
  | Warm coral (primary action, Mars) | `#FF7A59` |
  | Lavender (secondary headings) | `#C9C3FF` |

  The scientific visualisations (globe, similarity field) carry the colour. Surfaces are glass panels with soft depth.
- **Typography.** System UI font (SF Pro on Apple devices), sentence case, no tracking on labels, tabular figures for
  numbers. A monospace font is kept only for code, hashes and configuration ids. Bengali keeps its own font stacks
  (Noto Sans Bengali, Hind Siliguri, Kohinoor Bangla …).

## What changed for the person using ASTERRO

| Area | Before | Now |
|---|---|---|
| Landing | Five buttons of equal weight, uppercase display type | One promise ("Find Earth's environmental analogues for worlds beyond Earth."), three cards: Explore Earth, Discover an analogue, Compare with the Moon or Mars. The original five buttons remain as quieter links |
| Navigation | Nine equal uppercase tabs | The same nine views, grouped by order and dividers: Explore · Discover, Atlas · Compare, Scenarios, Trajectory · Method, Data · Lab |
| Selected place | Score and per-condition bars | Adds a card on top: how similar the place is, strongest similarities (s ≥ 0.85), important differences (s < 0.60), Earth's limits for that world, and "See why, step by step" (opens the 7-step Reveal) |
| Weights | Every slider with status tags, share of weight and target / Earth track | Simple (default): sliders with name, value and ⓘ only. Advanced: everything, as before. Remembered in this browser |
| Surfaces and controls | Square panels, thin borders | Rounded glass panels, pill buttons, a clear blue focus ring, gentle hover and press feedback |
| Motion | — | A short fade-in of new content. All of it is off under `prefers-reduced-motion` |

## Accessibility

- Every new control is a native button with a visible label. The view switch and the three cards are labelled groups.
- The focus ring is blue, 2 px.
- Text contrast:
  - body text `#F4F6FF` on `#070B1A`: about 18 : 1;
  - secondary text `#BCC4E0`: about 11 : 1;
  - tertiary text `#98A1C4`: about 7.7 : 1 (WCAG formula).
- On touch screens the new controls are at least 36 px high.

## Tested

`tests/phase4/ui_design_smoke.py` covers:

- the landing promise and the three ways in, each running the real search;
- the original buttons still present;
- the grouped navigation order;
- Simple and Advanced views giving an identical analysis, and the choice persisting across a reload;
- the summary card matching the engine's numbers;
- five languages;
- 390 × 844, 820 × 1180, 1180 × 820 and 1440 × 900 without page overflow;
- reduced motion;
- no page error.

## Not done

- No physical-device or screen-reader session.
- No five-item menu that hides views: the protected baseline tests address all nine views directly.
- No new illustrations or imagery: no image source could be fetched.
