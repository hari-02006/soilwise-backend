import io, shutil
import mongomock, pymupdf, pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw, ImageFont
from app.database import mongo
from app.main import app

TESSERACT_AVAILABLE = shutil.which("tesseract") is not None

c = TestClient(app)
GOOD = dict(N=90, P=42, K=43, ph=6.5, temperature=20.9, humidity=82, rainfall=203)


@pytest.fixture(autouse=True)
def fake_db():
    mongo.set_collection(mongomock.MongoClient().db.soil_analyses)
    yield
    mongo.set_collection(None)


def test_health_model_loaded():
    r = c.get("/api/health").json()
    assert r["model"]["loaded"] and r["model"]["name"] == "RandomForest"


def test_metrics_expose_one_held_out_evaluation_and_roc():
    response = c.get("/api/model/metrics")
    assert response.status_code == 200
    metrics = response.json()
    models = metrics["models"]
    chosen = metrics["selected_model"]
    assert [name for name, result in models.items() if "test" in result] == [chosen]
    assert len(models) >= 4 and "MajorityBaseline" in models
    held_out = models[chosen]["test"]
    assert sum(map(sum, held_out["confusion_matrix"])) == metrics["split"]["test_rows"]
    roc = held_out["roc"]
    assert set(roc["per_class"]) == set(held_out["labels"])
    assert roc["macro_auc"] == pytest.approx(
        sum(curve["auc"] for curve in roc["per_class"].values()) / len(held_out["labels"])
    )
    for curve in [roc["micro_average"], *roc["per_class"].values()]:
        assert len(curve["fpr"]) == len(curve["tpr"])
        assert (curve["fpr"][0], curve["tpr"][0]) == (0, 0)
        assert (curve["fpr"][-1], curve["tpr"][-1]) == (1, 1)


def test_real_model_predicts_rice_for_rice_profile():
    r = c.post("/api/crop/recommend", json=GOOD).json()
    assert r["top_crops"][0]["crop"] == "rice" and len(r["top_crops"]) == 3
    assert abs(sum(x["probability"] for x in r["top_crops"]) - 1) < 1.0
    assert r["explanations"][0]["contributions"]


@pytest.mark.parametrize("bad", [{"ph": 14}, {"N": -5}, {"humidity": 150}, {"rainfall": "abc"}])
def test_invalid_input_rejected(bad):
    assert c.post("/api/crop/recommend", json={**GOOD, **bad}).status_code == 422


def test_partial_input_screens_but_skips_ml():
    r = c.post("/api/soil/analyze", json={"ph": 5.0, "N": 20, "save": False}).json()
    assert r["crop_recommendations"] is None and "missing" in r["crop_recommendation_skipped"]
    assert r["soil_health"]["parameters"]["P"]["status"] == "missing"


def test_save_list_get_report_delete():
    r = c.post("/api/soil/analyze", json={**GOOD, "location": "Pune"})
    assert r.status_code == 201 and r.json()["saved"]
    aid = r.json()["analysis_id"]
    assert len(c.get("/api/analyses").json()) == 1
    assert c.get(f"/api/analyses/{aid}").json()["location"] == "Pune"
    pdf = c.get(f"/api/analyses/{aid}/report")
    assert pdf.headers["content-type"] == "application/pdf" and pdf.content[:4] == b"%PDF"
    s = c.get("/api/dashboard/statistics").json()
    assert s["total_analyses"] == 1 and s["top_recommended_crops"][0]["crop"] == "rice"
    assert c.delete(f"/api/analyses/{aid}").status_code == 204
    assert c.get(f"/api/analyses/{aid}").status_code == 404


def test_db_unconfigured_returns_503():
    mongo.set_collection(None)
    assert c.get("/api/analyses").status_code == 503


def _pdf(text):
    d = pymupdf.open(); d.new_page().insert_text((50, 100), text, fontsize=12); return d.tobytes()


def test_pdf_text_extraction():
    txt = "Soil Test Report\nAvailable Nitrogen (N): 280 kg/ha\nAvailable Phosphorus (P): 18 kg/ha\nAvailable Potassium (K): 150 kg/ha\npH: 7.2"
    r = c.post("/api/soil/upload-report", files={"file": ("r.pdf", _pdf(txt), "application/pdf")}).json()
    assert r["method"] == "pdf_text" and r["extracted"]["N"]["value"] == 280
    assert r["extracted"]["ph"]["value"] == 7.2 and r["detected_npk_unit"] == "kg_per_ha"
    assert r["requires_confirmation"] is True


@pytest.mark.skipif(not TESSERACT_AVAILABLE, reason="Tesseract OCR binary not found on system PATH")
def test_image_ocr_with_tesseract():
    img = Image.new("RGB", (900, 300), "white"); dr = ImageDraw.Draw(img)
    try: f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 30)
    except OSError: f = ImageFont.load_default()
    for i, l in enumerate(["Soil Report", "Nitrogen (N): 245 kg/ha", "Phosphorus (P): 14 kg/ha", "pH: 6.8"]):
        dr.text((30, 20 + i * 60), l, fill="black", font=f)
    b = io.BytesIO(); img.save(b, "PNG")
    r = c.post("/api/soil/upload-report", files={"file": ("scan.png", b.getvalue(), "image/png")}).json()
    assert r["method"] == "image_ocr" and r["extracted"]["N"]["value"] == 245 and r["extracted"]["ph"]["value"] == 6.8


def test_upload_rejections():
    assert c.post("/api/soil/upload-report", files={"file": ("x.txt", b"hello", "text/plain")}).status_code == 415
    assert c.post("/api/soil/upload-report", files={"file": ("x.pdf", b"not a pdf", "application/pdf")}).status_code == 415
    big = b"%PDF" + b"0" * (5 * 1024 * 1024 + 10)
    assert c.post("/api/soil/upload-report", files={"file": ("big.pdf", big, "application/pdf")}).status_code == 413
    blank = Image.new("RGB", (300, 100), "white"); b = io.BytesIO(); blank.save(b, "PNG")
    assert c.post("/api/soil/upload-report", files={"file": ("blank.png", b.getvalue(), "image/png")}).status_code == 422
