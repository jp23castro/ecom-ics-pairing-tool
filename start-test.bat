@echo off
title ECOM ICS Pairing Tool v13
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
 echo Node.js is not installed or not in PATH.
 pause
 exit /b 1
)
if not exist node_modules (
 echo Installing required package...
 call npm install
 if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
 )
)
echo.
echo ECOM ICS Pairing Tool v13
echo Website: http://127.0.0.1:3034
echo.
start "" http://127.0.0.1:3034/
node server.js
pause
