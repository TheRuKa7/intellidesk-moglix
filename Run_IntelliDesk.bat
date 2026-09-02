@echo off
setlocal
cd /d "%~dp0"

echo Stopping anything on port 3020...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3020" ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
)

if not exist ".next\BUILD_ID" (
  echo Building IntelliDesk...
  call npm run build
  if errorlevel 1 exit /b 1
) else (
  echo Using existing build ^(.next present^). Run npm run build to rebuild.
)

echo Starting IntelliDesk at http://localhost:3020
start "" cmd /c "npx next start -p 3020"
timeout /t 3 /nobreak >nul
start http://localhost:3020

echo.
echo IntelliDesk is running. Close the server window to stop.
pause
