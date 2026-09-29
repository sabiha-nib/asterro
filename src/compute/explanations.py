"""Deterministic explanation engine. Produces structured facts + template sentences.
Any optional language-model rewording must receive these facts read-only; it may not alter them."""
from .similarity import classify
from .variables import CRITERIA, MATCH_THRESHOLD, PARTIAL_THRESHOLD

LABEL = {c["id"]: c["label"] for c in CRITERIA}
UNIT = {c["id"]: c["unit"] for c in CRITERIA}


def explain_result(criterion_scores, contributions, target, location, earth_values=None):
    """criterion_scores / contributions: {criterion: float} for ONE cell."""
    crit = list(criterion_scores)
    by_sim = sorted(crit, key=lambda c: (-criterion_scores[c], c))
    by_contrib = sorted(crit, key=lambda c: (-contributions[c], c))
    classes = {c: classify(criterion_scores[c], MATCH_THRESHOLD, PARTIAL_THRESHOLD) for c in crit}
    facts = dict(
        strongest_matches=[c for c in by_sim if classes[c] == "MATCH"],
        partial=[c for c in by_sim if classes[c] == "PARTIAL"],
        mismatches=[c for c in reversed(by_sim) if classes[c] == "MISMATCH"],
        largest_contributors=by_contrib[:3],
        weakest=by_sim[-1],
        classes=classes,
    )
    s = []
    if facts["strongest_matches"]:
        s.append("Closest agreement with {} on {}.".format(
            target["name"], ", ".join(LABEL[c].lower() for c in facts["strongest_matches"])))
    if facts["mismatches"]:
        s.append("Largest departures: {}.".format(", ".join(LABEL[c].lower() for c in facts["mismatches"])))
    s.append("The three largest weighted contributions come from {}.".format(
        ", ".join(LABEL[c].lower() for c in facts["largest_contributors"])))
    facts["sentences"] = s
    facts["location"] = location
    return facts
