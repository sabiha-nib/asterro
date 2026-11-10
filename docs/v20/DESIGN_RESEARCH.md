# ASTERRO V20: design research

Both sites were visited on 11 November 2026 in a real browser (the Claude desktop browser), at the pane's own size
(about 800 × 810 CSS px). The computed styles below were read from the live pages with JavaScript, not guessed.
Nothing was copied: no asset, image, icon, text, layout or code from either site is in ASTERRO.

## 1. deepmind.google

| Aspect | What was observed |
|---|---|
| First viewport | No conventional top navigation. A small round menu button and the wordmark sit top-left; the rest is a full-bleed atmospheric image with one centred headline (34 px, weight 500, slight negative tracking) and two pill buttons, one solid dark and one translucent. |
| Navigation | The menu opens a full-height panel with four groups (Models, Research, Science, About), each an expandable row, then two direct links. Group names are short nouns. |
| Palette | Body white `#FFFFFF`, surface `#F8F9FC`, ink `#121317`, secondary ink `#45474D`. Colour comes from imagery, not from the UI chrome. |
| Glass | Used sparingly: `rgba(255,255,255,0.18)` on the secondary hero button and on buttons that float over imagery. |
| Typography | One family (Google Sans Flex) plus an icon font. Section headings are small (18 px, weight 500); the scale is restrained and the imagery carries hierarchy. |
| Shape | Radii 4 px for small parts, 8–16 px for cards, 9999 px for pills. No drop shadows on cards. |
| Content | Large media cards with two actions each ("Learn more", "Try"), a dated news list with a category and a single text link. Article pages: centred title, date and category line, authors, one primary pill. |
| Motion | No `prefers-reduced-motion` rule was found in the readable stylesheets (cross-origin sheets could not be inspected). |

## 2. ai.google.dev

| Aspect | What was observed |
|---|---|
| First viewport | A slim utility bar (menu, wordmark, search, theme toggle, language selector, sign-in), a one-line announcement banner, then a near-black navy hero (`#11131C`, `#161823`, `#1B212D`) with a large left-aligned headline (56 px, weight 400) on two lines, one sentence of support, and one blue pill call to action. |
| Hero visual | A real product interface, not an illustration. |
| Sections | Headings 36 px / 26 px, weight 400. Feature groups are text-led, with one card per idea. |
| Palette | White text on navy-black in the hero; `#202124` ink, `#5F6368` secondary, `#1A73E8` action blue on light sections. |
| Utilities | Theme and language are first-class controls in the header. |
| Shape | Radii 24–32 px on large panels, pills for actions, 4–8 px on small parts. |

## 3. What ASTERRO adopts

- **An immersive first viewport with the navigation folded into a single menu control** (from deepmind.google). The
  ASTERRO globe already is the hero, so the first screen shows the globe, the wordmark, a two-word title and two
  actions. The full navigation opens from a menu button and stays one tap away.
- **Grouped navigation with short group nouns.** ASTERRO uses five groups (Discover, Analyze, Plan, Evidence, Data
  and Trust) in an accessible panel, each listing its destinations with a one-line description.
- **The real product as the hero visual** (from ai.google.dev): the live globe with real markers, never a stock or
  generated image.
- **Theme and language as visible utilities**, gathered in ASTERRO's Settings.
- **Restraint:** one sans family for interface text, few type sizes, colour reserved for meaning and for the active
  state, no shadows.

## 4. What ASTERRO adapts

- **Palette:** both sites are either white or neutral near-black. ASTERRO uses the deep navy family given in the
  brief (`#0B1D3A`, `#102552`, `#1E3A8A`), refined blue `#3B82D8` for active states, pale blue `#DBEAFE` for
  selected surfaces and near-white `#F8FAFC` for reading surfaces, so long scientific tables stay readable.
- **Glass:** deepmind.google uses translucency only over imagery. ASTERRO uses it the same way and only there: the
  floating menu and settings controls over the globe, globe controls, layer controls and overlay dialogs. Reading
  panels are opaque.
- **Typography:** the brief fixes Helvetica (with Helvetica Neue and Arial as metric-compatible fallbacks) and
  Playfair Display for the highlighted hero word only.
- **Radii:** 4–8 px for controls and panels and pills only for the small segmented choices. The very soft 24–32 px
  panels of ai.google.dev are not used.

## 5. What ASTERRO does not copy

- No Google wordmark, product names, imagery, icon fonts (Google Symbols, Material Icons), illustrations or copy.
- No sparkle icon (deepmind.google's "Try Gemini" row) and no animated or decorative arrows.
- No announcement banner, sign-in or marketing pricing.
- No dark-on-white marketing card grids or carousels of media cards. ASTERRO is an instrument; its content is
  computed results with provenance.
- No near-black neutral theme: ASTERRO's foundation is navy, as the brief requires.

## 6. Accessibility notes taken forward

- Both sites keep the menu button keyboard-reachable; ASTERRO's menu is a dialog with a focus trap, Escape to close,
  and focus returned to the opener.
- Neither site was relied on for reduced-motion behaviour. ASTERRO's own rule: every transition is disabled under
  `prefers-reduced-motion: reduce` and under the in-app "Reduce motion" setting, and no feature depends on hover.
