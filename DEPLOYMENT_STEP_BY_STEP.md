# 🚀 Happy-Day-Restore Branch - Hostinger Deploy Guide
## Step-by-Step آسان طریقہ

**Domain:** kidsrootsjand.com  
**Branch:** happy-day-restore ✅ (aap already is par ho)

---

## 📋 STEP 1: Apne Hostinger Account Ko Check Karo

### Kya aapke paas sey pehle se Hostinger account hai?

**Agar haan toh:**
- [ ] cPanel login karo
- [ ] Username note karo
- [ ] Password save karo
- [ ] SSH access enable hai ya nahi dekho

**Agar nahi toh:**
- https://www.hostinger.com par jaao
- Koi bhi plan le lo (basic plan chalega)
- Setup ho jane de

---

## 🛠️ STEP 2: Hostinger par MySQL Database Setup Karo

### cPanel mein:
1. **Login** -> cPanel (hostinger se mil jayega)
2. **"MySQL Databases"** par click karo
3. **"New Database"** button dabo:
   ```
   Database Name:  school_system
   ```
   Click Create ✓

4. **"MySQL Users"** section mein:
   ```
   Username:   school_user
   Password:   School@2026  (ya koi bhi strong password)
   ```
   Click "Create User" ✓

5. **"Add User to Database"** mein:
   - User: school_user
   - Database: school_system
   - Select ALL checkboxes ✓
   Click "Add" ✓

### Done! Ab aapka MySQL database tayyar hai.

---

## 📝 STEP 3: Apni Project Ka .env Update Karo

### Apne project folder mein `.env` file kholो:

**Current .env (localhost):**
```
DB_HOST=localhost
DB_NAME=school_system
DB_USER=root
DB_PASSWORD=@Atif7809
```

**Change karo isko (Hostinger ke liye):**
```
DB_HOST=localhost
DB_NAME=school_system
DB_USER=school_user
DB_PASSWORD=School@2026
```

### Baki sab same rakhο - sirf ye 4 lines change karo!

---

## 📤 STEP 4: GitHub par Push Karo (Optional but Recommended)

Agar aap chahte ho toh GitHub par push kar do taakay Hostinger par direct GitHub se pull kar sake:

```bash
# Terminal/PowerShell mein jaao apne project folder mein

# Check current status
git status

# Changes add karo
git add .

# Commit karo
git commit -m "Final version for Hostinger deployment"

# Push karo
git push origin happy-day-restore
```

---

## 📥 STEP 5: Hostinger par Files Upload Karo

### Option A: GitHub se Pull Karo (Recommended - Faster)

**Agar GitHub par push kar diya ho toh:**

```bash
# SSH mein login karo Hostinger par
# PuTTY ya Command Prompt se:

ssh your_username@kidsrootsjand.com

# Jaao public_html mein
cd public_html

# GitHub se pull karo
git clone https://github.com/your-username/your-repo.git .

# Ya agar pehle se git repo tha toh:
git pull origin happy-day-restore
```

### Option B: SFTP sے Upload Karo (Slower but Easy)

1. **FileZilla download karo:**
   - https://filezilla-project.org/

2. **FileZilla mein login karo:**
   ```
   Host:     sftp://your_username@kidsrootsjand.com
   Port:     22
   Username: your_username
   Password: your_password
   ```

3. **Apni saari files ko public_html folder mein drag-drop karo:**
   - backend/ folder
   - frontend/ folder
   - config/ folder
   - app.js
   - package.json
   - .env ⚠️ (IMPORTANT!)
   - permissions.json
   - ecosystem.config.js
   - Sab kuch!

---

## 🔧 STEP 6: SSH mein Dependencies Install Karo

### Terminal/PowerShell mein:

```bash
# SSH mein login karo
ssh your_username@kidsrootsjand.com

# Password daalo

# public_html mein jao
cd public_html

# Check karo files upload hue ya nahi
ls -la
# aapko app.js dikhna chahiye

# Agar node_modules folder hai toh delete karo (optional)
rm -rf node_modules

# Production dependencies install karo
npm install --production

# Wait... ye 2-3 minute lega
# Jab "added X packages" likha aaye toh done!
```

---

## 🚀 STEP 7: Application Start Karo PM2 Se

### Abhi bhi SSH mein ho, toh:

```bash
# Pehle PM2 install karo globally
npm install -g pm2

# Aapka app start karo PM2 se
pm2 start app.js --name "school-crm"

# Startup par automatic start ho
pm2 startup

# Settings save karo
pm2 save

# Check karo app chal raha hai
pm2 status

# Agar "online" likha hai toh SUCCESS! ✓
```

---

## 🌐 STEP 8: Browser mein Test Karo

### Aapke browser mein:

```
https://kidsrootsjand.com
```

### Kya dikhna chahiye:
- [ ] Page load ho (blank ya koi error?)
- [ ] CSS-styling apply ho
- [ ] Login page dikhe
- [ ] No error console mein

### Admin Login:
```
URL: https://kidsrootsjand.com/admin
Username: admin
Password: admin123
```

---

## ✅ STEP 9: Verification

### Ye sab check karo:

```bash
# SSH mein (abhi bhi connected ho):

# 1. App status check karo
pm2 status
# "online" likha ho

# 2. Logs dekhο (agar koi error ho)
pm2 logs school-crm --lines 20

# 3. Database connection test karo
# Browser mein jaao: https://kidsrootsjand.com/admin
# Login try karo

# 4. Agar admin login successful ho toh:
# Data dikhe students/classes mein
```

---

## 🔒 STEP 10: HTTPS/SSL Enable Karo

### Hostinger mein automatic hota hai:

1. **cPanel mein jaao**
2. **"AutoSSL"** search karo
3. **"Install"** button dabo
4. **Wait 5-10 minutes**
5. **aapka domain auto-HTTPS ho jayega**

OR

1. **cPanel -> "Let's Encrypt SSL"**
2. **Select domain: kidsrootsjand.com**
3. **"Issue"** button dabo
4. **Done!**

---

## 📊 STEP 11: Regular Monitoring

### Har din ye check karo:

```bash
# SSH login karo:
ssh your_username@kidsrootsjand.com

# App chal raha hai?
pm2 status

# Logs mein koi error?
pm2 logs school-crm --lines 10

# Agar app crash ho gaya:
pm2 restart school-crm
```

---

## 💾 STEP 12: Backup lelo

### Database backup (cPanel mein):

```
cPanel -> Backups -> Full Backups
Ya
phpMyAdmin -> school_system -> Export
```

### Code backup:

GitHub par pehle se push kar diya, toh backup hai!

---

## 🐛 Common Issues & Solutions

### Issue 1: "Database connection error"
```bash
# Fix:
# 1. SSH mein:
nano .env
# 2. Check karo:
DB_HOST=localhost  ✓
DB_USER=school_user  ✓
DB_PASSWORD=School@2026  ✓
# 3. Save: Ctrl+X, Y, Enter
# 4. Restart:
pm2 restart school-crm
```

### Issue 2: "Cannot find module 'express'"
```bash
npm install --production
# Wait...
pm2 restart school-crm
```

### Issue 3: "502 Bad Gateway"
```bash
pm2 restart school-crm
# Ya
pm2 stop school-crm
pm2 start app.js --name "school-crm"
```

### Issue 4: Page loading par blank screen
```bash
pm2 logs school-crm --lines 50
# Error dekho aur fix karo
```

---

## 🎯 Quick Reference

```
HOSTINGER LOGIN:
- cPanel: https://kidsrootsjand.com/cpanel
- SSH: ssh your_username@kidsrootsjand.com

DATABASE:
- Name: school_system
- User: school_user
- Host: localhost

DOMAIN:
- https://kidsrootsjand.com

ADMIN:
- URL: https://kidsrootsjand.com/admin
- Username: admin
- Password: admin123

PM2 COMMANDS:
- pm2 status              (app status)
- pm2 logs school-crm     (logs dekhο)
- pm2 restart school-crm  (restart)
- pm2 stop school-crm     (stop)
- pm2 start app.js        (start)
```

---

## ✨ SUMMARY - 12 STEPS MEIN DEPLOYMENT

```
1. Hostinger account ready? ✓
2. cPanel mein MySQL database banaya? ✓
3. .env file update kiya? ✓
4. GitHub par push kiya? (optional)
5. SFTP/Git se files upload? ✓
6. SSH mein npm install kiya? ✓
7. PM2 se app start kiya? ✓
8. Browser mein test kiya? ✓
9. Admin login successful? ✓
10. HTTPS enable kiya? ✓
11. Monitoring setup ki? ✓
12. Backup le liya? ✓
```

---

## 🎉 Agar Sab Theek Ho

```
Browser mein:
✅ https://kidsrootsjand.com load hota hai
✅ CSS styling apply ho
✅ Admin login kaam karta hai
✅ Students/Classes data dikhe
✅ No errors
✅ HTTPS (green lock)
```

**Toh aapka School CRM LIVE HAI! 🚀**

---

## 📞 HELP NEEDED?

```bash
# 1. Logs check karo:
pm2 logs school-crm

# 2. Status check karo:
pm2 status

# 3. Manual test karo:
node app.js

# 4. Database check karo:
cPanel -> phpMyAdmin -> school_system
```

---

**Koi specific step samajh nahi aaya ya error aa raha hai toh bolo!**
**Main yahaan hoon help karne ke liye! 💪**
