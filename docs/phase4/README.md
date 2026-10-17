# Phase IV — Planetary Atlas, registry and research workspace

Phase IV is additive. The baseline engine, the legacy targets, the legacy normalisation table and the
cross-planet experiment are unchanged and regression-tested bit for bit.

**What is new**

- **Planetary Atlas** (the Atlas tab):
  - hierarchy body → region → location → target;
  - alias search;
  - browse, regions, list and table views;
  - filters for readiness, mission, dataset, terrain category and record type;
  - breadcrumbs, favourites, recently viewed locations and active-target quick-switch;
  - a location panel showing the data, support, limitations, references and readiness checks;
  - actions that are disabled when the data cannot support them, each with its reason.
- **Readiness 1–4**, computed from 12 explicit checks.
- **A canonical registry** (`asterro.registry/1`) with schema validation and offline regeneration.
- **Explore** for the 14 additional readiness ≥ 3 targets.
- **Comparison Lab:**
  - compatibility matrix;
  - minimum, labelled mean, Pareto and per-criterion aggregates;
  - blocking when the selection does not support an aggregate;
  - the legacy cross-planet regression check.
- **Mismatch Explorer:** classes, contributions and scale differences.
- **Scenario Lab:** reproducible scenario sets.
- **Expedition objectives.**
- **Validation workspace:** researcher cases only; no shipped cases.
- **Readiness & Provenance centre**, with export.
- **Research collections.**
- **Offline service worker.**

| Document | Contents |
|---|---|
| [METHODS.md](METHODS.md) | Record types, schema, readiness model 3.0.0, offline regeneration, scoring configurations, Comparison Lab, validation, mismatch classes, Scenario Lab, expedition objectives, collections, offline |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Data flow, integrity chain, frontend modules, integration with the earlier layers |
| [DATA.md](DATA.md) | Catalogue by body and level, which targets can be scored, datasets, ingestion stages, pending data |
| [TEST_REPORT.md](TEST_REPORT.md) | Every suite run and its result |
| [LIMITATIONS.md](LIMITATIONS.md) | Scientific and software limitations |
| [CHANGES.md](CHANGES.md) | Files added and changed |

```bash
npm test                                         # Python + parity + Phase II/III/IV engine suites
npm run build:phase4                             # registry + atlas + index.html + sw.js from committed inputs
npm run test:ui                                  # the four browser walk-throughs (Playwright)
python -m scripts.reproduce_registry rec.json    # reproduce an Explore record for a registry target
python3 scripts/replay_scenario.py set.json      # replay a Scenario Lab set
npm start                                        # http://localhost:8080
```
