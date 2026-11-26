# PROJECT LOG

## Stage 1 - Setup, data, ML, backend, frontend (built in one session)
**Implemented:** folder structure; real dataset (2200 rows) downloaded; integrity checks; training of Decision Tree / Random Forest / XGBoost with stratified 80/20 split and 5-fold CV; K-Means; SHAP; soil screening; PDF/image OCR with confirmation flow; FastAPI endpoints; MongoDB layer; PDF report; React UI (Dashboard, New analysis, History + compare, Model and data).

**Key files:** `backend/ml/{preprocessing,train,evaluate,predict,explain}.py`, `backend/app/main.py`, `backend/app/services/{analysis,soil_health,ocr,report_pdf}.py`, `backend/app/database/mongo.py`, `frontend/src/**`.

**Results (measured, not assumed):**
| Model | CV accuracy | CV macro-F1 | Test accuracy |
|---|---|---|---|
| Decision Tree | see metrics.json | 0.9852 | 0.9795 |
| Random Forest (selected) | see metrics.json | 0.9937 | 0.9932 |
| XGBoost | see metrics.json | 0.9920 | 0.9864 |
Selection rule: highest CV macro-F1 on the training split; test set used once for reporting.

**Testing performed:** 12 pytest tests pass (API validation, real-model prediction, PDF text extraction, real Tesseract OCR on a generated PNG, rejection of bad/oversized/blank files, save/list/get/report/delete/statistics against `mongomock`, 503 when DB absent). `tsc --noEmit` and `vite build` succeed. Live uvicorn + Vite proxy smoke test passed.

**Not tested / known limitations:**
- Live MongoDB Atlas was NOT tested (no network access to Atlas in the build environment). Persistence logic is tested with mongomock; test with your own URI.
- OCR tested on a clean synthetic image and a generated text PDF, not on real lab reports. Real reports vary in layout; regex patterns will need tuning.
- UI was type-checked and built but not visually inspected in a browser or tested on mobile.
- No authentication; delete is unrestricted. Add auth before multi-user deployment.
- SoilGrids, NASA POWER and FAOSTAT enrichment are NOT implemented (dataset has no coordinates; merging would be invalid without a location key).
- Notebooks not created (training lives in `ml/train.py`).
- The dataset is almost perfectly separable, so probabilities are often 100%/0%. Do not present this as field accuracy.
