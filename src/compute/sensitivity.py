"""Sensitivity analysis: mission profiles, what-if transforms, ranking stability, rank moves."""
import numpy as np
from .similarity import similarity, effective_scores
from .ranking import cell_ranks

# Editorial weightings (NOT empirically fitted). Every value is shown in the UI.
MISSION_PROFILES = {
    "general": dict(label="General analogue", rationale="Equal weight on every available criterion.",
                    weights=dict(aridity=1, annual_temperature_range=1, elevation=1, slope=1,
                                 surface_roughness=1, lst_diurnal_range=1)),
    "rover": dict(label="Rover mobility", rationale="Traversability is governed mainly by slope and "
                  "roughness at the ~1 km baseline; climate is secondary.",
                  weights=dict(aridity=1, annual_temperature_range=0.5, elevation=1, slope=3,
                               surface_roughness=3, lst_diurnal_range=0.5)),
    "eva": dict(label="EVA training", rationale="Crew exposure: dryness, thermal swings and walkable terrain.",
                weights=dict(aridity=2, annual_temperature_range=1.5, elevation=1, slope=1.5,
                             surface_roughness=1, lst_diurnal_range=2)),
    "thermal": dict(label="Thermal testing", rationale="Hardware thermal cycling: diurnal surface swing "
                    "and seasonal air-temperature range dominate.",
                    weights=dict(aridity=1, annual_temperature_range=2, elevation=1, slope=0.5,
                                 surface_roughness=0.5, lst_diurnal_range=3)),
    "habitat": dict(label="Habitat operations", rationale="Long-duration stays: thermal environment "
                    "plus low slope for construction.",
                    weights=dict(aridity=1.5, annual_temperature_range=2, elevation=1, slope=2,
                                 surface_roughness=1, lst_diurnal_range=2)),
    "instrument": dict(label="Science instrument testing", rationale="Dry surfaces and thin (high) "
                       "atmosphere columns matter most for instrument analogues.",
                       weights=dict(aridity=3, annual_temperature_range=1, elevation=1.5, slope=1,
                                    surface_roughness=1, lst_diurnal_range=1.5)),
}

WHAT_IF = {
    "thermal_x2": dict(label="What if thermal behaviour matters 2x more?",
                       op=lambda w: {**w, "lst_diurnal_range": 2 * w["lst_diurnal_range"]}),
    "terrain_dominates": dict(label="What if terrain dominates the search?",
                              op=lambda w: {c: (3 * v if c in ("elevation", "slope", "surface_roughness") else v)
                                            for c, v in w.items()}),
    "ignore_climate": dict(label="What if all climate variables are ignored?",
                           op=lambda w: {c: (0 if c in ("aridity", "annual_temperature_range") else v)
                                         for c, v in w.items()}),
}


def ranking_stability(stack, target, ranges, cell_ids, cell_index):
    out = {}
    for pid, p in MISSION_PROFILES.items():
        r = similarity(stack, target, p["weights"], ranges)
        out[pid] = int(cell_ranks(effective_scores(r), cell_ids)[cell_index])
    return out


def why_did_this_move(stack, target, ranges, cell_ids, cell_index, w_before, w_after):
    b = similarity(stack, target, w_before, ranges)
    a = similarity(stack, target, w_after, ranges)
    rb = cell_ranks(effective_scores(b), cell_ids)[cell_index]
    ra = cell_ranks(effective_scores(a), cell_ids)[cell_index]
    crit = sorted(set(b["active"]) | set(a["active"]))
    def k(res, c):
        return float(res["weighted_contribution"][c][cell_index]) if c in res["active"] else 0.0
    delta = {c: 100 * (k(a, c) - k(b, c)) for c in crit}
    return dict(rank_before=int(rb), rank_after=int(ra),
                score_before=float(b["final"][cell_index]), score_after=float(a["final"][cell_index]),
                contribution_delta_pts=delta,
                overall_delta_pts=100 * float(a["final"][cell_index] - b["final"][cell_index]))
