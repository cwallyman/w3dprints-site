@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)

echo Starting PC Potree Converter...
echo.
echo If PotreeConverter.exe is not on PATH, edit this file and set POTREE_CONVERTER.
echo Example:
echo set POTREE_CONVERTER=C:\Tools\PotreeConverter\PotreeConverter.exe
echo.

node server.js
pause
