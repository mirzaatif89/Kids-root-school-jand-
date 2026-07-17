# XAMPP + Node.js Setup Guide for School Management System

## ⚠️ IMPORTANT: Node.js is Required

Your system does not have Node.js installed. You need to install it to run the backend server.

## 📥 Step 1: Install Node.js

1. **Download Node.js:**
   - Go to: https://nodejs.org/
   - Download the **LTS version** (recommended for most users)
   - Choose the Windows Installer (.msi) - 64-bit

2. **Install Node.js:**
   - Run the downloaded installer
   - Click "Next" through the installation
   - ✅ **IMPORTANT**: Make sure "Add to PATH" is checked
   - Complete the installation
   - **Restart your computer** (or at least close and reopen PowerShell)

3. **Verify Installation:**
   Open PowerShell and type:
   ```powershell
   node -v
   npm -v
   ```
   You should see version numbers (e.g., v20.x.x and 10.x.x)

## 🔧 Step 2: Start XAMPP MySQL

1. Open **XAMPP Control Panel**
2. Click **Start** next to **MySQL**
3. Wait until it shows "Running" (green background)
4. MySQL should be running on port **3306**

**Verify MySQL is Running:**
- The XAMPP Control Panel should show MySQL with a green background
- Port should show: 3306

## 🚀 Step 3: Connect to Server

After Node.js is installed and MySQL is running:

### Option A: Quick Start (Recommended)
1. Double-click `start-server.bat` in your project folder
2. It will automatically:
   - Install dependencies
   - Start the server
   - Connect to MySQL

### Option B: Manual Start
Open PowerShell in your project folder:

```powershell
# Install dependencies (first time only)
npm install

# Test database connection
node test-connection.js

# Start the server
node server.js
```

## ✅ Success Indicators

When everything is working, you'll see:

**In PowerShell:**
```
Real-Time SQL Server running on http://localhost:3000
```

**In Browser Console (F12):**
- No "SQL Initial Sync skipped" message
- OR "SQL Initial Sync successful"

## 🔍 Troubleshooting

### "node is not recognized"
- Node.js is not installed or not in PATH
- **Solution**: Install Node.js from https://nodejs.org/ and restart PowerShell

### "ECONNREFUSED" Error
- MySQL is not running
- **Solution**: Start MySQL in XAMPP Control Panel

### "ER_ACCESS_DENIED_ERROR"
- Wrong MySQL password
- **Solution**: 
  - Default XAMPP has no password (blank)
  - Your `.env` file should have: `DB_PASSWORD=`
  - If you set a password in XAMPP, update `.env`

### Port 3306 Already in Use
- Another MySQL instance is running
- **Solution**: 
  - Stop other MySQL services
  - Or change port in XAMPP config

## 📋 Current Configuration

Your `.env` file settings:
```
DB_HOST=localhost
DB_NAME=school_system
DB_USER=root
DB_PASSWORD=          ← (blank for default XAMPP)
DB_PORT=3306

PORT=3000
```

## 🎯 Next Steps After Installation

1. ✅ Install Node.js (if not done)
2. ✅ Start XAMPP MySQL
3. ✅ Run `npm install` in project folder
4. ✅ Run `node test-connection.js` to verify
5. ✅ Run `node server.js` to start backend
6. ✅ Open `index.html` in browser

---

**Need Help?** 
- Check if MySQL is running in XAMPP (green background)
- Verify Node.js is installed: `node -v`
- Check browser console (F12) for error messages
