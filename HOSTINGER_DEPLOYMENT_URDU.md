# Hostinger پر School CRM Deploy کریں - مکمل گائیڈ

**Domain:** kidsrootsjand.com  
**Host:** Hostinger

---

## 📋 Hostinger پر Deploy کرنے کے لیے ضروری چیزیں

1. ✅ Hostinger Hosting Account (Node.js support کے ساتھ)
2. ✅ MySQL Database Access
3. ✅ SSH/SFTP Access
4. ✅ Domain کا DNS Setup
5. ✅ SSL Certificate (Hostinger دیتا ہے)

---

## 🔧 مرحلہ 1: Hostinger پر Database Setup کریں

### cPanel میں جائیں:
```
https://kidsrootsjand.com/cpanel
```

### MySQL Database بنائیں:
1. **Databases** → **MySQL Databases**
2. **New Database** بنائیں:
   - **Database Name:** `school_system`
   - **Username:** `school_user` (یا اپنی پسند سے)
   - **Password:** Strong password بنائیں (مثال: `P@ssw0rd2026!`)

3. **Privileges** میں یہ سب دیں:
   - ✅ SELECT
   - ✅ INSERT
   - ✅ UPDATE
   - ✅ DELETE
   - ✅ CREATE
   - ✅ ALTER
   - ✅ DROP
   - ✅ GRANT

---

## 🚀 مرحلہ 2: Project کو Prepare کریں

### 1️⃣ Production .env بنائیں:

```bash
# .env (Hostinger کے لیے)
DB_HOST=localhost
DB_NAME=school_system
DB_USER=school_user
DB_PASSWORD=P@ssw0rd2026!

PORT=3000
NODE_ENV=production
JWT_SECRET=your_secure_secret_key_here_change_this

ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=softwaredemo17@gmail.com
SMTP_PASS=melqyptsoeabtnlk
SMTP_FROM_EMAIL=softwaredemo17@gmail.com
SMTP_FROM_NAME=Kids Roots Jand

PENDING_FEE_REMINDER_ENABLED=true
PENDING_FEE_REMINDER_TIME=09:00
PENDING_FEE_REMINDER_TIMEZONE=Asia/Karachi
PENDING_FEE_REMINDER_RUN_ON_START=true

PRINCIPAL_USERNAME=principal@school.com
PRINCIPAL_PASSWORD=Principal123
```

### 2️⃣ Production کے لیے optimize کریں:

```bash
# package.json میں یہ check کریں
npm install --production  # صرف ضروری packages
```

---

## 📤 مرحلہ 3: Hosting پر Upload کریں

### SFTP سے Upload کریں:

```bash
# FileZilla یا Hostinger کا File Manager استعمال کریں
# یہ files/folders upload کریں:

public_html/
├── frontend/          (سب .html, .css, .js files)
├── backend/
│   ├── server.js
│   ├── api/          (تمام API routes)
│   └── ...
├── config/
├── scripts/
├── app.js
├── package.json
├── .env              (ضروری!)
└── permissions.json
```

### SSH سے Setup کریں:

```bash
# SSH میں لاگ ان کریں
ssh your_username@kidsrootsjand.com

# Project folder میں جائیں
cd public_html

# Dependencies install کریں
npm install --production

# Database setup چلائیں (اگر setup script ہے)
node scripts/init-db.js
```

---

## 🔌 مرحلہ 4: Node.js Application Start کریں

### Option 1: PM2 استعمال کریں (بہترین):

```bash
# PM2 install کریں (globally)
npm install -g pm2

# Application start کریں
pm2 start app.js --name "school-crm"

# Startup پر خودکار start کریں
pm2 startup
pm2 save

# Check کریں کہ چل رہا ہے
pm2 status
```

### Option 2: Hostinger کا Node.js Manager استعمال کریں:

**cPanel میں:**
1. **Node.js Manager** / **Setup Node App**
2. Details:
   - **Node Version:** 18+ (recommended)
   - **Application Root:** `/home/username/public_html`
   - **Application Startup File:** `app.js`
   - **Application URL:** `https://kidsrootsjand.com`

---

## 🌐 مرحلہ 5: Domain کو Point کریں

### Hostinger میں Domain Setup:

1. **Addon Domains** (اگر separate ہے):
   - Domain: `kidsrootsjand.com`
   - Directory: `public_html`

2. **Routing/Proxy Setup** (اگر ضروری ہو):
   - Node.js app کو port 3000 پر چلنے دیں
   - Hostinger خودکار طور پر route کر دے گا

---

## 🔐 مرحلہ 6: SSL Certificate Setup

**Hostinger خودکار طور پر Auto SSL دیتا ہے:**

1. cPanel میں AutoSSL check کریں
2. یا **Let's Encrypt** سے free SSL لیں
3. **Redirect HTTP to HTTPS** enable کریں

```bash
# .htaccess میں (public_html میں):
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>
```

---

## 📊 مرحلہ 7: Database سے Data Migrate کریں

### اپنے Local سے Hostinger تک:

```bash
# Local machine سے database export کریں:
mysqldump -u root -p school_system > school_system_backup.sql

# Hostinger پر import کریں:
# cPanel → phpMyAdmin میں جائیں
# school_system database select کریں
# Import → اپنی .sql file upload کریں
```

---

## ✅ Testing & Verification

### اپنا application check کریں:

```bash
# Test کریں
curl https://kidsrootsjand.com

# Logs دیکھیں
pm2 logs school-crm

# Server status
pm2 status
```

### Browser میں جائیں:
```
https://kidsrootsjand.com
https://kidsrootsjand.com/login
https://kidsrootsjand.com/admin
```

---

## 🐛 عام مسائل اور حل

### ❌ "Cannot find module" Error:
```bash
npm install --production
```

### ❌ Database Connection Error:
```bash
# .env check کریں
# DB_HOST, DB_USER, DB_PASSWORD verify کریں
# Hostinger cPanel میں MySQL user privileges check کریں
```

### ❌ Application timeout:
```bash
# Hostinger support سے Node.js version upgrade کریں
# یا ecosystem.config.js میں timeout بڑھائیں
```

### ❌ 502 Bad Gateway:
```bash
# Node.js app restart کریں
pm2 restart school-crm

# یا cPanel → Restart Application
```

---

## 🚨 پروڈکشن کے لیے اہم نکات

1. **Secrets محفوظ رکھیں:**
   - `.env` file کو git میں push نہ کریں
   - Strong password استعمال کریں

2. **Database Backups:**
   - روزانہ backup لیں
   - Hostinger کے backup feature استعمال کریں

3. **Monitoring:**
   ```bash
   # Application monitor کریں
   pm2 monit
   ```

4. **Performance:**
   - Redis cache setup کریں (optional)
   - CDN استعمال کریں static files کے لیے

---

## 📞 اگر کوئی مسئلہ ہو:

1. **Hostinger Support:** support@hostinger.com
2. **Check Logs:** `pm2 logs school-crm`
3. **SSH میں:** `tail -f /var/log/nodejs.log`

---

## ✨ خلاصہ

```bash
# تیز طریقہ:
1. Hostinger پر MySQL Database بنائیں
2. .env update کریں
3. SFTP سے files upload کریں
4. SSH میں npm install کریں
5. pm2 start app.js کریں
6. Domain point کریں
7. SSL enable کریں
```

**مبارک ہو! آپ کا School CRM kidsrootsjand.com پر live ہے! 🎉**
