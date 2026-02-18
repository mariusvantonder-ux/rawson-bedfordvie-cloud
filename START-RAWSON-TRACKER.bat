@echo off
SETLOCAL EnableDelayedExpansion
COLOR 0E
MODE CON: COLS=80 LINES=30

:: Display banner
echo ===============================================================================
echo.
echo           RAWSON PROPERTIES - AGENT TRACKER CLOUD SYSTEM
echo                        Easy Windows Installer
echo.
echo ===============================================================================
echo.
timeout /t 2 /nobreak >nul

:: Check if Node.js is installed
echo [STEP 1/4] Checking for Node.js...
echo.
where node >nul 2>nul
if %errorlevel% neq 0 (
    COLOR 0C
    echo ERROR: Node.js is NOT installed!
    echo.
    echo Please install Node.js first:
    echo 1. Visit: https://nodejs.org
    echo 2. Download the LTS version ^(green button^)
    echo 3. Install it ^(click Next through everything^)
    echo 4. Restart your computer
    echo 5. Run this file again
    echo.
    pause
    exit /b 1
)

:: Get Node.js version
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo    FOUND: Node.js %NODE_VERSION%
echo    Status: OK
echo.
timeout /t 1 /nobreak >nul

:: Check if we're in the right directory
echo [STEP 2/4] Checking installation folder...
echo.
if not exist "package.json" (
    COLOR 0C
    echo ERROR: Wrong folder!
    echo.
    echo This file must be in the "rawson-cloud-app" folder.
    echo Please move this file to the extracted folder and try again.
    echo.
    pause
    exit /b 1
)
echo    Location: %CD%
echo    Status: OK
echo.
timeout /t 1 /nobreak >nul

:: Check if already installed
if exist "node_modules\" (
    echo [STEP 3/4] Dependencies already installed
    echo    Skipping installation...
    echo.
    goto :setup_check
)

:: Install dependencies
echo [STEP 3/4] Installing required components...
echo    This will take 2-5 minutes, please wait...
echo.
call npm install --quiet --no-progress
if %errorlevel% neq 0 (
    COLOR 0C
    echo.
    echo ERROR: Installation failed!
    echo Please check your internet connection and try again.
    echo.
    pause
    exit /b 1
)
echo    Status: Complete
echo.

:setup_check
:: Check if database exists
echo [STEP 4/4] Checking database setup...
echo.
if exist "database\rawson-tracker.db" (
    echo    Database found - System ready!
    echo    You can create additional users anytime.
    echo.
    goto :start_menu
)

:: Need to create database and users
COLOR 0B
echo    No database found - First time setup required
echo.
echo ===============================================================================
echo                         ACCOUNT CREATION
echo ===============================================================================
echo.
echo You need TWO accounts:
echo    1. OFFICE account ^(Admin^) - See all agents, manage system
echo    2. PERSONAL account ^(Agent^) - Your personal tracking
echo.
echo Let's create these now...
echo.
pause

:: Run setup
echo.
echo Running account creation wizard...
echo.
call npm run setup
if %errorlevel% neq 0 (
    COLOR 0C
    echo.
    echo Setup failed. Please try again.
    pause
    exit /b 1
)

:start_menu
COLOR 0A
cls
echo ===============================================================================
echo.
echo           RAWSON PROPERTIES - AGENT TRACKER CLOUD SYSTEM
echo                            Ready to Start!
echo.
echo ===============================================================================
echo.
echo What would you like to do?
echo.
echo    [1] START the server
echo    [2] Create additional agent accounts
echo    [3] View system information
echo    [4] Exit
echo.
set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" goto :start_server
if "%choice%"=="2" goto :create_user
if "%choice%"=="3" goto :system_info
if "%choice%"=="4" goto :exit
goto :start_menu

:start_server
cls
COLOR 0B
echo ===============================================================================
echo                         STARTING SERVER
echo ===============================================================================
echo.
echo The server is starting...
echo.
echo IMPORTANT INFORMATION:
echo    - Server URL: http://localhost:3000
echo    - Press Ctrl+C to stop the server
echo    - Keep this window open while using the system
echo.
echo Opening browser in 3 seconds...
echo.

:: Get local IP for mobile access
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
    set IP=!IP:~1!
    goto :ip_found
)
:ip_found

if defined IP (
    echo MOBILE ACCESS:
    echo    - Connect phone to same WiFi
    echo    - Open browser and go to: http://!IP!:3000
    echo.
)

echo ===============================================================================
echo.
timeout /t 3 /nobreak >nul

:: Open browser
start http://localhost:3000

:: Start server
echo Server starting... ^(Ctrl+C to stop^)
echo.
call npm start

goto :end

:create_user
cls
echo ===============================================================================
echo                      CREATE AGENT ACCOUNT
echo ===============================================================================
echo.
echo You need to be logged in as admin to create accounts.
echo.
echo STEPS:
echo    1. Start the server ^(Option 1 from main menu^)
echo    2. Login with your OFFICE admin account
echo    3. Go to "Manage Agents" section
echo    4. Click "Add Agent" button
echo    5. Fill in the new agent's details
echo.
pause
goto :start_menu

:system_info
cls
echo ===============================================================================
echo                         SYSTEM INFORMATION
echo ===============================================================================
echo.
echo Installation Directory:
echo    %CD%
echo.
echo Node.js Version:
echo    %NODE_VERSION%
echo.
echo Server Address:
echo    http://localhost:3000
echo.
if defined IP (
    echo Mobile Access ^(same WiFi^):
    echo    http://!IP!:3000
    echo.
)
echo Database Location:
echo    %CD%\database\rawson-tracker.db
echo.
echo Status:
if exist "database\rawson-tracker.db" (
    echo    Database: EXISTS
    echo    Ready: YES
) else (
    echo    Database: NOT CREATED
    echo    Ready: NO - Run setup first
)
echo.
echo ===============================================================================
echo.
pause
goto :start_menu

:exit
cls
echo.
echo Thank you for using Rawson Properties Agent Tracker!
echo.
timeout /t 2 /nobreak >nul
exit /b 0

:end
echo.
echo Server stopped.
pause
