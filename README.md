# SoilWise
AI-powered soil health screening and crop recommendation (India / Maharashtra focus).
React + TypeScript (Vite) -> FastAPI -> scikit-learn / XGBoost / SHAP, Tesseract OCR, MongoDB Atlas.

## Setup (Windows + VS Code)
Prerequisites: Python 3.11+, Node 18+, [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki) (add to PATH), optional MongoDB Atlas cluster.

```powershell
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env        # then put your MONGODB_URI in .env (optional for ML/OCR, required for history)
python -m ml.train            # runs the rubric workflow and regenerates saved_models/
python -m pytest -q
uvicorn app.main:app --reload # http://localhost:8000/docs

# Frontend (new terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173
npm run build                 # type-check + production build
```
If Tesseract is not on PATH, set `pytesseract.pytesseract.tesseract_cmd` in `backend/app/services/ocr.py`.

## Machine learning workflow

1. Audit the CSV and summarize training features, class balance and Pearson correlations.
2. Use a stratified 80/20 split with seed 42. The metrics include the CSV SHA-256 and split settings.
3. Encode the training labels and fit the median imputer and standard scaler inside each model pipeline.
4. Compare a majority-class baseline, Decision Tree, Random Forest and XGBoost using two repeats of five stratified folds. Select the trained model family by mean macro-F1.
5. Tune that family with a three-fold inner grid search and report scores on three outer validation folds. Refit the winner on all training rows.
6. Compare the tuned model with each of rainfall, humidity and K removed individually on the same five training folds.
7. Run the selected model on the held-out set once to produce accuracy, macro precision, recall and F1, a confusion matrix, and one-vs-rest ROC curves and AUC.
8. Save the fitted pipeline, training-only clustering artifacts and metrics. The Model Intelligence page charts the EDA and ROC and shows validation, tuning and ablation results.

The current evaluation uses the same deterministic partition as the original benchmark. Independent field data is needed to assess performance outside that benchmark. The saved model was trained with Python 3.13.2, scikit-learn 1.9.1, XGBoost 3.4.1, NumPy 2.5.5 and pandas 3.1.1. Restart FastAPI after retraining so it loads the new artifacts.

## Demo

[Hosted SoilWise demo on Render](https://soilwise-frontend.onrender.com).

Open [the local app](http://localhost:5173) after starting FastAPI and Vite. Use dataset-scale N=90, P=42, K=43, pH=6.5, temperature=20.9, humidity=82 and rainfall=203 to demonstrate crop ranking and SHAP. Open Model Intelligence to see the held-out evaluation.

[Public GitHub repository](https://github.com/hari-02006/soilwise-backend).

## What works without MongoDB
Manual analysis, report upload/OCR, crop recommendation, SHAP, clustering, model page. History, dashboard statistics and PDF reports need MongoDB (the API returns 503 with a clear message otherwise).

## Docs
`PROJECT_LOG.md`, `docs/SYSTEM_ARCHITECTURE.md`, `docs/DATASET_DOCUMENTATION.md`, `docs/VIVA_GUIDE.md`.
