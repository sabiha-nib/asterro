"""Earth Analogue Limitations framework (tai-v17-limits-1.0.0).

What an Earth field site cannot reproduce. Measured values come from retained ASTERRO data (Mars 2020 MEDA pressure).
Reference constants are transcribed from the NASA NSSDCA Planetary Fact Sheets
(https://nssdc.gsfc.nasa.gov/planetary/factsheet/) and the ISO standard atmosphere; they were not re-retrieved in this
environment (provider hosts unreachable) and are marked "reference". Qualitative statements carry no numbers.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VERSION = "tai-v17-limits-1.0.0"


def build():
    meda = json.load(open(os.path.join(ROOT, "data/raw/meda_pressure.json")))
    p = [x["median_Pa"] for x in meda]
    F = "NASA NSSDCA Planetary Fact Sheet (reference, transcribed)"
    items = [
        {"id": "gravity", "earth": {"value": 9.80, "unit": "m/s²", "kind": "reference", "source": F},
         "moon": {"value": 1.62, "unit": "m/s²", "kind": "reference", "source": F},
         "mars": {"value": 3.71, "unit": "m/s²", "kind": "reference", "source": F},
         "earth_site": "no", "workaround": "partial: parabolic flights, offloading rigs, suspension systems"},
        {"id": "atmosphere", "earth": {"value": 101.325, "unit": "kPa (standard sea-level atmosphere)", "kind": "reference", "source": "ISO 2533 standard atmosphere"},
         "moon": {"value": None, "unit": None, "kind": "qualitative", "source": "exosphere only: effectively a vacuum at the surface"},
         "mars": {"value": [round(min(p), 1), round(max(p), 1)], "unit": "Pa (sol medians, Jezero crater)", "kind": "measured",
                  "source": f"Mars 2020 MEDA pressure, {len(p)} sols between sol {meda[0]['sol']} and sol {meda[-1]['sol']} (data/raw/meda_pressure.json)"},
         "earth_site": "no", "workaround": "partial: thermal-vacuum and Mars-atmosphere chambers"},
        {"id": "composition", "earth": {"value": None, "kind": "qualitative", "source": "nitrogen-oxygen atmosphere"},
         "moon": {"value": None, "kind": "qualitative", "source": "no breathable or significant atmosphere"},
         "mars": {"value": 95, "unit": "% CO₂ (about)", "kind": "reference", "source": F},
         "earth_site": "no", "workaround": "partial: gas-controlled chambers"},
        {"id": "radiation", "earth": {"kind": "qualitative", "source": "global magnetic field and thick atmosphere shield the surface"},
         "moon": {"kind": "qualitative", "source": "no global magnetic field, no atmosphere: solar particles and galactic cosmic rays reach the surface"},
         "mars": {"kind": "qualitative", "source": "no global magnetic field, thin atmosphere: much higher surface dose than on Earth"},
         "earth_site": "no", "workaround": "partial: particle accelerator facilities for components; not for field sites"},
        {"id": "dust", "earth": {"kind": "qualitative", "source": "wind- and water-worked dust, rounded grains, moisture"},
         "moon": {"kind": "qualitative", "source": "angular, impact-produced dust charged by sunlight and solar wind (electrostatic behaviour)"},
         "mars": {"kind": "qualitative", "source": "fine global dust lifted by wind and dust storms in a thin atmosphere"},
         "earth_site": "partial", "workaround": "regolith simulants in laboratories; field dust differs in shape, charge and chemistry"},
        {"id": "regolith", "earth": {"kind": "qualitative", "source": "soils shaped by water, life and weathering"},
         "moon": {"kind": "qualitative", "source": "regolith formed by impacts and space weathering, no water or life"},
         "mars": {"kind": "qualitative", "source": "oxidised regolith; perchlorate salts reported by landers"},
         "earth_site": "partial", "workaround": "simulants; geological similarity is not equivalence"},
        {"id": "thermal", "earth": {"kind": "data", "source": "the Earth cell's MODIS LST (in ASTERRO)"},
         "moon": {"kind": "data", "source": "the target's Diviner values (in ASTERRO)"},
         "mars": {"kind": "data", "source": "the target's MEDA / REMS values (in ASTERRO)"},
         "earth_site": "partial", "workaround": "compare the measured values; vacuum changes how heat moves"},
        {"id": "day_length", "earth": {"value": 24, "unit": "h", "kind": "reference", "source": F},
         "moon": {"value": 29.5, "unit": "Earth days (synodic day)", "kind": "reference", "source": F},
         "mars": {"value": 24.66, "unit": "h (sol)", "kind": "reference", "source": F},
         "earth_site": "partial", "workaround": "polar sites give long day and night seasons, not the lunar cycle"},
        {"id": "biology", "earth": {"kind": "qualitative", "source": "every Earth site carries life and organic contamination"},
         "moon": {"kind": "qualitative", "source": "no known life"},
         "mars": {"kind": "qualitative", "source": "no known life; biosignature work must control Earth contamination"},
         "earth_site": "no", "workaround": "Earth biology tests methods; it is not evidence about other worlds"},
    ]
    return {"schema": "asterro.v17.limits/1", "version": VERSION, "items": items}


if __name__ == "__main__":
    print(json.dumps(build())[:400])
