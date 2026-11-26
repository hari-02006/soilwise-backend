"""Rule-based soil screening. This is a SCREENING aid, not a validated diagnosis."""
from ml.preprocessing import FEATURES, load_data

# ICAR-style general ratings for lab-reported available nutrients (kg/ha). Used ONLY when unit == kg_per_ha.
ICAR = {"N": (280, 560), "P": (11, 25), "K": (110, 280)}
NAMES = {"N": "Nitrogen", "P": "Phosphorus", "K": "Potassium"}
_ref = None


def _terciles():
    global _ref
    if _ref is None:
        df = load_data()
        _ref = {n: (float(df[n].quantile(1 / 3)), float(df[n].quantile(2 / 3))) for n in "NPK"}
    return _ref


def _rate(v, lo, hi):
    return "low" if v < lo else ("medium" if v <= hi else "high")


def ph_class(ph):
    if ph < 5.5: return "strongly acidic"
    if ph < 6.5: return "moderately acidic"
    if ph <= 7.5: return "near neutral"
    if ph <= 8.5: return "alkaline"
    return "strongly alkaline"


PH_ADVICE = {
    "strongly acidic": "Acidity can limit P availability and increase Al/Mn toxicity. Liming (guided by a lab lime-requirement test) and organic matter are commonly used.",
    "moderately acidic": "Suitable for many crops; monitor trends and consider organic amendments.",
    "near neutral": "Generally favourable for nutrient availability for most crops.",
    "alkaline": "High pH can reduce availability of Fe, Zn and P. Organic matter, gypsum (for sodic soils) and sulphur-containing amendments are options after lab confirmation.",
    "strongly alkaline": "Likely nutrient-availability problems; test for salinity/sodicity (EC, ESP) and consult a local agronomist.",
}
NUTRIENT_ADVICE = {
    "N": "Legume rotation, compost/farmyard manure and split application of N sources can help build nitrogen.",
    "P": "Farmyard manure, compost and phosphate-solubilising biofertilisers can help; P fixation is strongest at very low or high pH.",
    "K": "Crop-residue return, compost and potassium sources guided by a local recommendation can help maintain potassium.",
}


def screen(d: dict) -> dict:
    unit = d.get("npk_unit", "dataset_scale")
    src = d.get("value_sources", {})
    params, findings, deficiencies = {}, [], []
    for n in "NPK":
        v = d.get(n)
        if v is None:
            params[n] = {"status": "missing", "value": None, "basis": None}
            continue
        if unit == "kg_per_ha":
            lo, hi = ICAR[n]; basis = "General ICAR-style rating for available nutrient (kg/ha). Region/crop specific norms may differ."
        else:
            lo, hi = _terciles()[n]; basis = "Position relative to the training dataset (terciles). NOT an agronomic rating."
        r = _rate(v, lo, hi)
        params[n] = {"status": src.get(n, "measured"), "value": v, "rating": r, "basis": basis}
        findings.append(f"{NAMES[n]}: {r} ({basis.split('.')[0]})")
        if r == "low":
            deficiencies.append({"nutrient": NAMES[n], "advice": NUTRIENT_ADVICE[n]})
    if d.get("ph") is None:
        params["ph"] = {"status": "missing", "value": None}
        ph_info = None
    else:
        c = ph_class(d["ph"])
        params["ph"] = {"status": src.get("ph", "measured"), "value": d["ph"], "class": c}
        ph_info = {"class": c, "advice": PH_ADVICE[c]}
        findings.append(f"pH {d['ph']}: {c}")
    missing = [k for k, v in params.items() if v["status"] == "missing"]
    return {
        "parameters": params, "ph_interpretation": ph_info, "findings": findings,
        "potential_deficiencies": deficiencies, "missing_parameters": missing,
        "general_improvements": [
            "Add organic matter (compost, FYM, green manure) to improve structure and microbial activity.",
            "Rotate crops, include legumes and avoid repeated heavy removal of the same nutrients.",
            "Confirm any finding with a laboratory soil test before changing fertiliser practice.",
            "Consult the local Krishi Vigyan Kendra / agriculture department for crop- and region-specific fertiliser doses.",
        ],
        "disclaimer": "Threshold-based screening only. It is not a scientifically validated soil-health diagnosis and gives no fertiliser quantities.",
    }
