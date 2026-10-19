@echo off
:: TINE AI Backend — kills any existing process on 8002, then starts fresh
cd /d "%~dp0"

echo Checking port 8002...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8002.*LISTENING" 2^>nul') do (
    echo Killing old process on port 8002 (PID %%a)...
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo.
echo  TINE AI Backend starting...
echo  Venv : %~dp0venv\Scripts\python.exe
echo  Port : 8002
echo.

"%~dp0venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8002 --log-level info
pause
