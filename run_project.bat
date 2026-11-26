@echo off
title SoilWise Application Launcher
echo ========================================================
echo               Starting SoilWise Application              
echo ========================================================
echo.

set PYTHON_CMD=python
if exist "..\.venv\Scripts\python.exe" set PYTHON_CMD=..\.venv\Scripts\python.exe
if exist "backend\.venv\Scripts\python.exe" set PYTHON_CMD=backend\.venv\Scripts\python.exe
if exist ".venv\Scripts\python.exe" set PYTHON_CMD=.venv\Scripts\python.exe

echo [1/2] Starting FastAPI Backend on http://localhost:8000 ...
start "SoilWise Backend" cmd /k "cd backend && %PYTHON_CMD% -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

echo [2/2] Starting Vite Frontend on http://localhost:5173 ...
start "SoilWise Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo SoilWise is running!
echo - Frontend: http://localhost:5173
echo - Backend API & Docs: http://localhost:8000/docs
echo ========================================================
echo.
