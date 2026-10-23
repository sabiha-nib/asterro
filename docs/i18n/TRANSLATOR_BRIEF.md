# Brief: translating ASTERRO's research routes

ASTERRO is a scientific web app that finds places on Earth whose environment resembles places on Mars and the Moon
(deterministic similarity over six variables: aridity, annual temperature range ("seasons"), elevation, slope,
surface roughness, day–night land-surface temperature range). Audience: students, educators and scientists.

## Input

`build/i18n/chunks/part_XX.json` — an array of entries `{ "key", "text", "routes", "quote"?, "attr"? }`.

- `key` is the English source **with placeholders**. It is what you translate.
- `text` is one real rendering of it (placeholders filled in) — context only.
- `routes` tells you where it appears (atlas/…, lab/…, trajectory, compare, scenarios, discover, data, method,
  sheet = Trace/Report/Reproduce dialogs, report.md = Markdown report lines/cells).
- `quote: true` = text from a source record (dataset/target record). Translate it fully and faithfully; the app shows
  the English original beside it automatically.
- `attr` = it is a tooltip / aria-label / placeholder (keep it short and plain).

## Output

For each part file, write `build/i18n/out/<lang>/part_XX.json`: a JSON object `{ "<key exactly as given>": "<translation>" }`
containing every key of the part. Valid JSON (UTF-8, no comments, escape `"` and `\`).
Check each file with: `node scripts/i18n_check_routes.mjs <lang> build/i18n/out/<lang>/part_XX.json` — it must report
`problems: 0`. (It also reports `missing`, which counts the other parts; ignore that.)

## Placeholders — never break these

- `{0}`, `{1}` … = an inline element (a bold number, a link, a button, a code span). Keep every one, exactly once; you
  may move it where the grammar needs it.
- `{n0}`, `{n1}` … = a number (re-formatted for the locale automatically). Keep every one exactly once; keep the
  units and symbols around it (`{n0} km`, `{n0}%`, `#{n0}`, `×{n0}`, `−{n0}`).
- `{p0}`, `{p1}` … = a proper name or an interface term filled in at runtime (a place, a target, a dataset, a
  criterion label such as "Elevation", a profile label such as "Rover mobility"). Keep each exactly once. Look at
  `text` to see what it stands for; write the sentence so that the substituted word fits (it will appear in the
  target language for criteria/profiles, as-is for place and dataset names).
- No other `{…}` may appear in your translation.

## Never translate (keep exactly)

Dataset, product, instrument, mission and agency names and acronyms (NASA POWER, MERRA-2, MODIS, MYD11C3, GMTED2010,
MOLA, LOLA, Diviner, MEDA, REMS, HiRISE, LRO, MGS, PDS, USGS, IAU, GIBS, …); place and feature names (Jezero crater,
Gale, Shackleton, Altiplano, Taurus-Littrow, …); file names, ids, URLs, versions (tai-sim-1.0.0, explore-target-v1,
registry 1.0.0, SHA-256); criterion codes (SLOPE, ROUGH, THERM, ARID, ELEV, T-RANGE); status codes (DIRECT, PROXY,
N/A, MISSING); readiness codes (L1–L4); formulas and symbols (d = |e − t| / (max − min), s, w, k, Σ, Δ, σ, ×, ≥, →, ·);
units (km, m, K, °C, mm/day, Pa, h, sol, Ls). "Phase II / III / IV" → translate "Phase", keep the numeral.

## Style

- Follow `docs/i18n/glossary.json` for every term it lists; be consistent across all parts.
- Match the existing interface translations in `app/frontend/phase4/i18n_<NN>_<lang>.js` (same register and
  vocabulary; e.g. the same word for "target", "weight", "coverage", "similarity").
- Precise, neutral scientific register; never add claims, never soften or strengthen a limitation; a score is
  "not a probability"; nothing is "NASA-approved".
- Keep capitalization style: ALL-CAPS labels stay ALL-CAPS (where the script has case); short UI labels stay short.
- Bengali: natural modern standard Bengali for Bengali-medium students; "।" ends sentences; keep Latin digits that are
  literally in the key (placeholders are localized automatically); common technical loanwords in Bengali script
  are fine (ডেটা, মডেল, স্কোর), acronyms stay Latin.
- Spanish: neutral international Spanish, correct accents and ¿¡ punctuation, tuteo as in the existing catalogue.
- French: correct accents; espace fine insécable (U+202F) before ; ! ? and espace insécable (U+00A0) before : and %,
  as in the existing catalogue; « » for quotation marks.
- German: correct noun capitalization and compounds; Sie-form as in the existing catalogue; avoid over-long
  compounds in short labels (use a hyphen or a phrase).
- Single English words that are labels (e.g. "Rank", "All", "Resolution") must be translated too.
- If a key is only an identifier or a name that stays the same, return it unchanged.
