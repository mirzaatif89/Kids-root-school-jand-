# Database Setup Guide - School Management System

## Prerequisites
1. **Node.js** must be installed on your system
2. **MySQL Server** (via XAMPP, WAMP, or standalone) must be running
3. **Port 3306** should be available for MySQL
4. **Port 3000** should be available for the backend server

## Step-by-Step Setup Instructions

### 1. Install Node.js Dependencies
Open PowerShell in the project directory and run:
```powershell
npm install
```

This will install:
- express (Web server framework)
- sequelize (ORM for MySQL)
- mysql2 (MySQL driver)
- socket.io (Real-time communication)
- cors (Cross-origin resource sharing)
- dotenv (Environment variables)

### 2. Configure Database Credentials
Check your `.env` file and update if needed:
```
DB_HOST=localhost
DB_NAME=school_system
DB_USER=root
DB_PASSWORD=
DB_PORT=3306

PORT=3000
API_SECRET_KEY=eduCore_secure_sync_2026_X92
```

**Important**: If your MySQL root user has a password, update `DB_PASSWORD=your_password_here`

### 3. Start MySQL Server
- **XAMPP**: Open XAMPP Control Panel → Start "MySQL"
- **WAMP**: Open WAMP → Start All Services
- **Standalone**: Ensure MySQL service is running

### 4. Start the Backend Server
In PowerShell, run:
```powershell
node server.js
```

You should see:
```
Real-Time SQL Server running on http://localhost:3000
```

### 5. Open the Application
Open `index.html` in your browser or use Live Server.

The console should show:
```
SQL Initial Sync skipped (server offline). Using LocalStorage fallback.
```
will change to successful sync once the server is running.

## Troubleshooting

### Error: "node is not recognized"
**Solution**: Node.js is not installed or not in PATH
- Download from: https://nodejs.org/
- Install and restart PowerShell

### Error: "Unable to connect to the database"
**Solutions**:
1. Verify MySQL is running (check XAMPP/WAMP)
2. Check DB_PASSWORD in `.env` matches your MySQL root password
3. Ensure port 3306 is not blocked by firewall

### Error: "Port 3000 already in use"
**Solution**: Another application is using port 3000
- Change `PORT=3001` in `.env`
- Update `API_BASE_URL` in `script.js` to `http://localhost:3001/api`

### Error: "npm is not recognized"
**Solution**: Node.js installation incomplete
- Reinstall Node.js from https://nodejs.org/
- Ensure "Add to PATH" is checked during installation

## Verifying Connection

### Test 1: Backend Health Check
Open browser and visit: `http://localhost:3000/api/students`
- Should return: `[]` (empty array) or existing student data

### Test 2: Real-Time Sync
1. Open the application in two browser tabs
2. Add a student in one tab
3. The other tab should update automatically

### Test 3: Database Persistence
1. Add a student
2. Close the browser
3. Restart the backend server
4. Reopen the application
5. Student data should still be there

## Database Structure

The system automatically creates these tables:
- **Students**: Student records with credentials
- **Teachers**: Teacher records with credentials

All tables are created automatically when you first run `node server.js`

## Development Mode

For auto-restart on file changes, install nodemon:
```powershell
npm install -g nodemon
```

Then run:
```powershell
npm run dev
```

## Production Deployment

For production, ensure:
1. Change `DB_PASSWORD` to a strong password
2. Update `API_SECRET_KEY` to a unique value
3. Set `NODE_ENV=production`
4. Use a process manager like PM2

---

**Need Help?** Check the browser console (F12) for detailed error messages.
