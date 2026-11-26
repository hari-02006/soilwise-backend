# System architecture
```
React (Vite, TS)  --/api (proxy)-->  FastAPI
                                       |-- ml/ (Random Forest, K-Means, SHAP; joblib artefacts)
                                       |-- services/ocr.py (PyMuPDF -> Tesseract -> regex)
                                       |-- database/mongo.py (MongoDB Atlas)
```
**Manual flow:** form -> `POST /api/soil/analyze` -> Pydantic validation -> `soil_health.screen` + `analysis.crop_recommend` (predict_proba top-3, SHAP, cluster) -> saved in MongoDB -> JSON -> `ResultView`.
**Report flow:** file -> `POST /api/soil/upload-report` (size, extension and magic-byte checks; processed in memory, never stored) -> extracted values returned -> user edits and ticks confirmation -> same as manual flow with `input_source="report"`.
**Design decisions:** no `controllers/` layer (routes are thin; avoids over-engineering); no fake output (503 when model/DB missing); unit field separates dataset-scale NPK from lab kg/ha.
**Collections:** `soil_analyses` (location, soil_parameters, input_source, extracted_report_metadata, soil_health, crop_recommendations, model_version, created_at). `Users` omitted because authentication is not implemented.
