@echo off
:: Quick Start - Rawson Properties Tracker
:: Just double-click this file to start the system!

echo ========================================
echo   RAWSON PROPERTIES - AGENT TRACKER
echo ========================================
echo.
echo Starting server...
echo.
echo The browser will open automatically.
echo Login at: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

:: Open browser after 2 seconds
timeout /t 2 /nobreak >nul
start http://localhost:3000

:: Start the server
npm start
