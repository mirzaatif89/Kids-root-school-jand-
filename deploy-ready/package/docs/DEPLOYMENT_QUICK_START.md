# ⚡ Quick Start Deployment Checklist

## For cPanel Hosting - Fast Track

Complete these steps in order. Estimated time: **30 minutes**

---

## 📋 Pre-Deployment (5 minutes)

- [ ] Ensure you have cPanel access with Node.js support (Node 16+)
- [ ] Create a MySQL database in cPanel
- [ ] Note down your database credentials:
  ```
  Host: localhost
  Name: _______________
  User: _______________
  Pass: _______________
  ```

---

## 🔧 Prepare Project (5 minutes)

1. **Copy environment file:**
   ```bash
   cp .production.env.example .env
   ```

2. **Edit `.env` with your values:**
   ```
   DB_HOST=localhost
   DB_NAME=your_db_name
   DB_USER=your_db_user
   DB_PASSWORD=your_db_pass
   JWT_SECRET=[generate-random-32-char-string]
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password
   ```

3. **Create deployment ZIP:**
   ```bash
   # Windows PowerShell:
   .\create-hosting-zip.ps1 -Output school-crm.zip
   
   # Linux/Mac:
   zip -r school-crm.zip . -x "node_modules/*" ".git/*" ".env" "*.log"
   ```

---

## 📤 Upload to cPanel (5 minutes)

1. **In cPanel → File Manager:**
   - [ ] Navigate to `/home/your_username/`
   - [ ] Create folder: `my_school_app`
   - [ ] Upload `school-crm.zip`
   - [ ] Right-click → Extract
   - [ ] Delete the ZIP file

2. **Verify extraction:**
   ```bash
   ls -la /home/your_username/my_school_app/
   ```

---

## ⚙️ Configure Node.js App (10 minutes)

1. **In cPanel → Setup Node.js App:**

   | Field | Value |
   |-------|-------|
   | Node version | `18.x` or latest |
   | App mode | `Production` |
   | App root | `/home/your_username/my_school_app` |
   | App URL | `your-domain.com` |
   | Startup file | `app.js` |

2. **Click "Create"**

3. **Add Environment Variables:**
   - DB_HOST=localhost
   - DB_NAME=your_db_name
   - DB_USER=your_db_user
   - DB_PASSWORD=your_db_pass
   - JWT_SECRET=your_secret_key
   - NODE_ENV=production
   - (and others from your .env)

4. **Click "Run NPM Install"** (wait 2-5 minutes)

5. **Click "Restart"**

---

## ✅ Verify Deployment (3 minutes)

Test these URLs in your browser:

1. **Health check:**
   ```
   https://your-domain.com/health
   ```
   Should return: `{"success": true, ...}`

2. **Frontend:**
   ```
   https://your-domain.com/
   ```
   Should show login page

3. **API test:**
   ```
   https://your-domain.com/api/students
   ```
   Should return JSON (may require auth token)

---

## 🔍 Troubleshooting Quick Fixes

### "502 Bad Gateway"
```bash
# Check if app is running
ps aux | grep node

# View logs
tail -50 ~/my_school_app/logs/app.log
```

### "Cannot find module"
```bash
cd ~/my_school_app
rm -rf node_modules
npm install
```

### Database Connection Failed
- [ ] Confirm DB credentials in .env match cPanel
- [ ] Test in cPanel → MySQL Databases → connection
- [ ] Ensure user has database privileges

### Emails Not Sending
- [ ] Verify SMTP credentials (use [Gmail App Password](https://myaccount.google.com/apppasswords))
- [ ] Check `logs/app.log` for errors
- [ ] Ensure port 587 is not blocked

---

## 📚 Detailed Documentation

For more comprehensive information:
- [Full cPanel Deployment Guide](CPANEL_DEPLOYMENT_COMPLETE.md)
- [Database Setup Guide](README_DATABASE_SETUP.md)
- [Server Integration Guide](SERVER_INTEGRATION.md)

---

## 🆘 Need Help?

1. **Check logs first:**
   ```bash
   tail -100 logs/app.log
   tail -100 logs/error.log
   ```

2. **Run validation:**
   ```bash
   npm run validate
   ```

3. **Review error messages** in browser console and cPanel logs

4. **Ensure:**
   - MySQL is running
   - Node.js app is not crashed
   - Credentials are correct
   - Domain points to cPanel account
   - SSL certificate is installed

---

## ✨ Post-Deployment

After successful deployment:

- [ ] Test login with admin credentials
- [ ] Create test student record
- [ ] Send test email to verify SMTP
- [ ] Check all main features work
- [ ] Monitor logs for any errors
- [ ] Set up automated backups in cPanel
- [ ] Enable SSL auto-renewal (AutoSSL)

---

**Status: Ready for Production ✅**

---
**Last Updated:** May 26, 2026
**Version:** 1.0
