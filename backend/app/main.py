import json
from fastapi import FastAPI, File, HTTPException, UploadFile, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from app import config
from app.database import mongo
from app.schemas.soil import CropInput, SoilInput
from app.services import analysis, ocr
from app.services.report_pdf import build_pdf
from ml.predict import ModelUnavailable, load_bundle
from ml.preprocessing import MODEL_DIR

app = FastAPI(title="SoilWise API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(ModelUnavailable)
async def _mu(_: Request, e): return JSONResponse(status_code=503, content={"detail": str(e)})


@app.exception_handler(mongo.DBUnavailable)
async def _db(_: Request, e): return JSONResponse(status_code=503, content={"detail": str(e)})


def _need_db():
    mongo.get_collection()


@app.get("/api/health")
def health():
    try: b = load_bundle(); model = {"loaded": True, "name": b["model_name"], "version": b["version"]}
    except ModelUnavailable as e: model = {"loaded": False, "reason": str(e)}
    return {"status": "ok", "model": model, "database": mongo.is_available(), "ocr_max_upload_mb": config.MAX_UPLOAD_MB}


@app.get("/api/model/metrics")
def model_metrics():
    p = MODEL_DIR / "metrics.json"
    if not p.exists(): raise HTTPException(503, "metrics.json not found. Run `python -m ml.train`.")
    return json.loads(p.read_text())


@app.post("/api/crop/recommend")
def crop_recommend(body: CropInput):
    return analysis.crop_recommend(body.model_dump())


@app.post("/api/soil/analyze", status_code=201)
def soil_analyze(body: SoilInput):
    d = body.model_dump()
    res = analysis.full_analysis(d)
    doc = {"location": d["location"], "farming_context": d["farming_context"],
           "soil_parameters": {k: d[k] for k in ("N", "P", "K", "ph", "temperature", "humidity", "rainfall")},
           "npk_unit": d["npk_unit"], "value_sources": d["value_sources"], "input_source": d["input_source"],
           "extracted_report_metadata": d["report_metadata"], **res,
           "model_version": (res.get("crop_recommendations") or {}).get("model_version")}
    if d["save"]:
        try: doc["analysis_id"] = mongo.save(dict(doc)); doc["saved"] = True
        except mongo.DBUnavailable as e: doc["saved"] = False; doc["save_error"] = str(e)
    else:
        doc["saved"] = False
    return json.loads(json.dumps(doc, default=str))


@app.post("/api/soil/upload-report")
async def upload_report(file: UploadFile = File(...)):
    data = await file.read(config.MAX_UPLOAD_MB * 1024 * 1024 + 1)
    if len(data) > config.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {config.MAX_UPLOAD_MB} MB limit.")
    if not data: raise HTTPException(400, "Empty file.")
    try: return ocr.process_report(file.filename or "", data)
    except ocr.UnreadableReport as e: raise HTTPException(422, str(e))
    except ValueError as e: raise HTTPException(415, str(e))


@app.get("/api/analyses")
def list_analyses(): _need_db(); return json.loads(json.dumps(mongo.list_all(), default=str))


@app.get("/api/analyses/{aid}")
def get_analysis(aid: str):
    _need_db(); d = mongo.get(aid)
    if not d: raise HTTPException(404, "Analysis not found.")
    return json.loads(json.dumps(d, default=str))


@app.delete("/api/analyses/{aid}", status_code=204)
def delete_analysis(aid: str):
    _need_db()
    if not mongo.delete(aid): raise HTTPException(404, "Analysis not found.")


@app.get("/api/analyses/{aid}/report")
def report(aid: str):
    _need_db(); d = mongo.get(aid)
    if not d: raise HTTPException(404, "Analysis not found.")
    return Response(build_pdf(d), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="soilwise-{aid}.pdf"'})


@app.get("/api/dashboard/statistics")
def dashboard():
    _need_db(); s = mongo.statistics()
    s["recent"] = [{"analysis_id": a["analysis_id"], "created_at": str(a["created_at"]), "location": a.get("location"),
                    "top_crop": (a.get("crop_recommendations") or {}).get("top_crops", [{}])[0].get("crop")}
                   for a in mongo.list_all(5)]
    return s
