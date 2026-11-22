@echo off
echo ========================================
echo   ExamPulse - Starting Development
echo ========================================
echo.
echo [1/2] Starting Backend Server...
start "ExamPulse Server" cmd /k "cd /d %~dp0server && npm run dev"
timeout /t 3 /nobreak >nul
echo.
echo [2/2] Starting Frontend Client...
start "ExamPulse Client" cmd /k "cd /d %~dp0client && npm run dev"
echo.
echo ========================================
echo   ExamPulse is starting up!
echo   Teacher Portal: http://localhost:5173
echo   Student Join:   http://localhost:5173/join
echo   Server API:     http://localhost:3001
echo ========================================
echo.
pause
