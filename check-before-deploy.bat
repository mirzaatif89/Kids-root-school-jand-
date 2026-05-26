# @echo off
REM Hostinger School CRM Pre-Deployment Checker
REM Run this before uploading to Hostinger

echo ======================================
echo School CRM - Pre-Deployment Checklist
echo ======================================
echo.

REM Check if .env exists
if not exist ".env" (
    echo X ERROR: .env file not found in current directory
    pause
    exit /b 1
)
echo [OK] .env file found

REM Check if app.js exists
if not exist "app.js" (
    echo X ERROR: app.js file not found
    pause
    exit /b 1
)
echo [OK] app.js file found

REM Check if package.json exists
if not exist "package.json" (
    echo X ERROR: package.json file not found
    pause
    exit /b 1
)
echo [OK] package.json file found

REM Check if node_modules exists
if exist "node_modules" (
    echo [INFO] node_modules folder exists (size: will be removed before upload)
) else (
    echo [INFO] node_modules folder doesn't exist (will be created on server)
)

REM Check if backend folder exists
if not exist "backend" (
    echo X ERROR: backend folder not found
    pause
    exit /b 1
)
echo [OK] backend folder found

REM Check if frontend folder exists
if not exist "frontend" (
    echo X ERROR: frontend folder not found
    pause
    exit /b 1
)
echo [OK] frontend folder found

echo.
echo ======================================
echo PRE-DEPLOYMENT CHECKLIST:
echo ======================================
echo.
echo [*] Before uploading to Hostinger, verify:
echo.
echo 1. [ ] Database credentials in .env are ready
echo       - DB_NAME, DB_USER, DB_PASSWORD
echo.
echo 2. [ ] Hostinger MySQL database is created
echo       - Database name: school_system
echo       - User: school_user
echo.
echo 3. [ ] You have SFTP/SSH access to Hostinger
echo       - SFTP host, username, password
echo.
echo 4. [ ] Domain kidsrootsjand.com is pointing to server
echo       - Check DNS A record
echo.
echo 5. [ ] You have FileZilla or similar for SFTP upload
echo.
echo 6. [ ] You can access SSH/Terminal for deployment
echo.
echo ======================================
echo CHECKLIST FOR .env FILE:
echo ======================================
echo.
echo Required variables to check:
echo.
)
setlocal enabledelayedexpansion
for /f "tokens=*" %%A in (.env) do (
    set "line=%%A"
    if not "!line:~0,1!"=="REM" if not "!line!"=="" (
        echo [*] !line!
    )
)
echo.
echo ======================================
echo DEPLOYMENT STEPS:
echo ======================================
echo.
echo 1. SFTP Upload:
echo    - Upload all files to public_html/ on Hostinger
echo    - Include .env file
echo    - Don't upload node_modules (will be created on server)
echo.
echo 2. SSH Setup:
echo    - Connect via SSH
echo    - cd public_html
echo    - npm install --production
echo    - pm2 start app.js --name "school-crm"
echo    - pm2 save
echo.
echo 3. Verify:
echo    - Open https://kidsrootsjand.com
echo    - Check admin login works
echo    - Monitor: pm2 logs school-crm
echo.
echo ======================================
echo [OK] Pre-deployment checklist complete!
echo ======================================
echo.
pause
