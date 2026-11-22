@echo off
echo ========================================
echo   ExamPulse - First Time Setup
echo ========================================
echo.

echo [1/3] Installing server dependencies...
cd /d "%~dp0server"
npm install
if errorlevel 1 (echo ERROR: Server install failed & pause & exit /b 1)

echo.
echo [2/3] Setting up SQLite database...
npx prisma db push
if errorlevel 1 (echo ERROR: Database setup failed & pause & exit /b 1)
npx prisma generate

echo.
echo [3/3] Installing client dependencies...
cd /d "%~dp0client"
npm install
if errorlevel 1 (echo ERROR: Client install failed & pause & exit /b 1)

echo.
echo ========================================
echo   Setup Complete!
echo.
echo   IMPORTANT: Add your Gemini API key!
echo   Edit: server\.env
echo   Set:  GEMINI_API_KEY=your_key_here
echo.
echo   Get a free key at:
echo   https://aistudio.google.com/apikey
echo.
echo   Then run start-dev.bat to start!
echo ========================================
pause
