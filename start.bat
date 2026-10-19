@echo off
title TINE AI Platform Launcher
cd /d "%~dp0"

echo ========================================================
echo               TINE AI POC PLATFORM
echo ========================================================
echo.

echo Starting Backend (FastAPI on http://127.0.0.1:8002)...
start "TINE AI Backend" cmd /k "cd /d "%~dp0backend" && .\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8002 --log-level info"

timeout /t 3 /nobreak >nul

echo Starting Frontend (Vite on http://localhost:3000)...
start "TINE AI Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ========================================================
echo Services are starting in separate windows:
echo - Frontend: http://localhost:3000
echo - Backend:  http://127.0.0.1:8002
echo - API Docs: http://127.0.0.1:8002/docs
echo ========================================================
echo.
pause
