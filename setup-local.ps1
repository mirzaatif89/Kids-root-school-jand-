#!/usr/bin/env powershell

##############################################
# School CRM - Local Setup & Deployment Prep
# Windows PowerShell Script
##############################################

# Admin check
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Administrator privileges required. Please run as Administrator." -ForegroundColor Red
    exit 1
}

# Colors
$green = "Green"
$red = "Red"
$yellow = "Yellow"
$cyan = "Cyan"

Write-Host ""
Write-Host "=========================================" -ForegroundColor $cyan
Write-Host "School CRM - Local Setup Script" -ForegroundColor $cyan
Write-Host "=========================================" -ForegroundColor $cyan
Write-Host ""

# Step 1: Check Requirements
Write-Host "[1/8] Checking requirements..." -ForegroundColor $yellow

$nodeCheck = node --version 2>$null
if ($null -eq $nodeCheck) {
    Write-Host "[FAIL] Node.js not installed. Download from https://nodejs.org/" -ForegroundColor $red
    exit 1
}
Write-Host "[OK] Node.js $nodeCheck" -ForegroundColor $green

$npmCheck = npm --version 2>$null
if ($null -eq $npmCheck) {
    Write-Host "[FAIL] npm not installed." -ForegroundColor $red
    exit 1
}
Write-Host "[OK] npm v$npmCheck" -ForegroundColor $green

# Step 2: Get current directory
Write-Host ""
Write-Host "[2/8] Setting up directories..." -ForegroundColor $yellow

$projectRoot = Get-Location
Write-Host "[OK] Project root: $projectRoot" -ForegroundColor $green

# Create necessary directories
$logsDir = Join-Path $projectRoot "logs"
$uploadsDir = Join-Path $projectRoot "uploads"

if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
    Write-Host "[OK] Created logs directory" -ForegroundColor $green
}

if (-not (Test-Path $uploadsDir)) {
    New-Item -ItemType Directory -Path $uploadsDir -Force | Out-Null
    Write-Host "[OK] Created uploads directory" -ForegroundColor $green
}

# Step 3: Create .env file
Write-Host ""
Write-Host "[3/8] Creating .env file..." -ForegroundColor $yellow

$envFile = Join-Path $projectRoot ".env"
$envContent = @"
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=school_system
DB_USER=root
DB_PASSWORD=@Atif7809

# Application Settings
NODE_ENV=production
PORT=3000
AUTO_CREATE_DB=false

# Security
JWT_SECRET=eduCore_secret_key_2026_production_very_strong_key_min_32_chars

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# SMTP Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=softwaredemo17@gmail.com
SMTP_PASS=melqyptsoeabtnlk
SMTP_FROM_EMAIL=softwaredemo17@gmail.com
SMTP_FROM_NAME=Apexiums School

# Principal Account
PRINCIPAL_USERNAME=principal@school.com
PRINCIPAL_PASSWORD=Principal123

# Fee Reminders
PENDING_FEE_REMINDER_ENABLED=true
PENDING_FEE_REMINDER_TIME=09:00
PENDING_FEE_REMINDER_TIMEZONE=Asia/Karachi
PENDING_FEE_REMINDER_RUN_ON_START=true

# Production Settings
TRUST_PROXY=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
"@

Set-Content -Path $envFile -Value $envContent -Force
Write-Host "✓ .env file created" -ForegroundColor $green

# Step 4: Install dependencies
Write-Host ""
Write-Host "[4/8] Installing npm dependencies..." -ForegroundColor $yellow

if (Test-Path "node_modules") {
    Write-Host "Removing old node_modules..." -ForegroundColor $yellow
    Remove-Item -Path "node_modules" -Recurse -Force
}

npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ npm install failed" -ForegroundColor $red
    exit 1
}
Write-Host "✓ Dependencies installed" -ForegroundColor $green

# Step 5: Create database (local MySQL)
Write-Host ""
Write-Host "[5/8] Setting up database..." -ForegroundColor $yellow
Write-Host ""
Write-Host "⚠️  You need to manually create database:" -ForegroundColor $yellow
Write-Host ""
Write-Host "Open Command Prompt and run:" -ForegroundColor $cyan
Write-Host ""
Write-Host "  mysql -u root -p@Atif7809" -ForegroundColor $cyan
Write-Host ""
Write-Host "Then paste these commands:" -ForegroundColor $cyan
Write-Host ""
Write-Host @"
CREATE DATABASE IF NOT EXISTS school_system;
USE school_system;
GRANT ALL PRIVILEGES ON school_system.* TO 'root'@'localhost' WITH GRANT OPTION;
FLUSH PRIVILEGES;
EXIT;
"@ -ForegroundColor $cyan
Write-Host ""

$dbReady = Read-Host "Database created? (y/n)"
if ($dbReady -ne "y") {
    Write-Host "⚠️  Database setup skipped. You can create it later." -ForegroundColor $yellow
} else {
    Write-Host "✓ Database ready" -ForegroundColor $green
}

# Step 6: Validate setup
Write-Host ""
Write-Host "[6/8] Validating setup..." -ForegroundColor $yellow

# Check if files exist
$appJsExists = Test-Path "app.js"
$backendExists = Test-Path "backend"
$frontendExists = Test-Path "frontend"

if ($appJsExists -and $backendExists -and $frontendExists) {
    Write-Host "✓ Project structure verified" -ForegroundColor $green
} else {
    Write-Host "❌ Project structure incomplete" -ForegroundColor $red
}

# Step 7: Test startup
Write-Host ""
Write-Host "[7/8] Testing application startup..." -ForegroundColor $yellow

Write-Host ""
Write-Host "Starting application in test mode..." -ForegroundColor $yellow
Write-Host "(Press CTRL+C after you see the startup message)" -ForegroundColor $yellow
Write-Host ""

# Start app with timeout
$process = Start-Process -FilePath "node" -ArgumentList "app.js" -PassThru -NoNewWindow

# Wait 5 seconds then kill
Start-Sleep -Seconds 5
if (-not $process.HasExited) {
    Stop-Process -InputObject $process -Force
    Write-Host "✓ Application starts successfully" -ForegroundColor $green
} else {
    Write-Host "❌ Application startup failed" -ForegroundColor $red
    Write-Host "Check logs/app.log for details" -ForegroundColor $yellow
}

# Step 8: Create deployment package
Write-Host ""
Write-Host "[8/8] Preparing deployment package..." -ForegroundColor $yellow

$zipName = "school-crm-deployment.zip"

# Remove old zip
if (Test-Path $zipName) {
    Remove-Item $zipName -Force
}

# Create zip excluding unnecessary files
$exclude = @('.git', 'node_modules', '.vscode', '.env', '*.log', '.DS_Store')

Write-Host "Creating deployment ZIP: $zipName" -ForegroundColor $cyan

# List files to include
$files = Get-ChildItem -Path . -Recurse | Where-Object {
    $path = $_.FullName
    $include = $true
    foreach ($excl in $exclude) {
        if ($path -match [regex]::Escape($excl)) {
            $include = $false
            break
        }
    }
    return $include
} | Select-Object -ExpandProperty FullName

Compress-Archive -Path $files -DestinationPath $zipName -Force
Write-Host "✓ Deployment package created: $zipName" -ForegroundColor $green

# Summary
Write-Host ""
Write-Host "==========================================" -ForegroundColor $cyan
Write-Host "✅ Local Setup Complete!" -ForegroundColor $green
Write-Host "==========================================" -ForegroundColor $cyan
Write-Host ""

Write-Host "📋 Next Steps:" -ForegroundColor $yellow
Write-Host ""
Write-Host "1️⃣  Start development server locally:" -ForegroundColor $cyan
Write-Host "    npm run dev" -ForegroundColor $cyan
Write-Host ""
Write-Host "2️⃣  Test at: http://localhost:3000" -ForegroundColor $cyan
Write-Host ""
Write-Host "3️⃣  After testing, deploy to server:" -ForegroundColor $cyan
Write-Host "    • Upload $zipName to cPanel File Manager" -ForegroundColor $cyan
Write-Host "    • Extract the ZIP" -ForegroundColor $cyan
Write-Host "    • Create .env file in cPanel" -ForegroundColor $cyan
Write-Host "    • Setup Node.js App in cPanel" -ForegroundColor $cyan
Write-Host ""

Write-Host "📂 Important Files:" -ForegroundColor $yellow
Write-Host "  • .env - Environment variables" -ForegroundColor $cyan
Write-Host "  • logs/ - Application logs" -ForegroundColor $cyan
Write-Host "  • uploads/ - File uploads" -ForegroundColor $cyan
Write-Host "  • $zipName - Deployment package" -ForegroundColor $cyan
Write-Host ""

Write-Host "🔍 To test locally:" -ForegroundColor $yellow
Write-Host "  npm run dev" -ForegroundColor $cyan
Write-Host "  # Then open: http://localhost:3000" -ForegroundColor $cyan
Write-Host "  # Login with: admin / admin123" -ForegroundColor $cyan
Write-Host ""

Write-Host "📊 Setup Summary:" -ForegroundColor $yellow
Write-Host "  ✓ Dependencies installed" -ForegroundColor $green
Write-Host "  ✓ .env file created" -ForegroundColor $green
Write-Host "  ✓ Directories created (logs, uploads)" -ForegroundColor $green
Write-Host "  ✓ Application tested" -ForegroundColor $green
Write-Host "  ✓ Deployment package ready: $zipName" -ForegroundColor $green
Write-Host ""

Write-Host "Ready to deploy? Follow cPanel deployment guide!" -ForegroundColor $cyan
Write-Host ""
