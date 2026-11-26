import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

GREEN = colors.HexColor("#1f4d3a")


def build_pdf(a: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm)
    ss = getSampleStyleSheet()
    h = ParagraphStyle("h", parent=ss["Heading2"], textColor=GREEN)
    body = ss["BodyText"]
    S = []
    S.append(Paragraph("SoilWise - Soil Analysis Report", ParagraphStyle("t", parent=ss["Title"], textColor=GREEN)))
    S.append(Paragraph(f"Analysis ID: {a.get('analysis_id', 'unsaved')} &nbsp;|&nbsp; Date: {str(a.get('created_at', ''))[:19]} UTC &nbsp;|&nbsp; "
                       f"Location: {a.get('location') or 'not given'}", body))
    S.append(Paragraph("1. Soil parameters", h))
    rows = [["Parameter", "Value", "Status", "Interpretation"]]
    for k, p in a["soil_health"]["parameters"].items():
        interp = p.get("rating") or p.get("class") or "-"
        rows.append([k, "-" if p.get("value") is None else str(p["value"]), p["status"], interp])
    for k in ("temperature", "humidity", "rainfall"):
        v = a.get("soil_parameters", {}).get(k)
        rows.append([k, "-" if v is None else str(v), "missing" if v is None else "as entered", "-"])
    t = Table(rows, hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), GREEN), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                           ("GRID", (0, 0), (-1, -1), 0.4, colors.grey), ("FONTSIZE", (0, 0), (-1, -1), 9)]))
    S += [t, Paragraph("2. Soil-health screening", h)]
    for f in a["soil_health"]["findings"]: S.append(Paragraph("&bull; " + f, body))
    for d in a["soil_health"]["potential_deficiencies"]: S.append(Paragraph(f"<b>{d['nutrient']}</b>: {d['advice']}", body))
    S.append(Paragraph("3. Crop recommendations (ML)", h))
    rec = a.get("crop_recommendations")
    if rec:
        rows = [["Rank", "Crop", "Model score"]] + [[i + 1, c["crop"].title(), f"{c['probability']:.1%}"] for i, c in enumerate(rec["top_crops"])]
        t2 = Table(rows, hAlign="LEFT"); t2.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, colors.grey), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dfe8e1"))]))
        S += [t2, Spacer(1, 4), Paragraph(f"Model: {rec['model']} ({rec['model_version']}); held-out test accuracy {rec.get('model_test_accuracy')}.", body),
              Paragraph("Explanation: " + rec.get("explanation_text", ""), body)]
    else:
        S.append(Paragraph(a.get("crop_recommendation_skipped", "Not available."), body))
    S.append(Paragraph("4. Limitations", h))
    for l in ["Soil screening is threshold-based and is not a validated diagnosis.",
              "Model scores are not guarantees of crop success or yield.",
              "The training dataset is a public, balanced crop-recommendation dataset whose N/P/K units are undocumented.",
              "No fertiliser quantities are given. Consult a local agronomist / Krishi Vigyan Kendra."]:
        S.append(Paragraph("&bull; " + l, body))
    doc.build(S)
    return buf.getvalue()
