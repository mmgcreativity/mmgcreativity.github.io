@echo off
REM MMG Creativity - Degisen dosyalari tek zip'e toplar. Cift tikla calistir.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0zip-degisiklikler.ps1"
echo.
pause
