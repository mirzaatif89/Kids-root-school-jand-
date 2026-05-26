# Hostinger Deployment - Quick Summary (اردو اور English دونوں)

## 🎯 آپ کی معلومات | Your Details

```
Domain:    kidsrootsjand.com
Host:      Hostinger
Type:      Node.js + MySQL Application
Framework: Express.js
```

---

## ⚡ FASTEST DEPLOYMENT WAY (5 Steps)

### Step 1: Database Setup (Hostinger cPanel)
```bash
1. Login to cPanel
2. Databases → MySQL Databases
3. Create:
   - Name: school_system
   - User: school_user
   - Password: Strong_Pass_123!
4. Add User to Database with ALL privileges
```

### Step 2: Edit .env File
```bash
# Change only these in your .env:
DB_HOST=localhost
DB_NAME=school_system
DB_USER=school_user
DB_PASSWORD=Strong_Pass_123!
NODE_ENV=production
```

### Step 3: Upload Files (SFTP)
```bash
Using FileZilla:
- Connect to: sftp://your_username@kidsrootsjand.com
- Port: 22
- Upload everything to: public_html/
- Make sure .env file is included!
```

### Step 4: Install & Start (SSH)
```bash
# Connect via SSH
ssh your_username@kidsrootsjand.com
cd public_html

# Install dependencies
npm install --production

# Start with PM2
npm install -g pm2
pm2 start app.js --name "school-crm"
pm2 startup
pm2 save
```

### Step 5: Verify
```bash
# Test in browser:
https://kidsrootsjand.com
https://kidsrootsjand.com/login
```

---

## 📌 CRITICAL CHECKLIST

Before you upload:
- [ ] .env file updated with Hostinger credentials
- [ ] MySQL database created in cPanel
- [ ] SSH access tested
- [ ] Node.js version 18+ available

After upload:
- [ ] npm install --production runs successfully
- [ ] No errors in pm2 logs
- [ ] Database tables created
- [ ] HTTPS working
- [ ] Login page loads

---

## 🔧 COMMON ISSUES & FIXES

### Problem: "Database connection refused"
```bash
# Fix: Check .env file
nano .env
# Verify: DB_HOST, DB_USER, DB_PASSWORD match cPanel MySQL settings
# Restart: pm2 restart school-crm
```

### Problem: "Cannot find module 'express'"
```bash
# Fix:
npm install --production
# Wait for completion...
pm2 restart school-crm
```

### Problem: "502 Bad Gateway"
```bash
# Fix:
pm2 restart school-crm
# Check logs:
pm2 logs school-crm
```

### Problem: "Application won't start"
```bash
# Debug:
pm2 logs school-crm --lines 100
# Check for errors and fix them
```

---

## 🌐 DOMAIN CONFIGURATION

```
In Hostinger:
1. Login to cPanel
2. Addon Domains → Add kidsrootsjand.com
3. Point to: public_html
4. AutoSSL: Enable (for HTTPS)
5. Redirect HTTP to HTTPS: Yes
```

---

## 💾 DATABASE BACKUP & RESTORE

### Backup your database:
```bash
# From local or existing server:
mysqldump -u root -p school_system > school_system_backup.sql

# Import to Hostinger via cPanel → phpMyAdmin:
1. Login to cPanel
2. phpMyAdmin
3. Click on school_system database
4. Import tab
5. Choose school_system_backup.sql
6. Click Import
```

---

## 📊 MONITORING & MAINTENANCE

```bash
# Check if app is running:
pm2 status

# View real-time logs:
pm2 logs school-crm

# Monitor resources:
pm2 monit

# Restart application:
pm2 restart school-crm

# Stop application:
pm2 stop school-crm

# Start again:
pm2 start app.js --name "school-crm"
```

---

## 🔐 SECURITY REMINDERS

```
1. Change default admin password ✓
2. Use strong MySQL password ✓
3. Enable HTTPS/SSL ✓
4. Keep .env file secure ✓
5. Regular database backups ✓
6. Don't expose sensitive files ✓
```

---

## 📞 NEED HELP?

### Check these first:
```bash
# 1. PM2 logs
pm2 logs school-crm

# 2. Check if app crashed
pm2 status

# 3. SSH into server and check manually
ssh your_username@kidsrootsjand.com
cd public_html
node app.js  # Test run
```

### Contact Hostinger Support:
- Email: support@hostinger.com
- Live Chat: Available in Hostinger dashboard

---

## ✅ DEPLOYMENT SUCCESS SIGNS

When deployment is successful:
- ✅ `https://kidsrootsjand.com` loads
- ✅ Login page appears
- ✅ Admin can login
- ✅ No 502 errors
- ✅ `pm2 status` shows app running
- ✅ SSL certificate shows valid

---

## 🎉 You're Done!

Your School CRM is now live at:
```
https://kidsrootsjand.com
```

Access Admin:
```
URL: https://kidsrootsjand.com/admin
Username: admin (default)
Password: (check your .env)
```

---

## 📌 IMPORTANT FILES REFERENCE

- **Configuration:** `.env` (update with Hostinger credentials)
- **App Entry:** `app.js` (main server file)
- **Frontend:** `frontend/` (HTML, CSS, JS files)
- **Backend API:** `backend/api/` (all API routes)
- **Database Setup:** Check if migration/init script exists

---

**جی ہاں، آپ کا اسکول CRM اب Hostinger پر live ہے! 🎊**

**Yes, your School CRM is now live on Hostinger! 🎊**
