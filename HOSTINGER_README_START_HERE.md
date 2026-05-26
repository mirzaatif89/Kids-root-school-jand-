# 🚀 Hostinger پر School CRM Deploy کریں - آپ کے لیے تیار شدہ

**Domain:** kidsrootsjand.com  
**Prepared For:** Hostinger Hosting  

---

## 📂 آپ کے لیے تیار شدہ Deployment Files

اس پروجیکٹ میں یہ deployment guides موجود ہیں:

### 1. **HOSTINGER_DEPLOYMENT_URDU.md** ✅
   - مکمل اردو میں deployment guide
   - Step-by-step سب کچھ
   - Troubleshooting شامل

### 2. **HOSTINGER_QUICK_START.md** ⚡
   - تیز ترین طریقہ (5 steps)
   - اہم نکات
   - عام مسائل کا حل

### 3. **HOSTINGER_DEPLOYMENT_CHECKLIST.md** ✓
   - تفصیلی checklist
   - ہر مرحلہ میں کیا کریں
   - Verification steps

### 4. **.env.hostinger.example** 📝
   - Hostinger کے لیے تیار شدہ .env template
   - بس اپنی values ڈالیں

### 5. **deploy-hostinger.sh** 🔧
   - Bash script (SSH میں چلائیں)
   - خودکار deployment

### 6. **check-before-deploy.bat** ✔️
   - Windows میں upload سے پہلے check کریں

---

## ⚡ سب سے تیز طریقہ (30 منٹ میں Deploy کریں)

### 1️⃣ Hostinger پر Database بنائیں (2 منٹ)

```
cPanel میں:
1. Databases → MySQL Databases
2. Create Database:
   Name: school_system
   User: school_user
   Password: Strong_123! (کچھ محفوظ بنائیں)
3. Privileges: سب checkboxes click کریں
```

### 2️⃣ اپنے .env کو Update کریں (2 منٹ)

```bash
# اپنے project میں یہ کریں:
# .env فائل میں یہ بدلیں:

DB_HOST=localhost
DB_NAME=school_system
DB_USER=school_user
DB_PASSWORD=Strong_123!  # جو آپ نے cPanel میں بنایا
NODE_ENV=production
```

### 3️⃣ SFTP سے Upload کریں (10 منٹ)

```
FileZilla استعمال کریں:
Host: sftp://your_username@kidsrootsjand.com
Port: 22
Username: Hostinger username
Password: Hostinger password

تمام files upload کریں:
- backend/
- frontend/
- config/
- app.js
- package.json
- .env (یہ ضروری ہے!)
- permissions.json
- سب کچھ!
```

### 4️⃣ SSH میں Setup کریں (10 منٹ)

```bash
# PuTTY یا Terminal سے:

ssh your_username@kidsrootsjand.com
cd public_html

# Dependencies install کریں:
npm install --production

# PM2 سے start کریں:
npm install -g pm2
pm2 start app.js --name "school-crm"
pm2 startup
pm2 save

# Check:
pm2 status
```

### 5️⃣ Browser میں جائیں (1 منٹ)

```
https://kidsrootsjand.com
```

✨ **مبارک ہو! آپ کا app live ہے!**

---

## 🎯 اہم نکات

### ✅ کریں:
- [x] Strong password استعمال کریں
- [x] HTTPS enable کریں (Hostinger خود کر دے)
- [x] Regular backups لیں
- [x] .env file کو محفوظ رکھیں

### ❌ نہ کریں:
- [ ] .env file کو git میں push نہ کریں
- [ ] Default password رکھیں
- [ ] Database backups ignore نہ کریں
- [ ] node_modules upload نہ کریں

---

## 🔒 Security Important

```bash
# اپنے localhost سے Hostinger کی جانکاری لیں:

1. Old Database Export:
   mysqldump -u root -p school_system > backup.sql

2. Hostinger میں restore کریں:
   phpMyAdmin → Import → backup.sql

3. .env میں strong passwords:
   DB_PASSWORD=کچھ پیچیدہ بنائیں
   JWT_SECRET=بالکل نیا بنائیں
```

---

## 📊 Monitoring & Maintenance

```bash
# ہر دن یہ check کریں:

# App چل رہا ہے؟
pm2 status

# Logs میں errors نہیں؟
pm2 logs school-crm

# Server پر جگہ ہے؟
df -h

# Database ٹھیک ہے؟
# cPanel → phpMyAdmin → school_system
```

---

## 🐛 Common Issues

| مسئلہ | حل |
|------|-----|
| **Database Error** | .env میں DB credentials check کریں |
| **502 Gateway Error** | `pm2 restart school-crm` کریں |
| **npm install Error** | `npm cache clean --force` پھر دوبارہ کریں |
| **Domain not loading** | DNS A record verify کریں |
| **HTTPS not working** | cPanel میں AutoSSL enable کریں |

---

## 📞 اگر مسئلہ ہو تو:

```bash
# 1. Logs دیکھیں:
pm2 logs school-crm --lines 50

# 2. Manually run کریں (debugging):
node app.js

# 3. Hostinger support:
support@hostinger.com
```

---

## ✨ آپ کے لیے تیار شدہ چیزیں

```
✅ HOSTINGER_DEPLOYMENT_URDU.md - مکمل اردو گائیڈ
✅ HOSTINGER_QUICK_START.md - فوری شروعات
✅ HOSTINGER_DEPLOYMENT_CHECKLIST.md - Checklist
✅ .env.hostinger.example - تیار شدہ template
✅ deploy-hostinger.sh - خودکار deployment script
✅ check-before-deploy.bat - Pre-deployment checker
✅ یہ README.txt - سمری
```

---

## 🎯 آپ کی Site

```
URL: https://kidsrootsjand.com
Admin: /admin
Login: /login
Database: school_system (Hostinger cPanel میں)
```

---

## 📋 Final Checklist

- [ ] Hostinger account موجود ہے
- [ ] Domain pointing ہے
- [ ] MySQL database بنایا
- [ ] .env update کیا
- [ ] Files SFTP سے upload کیے
- [ ] npm install کیا
- [ ] pm2 سے start کیا
- [ ] Browser میں test کیا
- [ ] Login کے کے دیکھا
- [ ] Backups setup کیے

---

## 🎉 آپ تیار ہیں!

اب بس یہ follow کریں:

1. [HOSTINGER_QUICK_START.md](HOSTINGER_QUICK_START.md) پڑھیں - 5 منٹ
2. Steps follow کریں - 25 منٹ
3. Test کریں - 5 منٹ
4. Live! ✨

---

**سوالات؟ Hostinger support سے بات کریں یا logs دیکھیں!**

**Your School CRM is ready for Hostinger! 🚀**
