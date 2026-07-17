# 🚀 cPanel Hosting Deployment Guide

Complete step-by-step guide for deploying the School CRM to cPanel hosting.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Prepare Your Project](#prepare-your-project)
3. [Deploy to cPanel](#deploy-to-cpanel)
4. [Configure Node.js App](#configure-nodejs-app)
5. [Database Setup](#database-setup)
6. [Verify Deployment](#verify-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

✅ Required:
- cPanel hosting account with Node.js support (Node 16+)
- MySQL database access via cPanel
- SSH access to your server
- Domain/Subdomain pointed to your cPanel account
- Git installed on your local machine (optional but recommended)

---

## Prepare Your Project

### Step 1: Create Production Environment File

1. In your project root, copy `.production.env.example` to `.env`:
```bash
cp .production.env.example .env
```

2. Edit `.env` and fill in your actual values:
```bash
# Database (from cPanel)
DB_HOST=localhost
DB_NAME=your_cpanel_database_name
DB_USER=your_cpanel_db_user
DB_PASSWORD=your_cpanel_db_password

# Security
JWT_SECRET=your_very_strong_secret_key_here_min_32_chars
ADMIN_PASSWORD=your_strong_password

# SMTP Email
SMTP_HOST=smtp.gmail.com
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_app_specific_password
```

**Important:** 
- Never commit `.env` to GitHub
- Use strong, random passwords (minimum 32 characters for JWT_SECRET)
- For Gmail: Use an [App Password](https://myaccount.google.com/apppasswords), not your regular password

### Step 2: Create Deployment ZIP

#### Option A: Without node_modules (Recommended for cPanel)

```bash
.\create-hosting-zip.ps1 -Output school-crm-deploy.zip
```

This creates a ~5-10 MB ZIP file. You'll run `npm install` on the server.

#### Option B: With node_modules (Larger but faster startup)

```bash
.\create-hosting-zip.ps1 -Output school-crm-deploy.zip -IncludeNodeModules
```

This creates a ~200-300 MB ZIP file. No npm install needed on server.

**Recommendation:** Use Option A for shared hosting (saves space and bandwidth).

---

## Deploy to cPanel

### Step 1: Create Application Folder

1. **Login to cPanel**
2. **Open File Manager**
3. **Navigate to** `/home/your_cpanel_username/`
4. **Create folder** named `my_school_app` (or your preferred name)

### Step 2: Upload and Extract ZIP

1. **In File Manager**, enter your `my_school_app` folder
2. **Click Upload** → Select your `school-crm-deploy.zip`
3. Wait for upload to complete
4. **Right-click** the ZIP file → **Extract**
5. Delete the ZIP file when done

**Result:** Your app structure should look like:
```
/home/your_cpanel_username/my_school_app/
├── app.js
├── package.json
├── .env
├── backend/
├── frontend/
├── config/
├── scripts/
└── ... (other files)
```

### Step 3: Verify Files

Via SSH, verify the structure:
```bash
cd /home/your_cpanel_username/my_school_app
ls -la
```

---

## Configure Node.js App in cPanel

### Step 1: Access Node.js App Manager

1. **In cPanel**, search for **"Setup Node.js App"**
2. Click **Setup Node.js App**

### Step 2: Configure Application

Fill in these settings:

| Setting | Value |
|---------|-------|
| **Node version** | `18.x` or highest available |
| **Application mode** | `Production` |
| **Application root** | `/home/your_cpanel_username/my_school_app` |
| **Application URL** | Your domain or subdomain |
| **Application startup file** | `app.js` |

### Step 3: Install Dependencies (if using Option A)

After creating the app:

1. Click **Run NPM Install** button in the Node app dashboard
2. Wait for installation to complete (2-5 minutes)
3. Click **Restart** to start your application

### Step 4: Set Environment Variables

In the Node.js App dashboard, scroll to **"Environment Variables"** and add:

```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=your_database_name
DB_USER=your_db_user
DB_PASSWORD=your_db_password
JWT_SECRET=your_strong_secret_key
NODE_ENV=production
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM_EMAIL=your_email@gmail.com
SMTP_FROM_NAME=Your School Name
PRINCIPAL_USERNAME=principal@school.com
PRINCIPAL_PASSWORD=your_principal_password
AUTO_CREATE_DB=false
PORT=3000
```

**Note:** cPanel will override the PORT based on the application URL you set.

---

## Database Setup

### Step 1: Create Database in cPanel

1. **In cPanel**, open **MySQL Databases**
2. **Create new database:**
   - Name: `cpanel_username_school_crm` (or your choice)
   - Click **Create Database**

3. **Create new MySQL user:**
   - Username: `cpanel_username_schooluser` (or your choice)
   - Password: (Generate strong password)
   - Click **Create User**

4. **Add user to database:**
   - Select user and database
   - Click **Add User to Database**
   - Grant **ALL PRIVILEGES**
   - Click **Make Changes**

### Step 2: Record Database Credentials

Save these for your `.env` file:
```
DB_HOST: localhost
DB_PORT: 3306
DB_NAME: cpanel_username_school_crm
DB_USER: cpanel_username_schooluser
DB_PASSWORD: [your password]
```

### Step 3: Import Initial Data (Optional)

If you have an existing database backup:

1. In **phpMyAdmin** (in cPanel), select your database
2. Click **Import**
3. Select your `.sql` backup file
4. Click **Import**

---

## Verify Deployment

### Test 1: Health Check Endpoint

Open in your browser:
```
https://your-domain.com/health
```

Expected response:
```json
{
  "success": true,
  "initialized": true,
  "timestamp": "2026-05-26T10:30:45.123Z"
}
```

### Test 2: Frontend Load

Open in your browser:
```
https://your-domain.com/
```

You should see the login page.

### Test 3: API Test

Open in your browser or use cURL:
```bash
curl https://your-domain.com/api/students
```

Should return JSON response (may require authentication).

### Test 4: Check Logs

Via SSH or cPanel File Manager, check logs:
```bash
tail -f logs/app.log
```

---

## Post-Deployment Configuration

### Email Configuration

The app uses Nodemailer for sending emails. For Gmail:

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Create an App Password:**
   - Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and "Windows Computer"
   - Copy the 16-character password
   - Use this in `SMTP_PASS` in your `.env`

### SSL/HTTPS (Important)

Your cPanel hosting should provide free SSL certificates (usually AutoSSL):

1. **In cPanel**, go to **Auto SSL**
2. Ensure your domains are listed
3. Run installation if needed

**Always access your app via HTTPS after this is set up.**

---

## Troubleshooting

### Issue: "502 Bad Gateway" or "Connection Refused"

**Possible causes:**
1. Node.js app not running - Check the app status in cPanel
2. Port conflict - Verify cPanel assigned correct port
3. Database connection failed - Check credentials in `.env`

**Solutions:**
```bash
# Via SSH - Check if app is running
ps aux | grep node

# Check error logs
cat logs/error.log
tail -100 logs/app.log

# Restart the app
cd /path/to/app
npm start
```

### Issue: "Cannot find module" or npm errors

**Solution:**
```bash
cd /home/your_cpanel_username/my_school_app
rm -rf node_modules package-lock.json
npm install
```

### Issue: Database connection fails

**Check:**
1. Database credentials in `.env` are correct
2. Database user has correct privileges
3. MySQL service is running in cPanel
4. No firewall blocking localhost access

**Test connection:**
```bash
mysql -h localhost -u your_db_user -p your_db_name
```

### Issue: Static files (CSS/JS) not loading

**Check:**
1. Frontend files exist in `frontend/` directory
2. App has read permissions on frontend files
3. Browser network tab to see 404 errors

### Issue: Emails not sending

**Check:**
1. SMTP credentials are correct (especially Gmail App Password)
2. SMTP port is correct (usually 587 for Gmail)
3. Check `logs/app.log` for email errors

**Test:**
```javascript
// In your app, test email sending
const { sendSmtpEmail } = require('./backend/api/_lib/mailer');
sendSmtpEmail({
    to: 'test@example.com',
    subject: 'Test Email',
    text: 'This is a test'
});
```

### Issue: Node.js version incompatibility

**Check available versions:**
In cPanel Node.js App Manager, the version dropdown shows available options.

**Upgrade (if needed):**
1. Select newer version
2. Click **Change Version**
3. Restart the app

---

## Useful Commands via SSH

```bash
# Navigate to app directory
cd /home/your_cpanel_username/my_school_app

# Check app status
ps aux | grep app.js

# View recent logs
tail -50 logs/app.log
tail -50 logs/error.log

# Test database connection
mysql -h localhost -u db_user -p -e "SELECT 1"

# Restart manually (usually done via cPanel)
npm restart

# Update dependencies (be careful on production)
npm update

# Test specific API endpoint
curl -X GET https://your-domain.com/api/students
```

---

## Best Practices

✅ **Do:**
- Use strong, unique passwords for all accounts
- Keep `.env` file secure and never commit to Git
- Regular database backups via cPanel
- Monitor error logs regularly
- Use HTTPS only (enable SSL)
- Update Node.js and dependencies regularly

❌ **Don't:**
- Hardcode credentials in source code
- Disable security headers
- Run in development mode on production
- Expose `.env` or sensitive files
- Skip database backups
- Use weak passwords

---

## Next Steps

After successful deployment:

1. ✅ Configure email notifications in app settings
2. ✅ Set up automated database backups
3. ✅ Monitor application performance and logs
4. ✅ Test all critical user workflows
5. ✅ Set up SSL certificate auto-renewal
6. ✅ Train administrators on system usage

---

## Support & Resources

- **cPanel Docs:** https://docs.cpanel.net/
- **Node.js Guide:** https://nodejs.org/docs/
- **MySQL Docs:** https://dev.mysql.com/doc/
- **Let's Encrypt (SSL):** https://letsencrypt.org/

---

**Last Updated:** May 26, 2026
**Version:** 1.0
