"""Soil-report text extraction: PyMuPDF (text PDFs) -> Tesseract OCR (scans/images) -> regex.
Output is only a SUGGESTION; the user must confirm every value."""
import io, re
import cv2, pymupdf as fitz, numpy as np, pytesseract
from PIL import Image

MAGIC = {"pdf": b"%PDF", "png": b"\x89PNG\r\n\x1a\n", "jpg": b"\xff\xd8\xff"}
ALLOWED_EXT = {".pdf": "pdf", ".png": "png", ".jpg": "jpg", ".jpeg": "jpg"}
NUM = r"(\d{1,4}(?:\.\d+)?)"
UNIT = r"\s*(kg\s*/\s*ha|kg/hectare|ppm|mg\s*/\s*kg)?"
PATTERNS = {
    "N": rf"(?:available\s+)?nitrogen(?:\s*\(?\s*N\s*\)?)?[^0-9\n]{{0,25}}{NUM}{UNIT}",
    "P": rf"(?:available\s+)?phosph(?:orus|orous)(?:\s*\(?\s*P\s*\)?)?[^0-9\n]{{0,25}}{NUM}{UNIT}",
    "K": rf"(?:available\s+)?potassium(?:\s*\(?\s*K\s*\)?)?[^0-9\n]{{0,25}}{NUM}{UNIT}",
    "ph": rf"\bp\s?H\b[^0-9\n]{{0,15}}{NUM}",
    "organic_carbon": rf"organic\s+carbon[^0-9\n]{{0,20}}{NUM}\s*(%)?",
    "ec": rf"\bE\.?C\.?\b(?:\s*\([^)]*\))?[^0-9\n]{{0,15}}{NUM}",
}
RANGE = {"N": (0, 300), "P": (0, 300), "K": (0, 400), "ph": (3, 10), "organic_carbon": (0, 15), "ec": (0, 20)}


class UnreadableReport(ValueError):
    pass


def detect_type(filename: str, data: bytes) -> str:
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    kind = ALLOWED_EXT.get(ext)
    if not kind:
        raise ValueError("Unsupported file type. Use PDF, JPG, JPEG or PNG.")
    if not data.startswith(MAGIC[kind]):  # content validation, not just extension
        raise ValueError("File content does not match its extension.")
    return kind


def _preprocess(img: np.ndarray) -> np.ndarray:
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    g = cv2.resize(g, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    g = cv2.fastNlMeansDenoising(g, h=15)
    return cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15)


def _ocr_image(pil: Image.Image) -> str:
    arr = cv2.cvtColor(np.array(pil.convert("RGB")), cv2.COLOR_RGB2BGR)
    return pytesseract.image_to_string(Image.fromarray(_preprocess(arr)), config="--psm 6")


def extract_text(kind: str, data: bytes):
    if kind == "pdf":
        doc = fitz.open(stream=data, filetype="pdf")
        text = "\n".join(p.get_text() for p in doc)
        if len(text.strip()) >= 30:
            return text, "pdf_text"
        text = "\n".join(_ocr_image(Image.open(io.BytesIO(p.get_pixmap(dpi=250).tobytes("png")))) for p in doc)
        return text, "pdf_ocr"
    return _ocr_image(Image.open(io.BytesIO(data))), "image_ocr"


def parse_values(text: str) -> dict:
    out = {}
    for key, pat in PATTERNS.items():
        m = re.search(pat, text, re.I)
        if not m:
            out[key] = {"value": None, "unit": None, "found": False}
            continue
        v = float(m.group(1))
        unit = re.sub(r"\s", "", m.group(2)).lower() if m.lastindex and m.lastindex >= 2 and m.group(2) else None
        lo, hi = RANGE[key]
        out[key] = {"value": v, "unit": unit, "found": True, "plausible": lo <= v <= hi,
                    "snippet": m.group(0).strip()[:80]}
    return out


def process_report(filename: str, data: bytes) -> dict:
    kind = detect_type(filename, data)
    try:
        text, method = extract_text(kind, data)
    except Exception as e:  # corrupt PDF/image, missing tesseract binary, etc.
        raise UnreadableReport(f"Could not read the document: {e}") from e
    if len(text.strip()) < 15:
        raise UnreadableReport("No readable text found. Try a clearer, higher-resolution scan or enter values manually.")
    values = parse_values(text)
    found = [k for k, v in values.items() if v["found"]]
    if not found:
        raise UnreadableReport("Text was read but no soil parameters were recognised. Enter values manually.")
    units = {v["unit"] for k, v in values.items() if k in "NPK" and v.get("unit")}
    return {"method": method, "extracted": values, "found_parameters": found,
            "detected_npk_unit": "kg_per_ha" if any(u and "kg" in u for u in units) else "unknown",
            "raw_text_preview": text.strip()[:600],
            "requires_confirmation": True,
            "warning": "OCR can misread digits. Review and correct every value before analysis. Uploaded file is NOT stored."}
