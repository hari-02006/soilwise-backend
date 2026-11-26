# PROJECT LOG

## Stage 1 - Setup, data, ML, backend, frontend (built in one session)
**Implemented:** folder structure; real dataset (2200 rows) downloaded; integrity checks; training of Decision Tree / Random Forest / XGBoost with stratified 80/20 split and 5-fold CV; K-Means; SHAP; soil screening; PDF/image OCR with confirmation flow; FastAPI endpoints; MongoDB layer; PDF report; React UI (Dashboard, New analysis, History + compare, Model and data).

**Key files:** `backend/ml/{preprocessing,train,evaluate,predict,explain}.py`, `backend/app/main.py`, `backend/app/services/{analysis,soil_health,ocr,report_pdf}.py`, `backend/app/database/mongo.py`, `frontend/src/**`.

**Results (measured, not assumed):**
| Model | CV accuracy | CV macro-F1 | Test accuracy |
|---|---|---|---|
| Decision Tree | 0.9852 | 0.9852 | 0.9795 |
| Random Forest (selected) | 0.9938 | 0.9937 | 0.9932 |
| XGBoost | 0.9920 | 0.9920 | 0.9864 |
Selection rule: highest CV macro-F1 on the training split. The original workflow evaluated each candidate on the same test partition.

**Testing performed:** 12 pytest tests pass (API validation, real-model prediction, PDF text extraction, real Tesseract OCR on a generated PNG, rejection of bad/oversized/blank files, save/list/get/report/delete/statistics against `mongomock`, 503 when DB absent). `tsc --noEmit` and `vite build` succeed. Live uvicorn + Vite proxy smoke test passed.

**Not tested / known limitations:**
- Live MongoDB Atlas was NOT tested (no network access to Atlas in the build environment). Persistence logic is tested with mongomock; test with your own URI.
- OCR tested on a clean synthetic image and a generated text PDF, not on real lab reports. Real reports vary in layout; regex patterns will need tuning.
- UI was type-checked and built but not visually inspected in a browser or tested on mobile.
- No authentication; delete is unrestricted. Add auth before multi-user deployment.
- SoilGrids, NASA POWER and FAOSTAT enrichment are NOT implemented (dataset has no coordinates; merging would be invalid without a location key).
- Notebooks not created (training lives in `ml/train.py`).
- The dataset is almost perfectly separable, so probabilities are often 100%/0%. Do not present this as field accuracy.

## Stage 2 - Rubric workflow

The current training script fits median imputation and scaling within validation folds and encodes training labels. It repeats five-fold stratified CV twice across three classifier families and a majority-class baseline. The selected family is tuned using three inner and three outer folds, then refit on the training partition. A training-fold ablation tests rainfall, humidity and K individually. K-Means and its PCA sample now use training rows.

The final model made 438 correct predictions on the 440-record test split. Accuracy and macro-F1 were 0.9955, with one-vs-rest macro AUC of 1.0000. The training script reuses the original benchmark split and makes one held-out probability call for the selected model. Metrics, fitted artifacts and figures in `latex.tex` reflect this run.

The backend passed 12 tests and skipped image OCR because Tesseract was unavailable on PATH. TypeScript and the Vite production build passed. A fresh local FastAPI/Vite smoke test returned the frontend, ROC metrics, rice ranking, SHAP contributions and a cluster result through the proxy. The GitHub repository is public. The project owner supplied the [Render frontend URL](https://soilwise-frontend.onrender.com).
