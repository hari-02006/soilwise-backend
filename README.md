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
python -m ml.train            # trains 3 models, picks best, writes saved_models/ and metrics.json
python -m pytest -q           # 12 tests
uvicorn app.main:app --reload # http://localhost:8000/docs

# Frontend (new terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173
npm run build                 # type-check + production build
```
If Tesseract is not on PATH, set `pytesseract.pytesseract.tesseract_cmd` in `backend/app/services/ocr.py`.

## What works without MongoDB
Manual analysis, report upload/OCR, crop recommendation, SHAP, clustering, model page. History, dashboard statistics and PDF reports need MongoDB (the API returns 503 with a clear message otherwise).

## Docs
`PROJECT_LOG.md`, `docs/SYSTEM_ARCHITECTURE.md`, `docs/DATASET_DOCUMENTATION.md`, `docs/VIVA_GUIDE.md`.
