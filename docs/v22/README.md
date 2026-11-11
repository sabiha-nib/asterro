# ASTERRO V20.3: section-based workspace (UI only)

V20.3 is a presentation layer over V20.1 (`aaedb37`), made of these files:

- `ui_36_v22.js`
- `x22_app.css`
- five catalogues, `i18n_9w0`–`9w4`

V20.3 does not change any score, weight, threshold, profile, target, dataset, route, saved record, offline behaviour or
privacy behaviour. All ten views, every journey view and every V20 destination are still reachable.

## Navigation

- **Sidebar.** One persistent deep-navy sidebar (`#0B1D3A`, active `#102552`, selected `#1E3A8A`). It holds the logo,
  which always returns Home, the five sections, the open section's submenu, and Settings and About at the bottom.
  - Only the open section's submenu is shown. Each section lists its own views in its own order.
  - The ten existing view buttons (`nav.tabs`, same ids and text) live inside these submenus. There is no horizontal
    tab row any more.
- **Desktop.** The sidebar is 236 px and can be collapsed to a 76 px rail, with the submenu as a flyout.
- **Tablet.** A 76 px rail; the submenu opens beside it.
- **Phone.** A drawer opened from a compact "section" button in the header. It shows the five sections as one icon row
  and only the open section's submenu.
- **Old multi-section menu.** The V20 menu, which listed every section at once, is no longer opened anywhere.

## Five workspaces

| Section | Workspace | Content (all from live engine results or published records) |
|---|---|---|
| Discover | The globe | The 3D globe in the middle of the space the floating ranking leaves free; fingerprint panel; compact ranking. The globe now shows NASA Blue Marble in its natural colours. The similarity overlay and its legend are unchanged. |
| Analyze | Research workspace | Bar chart of the eight leading distinct candidates (select one to see it on the globe); the six dimensions for the target with their measurement status (DIRECT or PROXY) and current weights; every analysis tool. |
| Plan | Mission planning | A heat map of the leading candidates' engine scores under each of the seven profiles; the planning tools. |
| Evidence | Scientific evidence | A passport preview of the leading candidate; records saved in this browser; provenance (algorithm version and file checksums); the evidence tools. |
| Data and Trust | Data intelligence | The dataset inventory by state (stacked bar, real counts), NASA and other providers, the datasets behind the score, the scoring rules, and the data tools. |

Views without a geographic task (Research Lab, Scenarios, Data, Method) use the whole workspace without the globe.
Discover, Atlas, Local Impact, Compare and Trajectory keep the globe.

## Destinations

The Mars and Moon picker is now a map-led explorer:

- Each body's own shaded-relief basemap (MOLA for Mars, LOLA for the Moon), with every catalogued target pinned at its
  position.
- A compact list of the targets.
- A feature panel for the chosen target: its own relief thumbnail, region, position, analysis window, published
  context, readiness level and label, and the DIRECT or PROXY status of each dimension.
- The existing "Explore on the globe" and "Open in the Atlas" actions.

## Test changes (navigation only; no check removed)

- **View buttons.** They now sit in the open section's submenu. UI tests that pressed a view button now open its
  section first with a real click (on phones, through the menu button), using the helper `nav_tab` in each file.
- **Protected files.** Two of those files, `tests/ui_smoke.py` and `tests/phase2/ui_lab_smoke.py`, are protected by
  checksum. Their recorded hashes were updated in `tests/phase3/fixtures/protected_sha256.json`,
  `data/v17/baseline.json` and `data/v19/baseline.json`. The only change in both files is the navigation step.
- **Header, tab order and tab bounds checks.** These now check the open section's view buttons (header and Bengali
  checks in `ui_responsive_smoke`; tab order in `ui_design_smoke`; tab bounds in `ui_trajectory_smoke` and
  `ui_global_smoke`).
- **V20 and V20.1 suites.** `ui_v20_smoke` and `ui_v21_smoke` now test the sidebar, the dashboards and the new picker
  instead of the retired menu and rail.
