# 📋 DEPLOYMENT QUICK REFERENCE CARD

## 🎯 MISSION: Deploy happy-day-restore branch to kidsrootsjand.com

---

## CHECKLIST

### BEFORE DEPLOYMENT

- [ ] Hostinger account ready with login info
- [ ] .env file updated (DB_USER, DB_PASSWORD)
- [ ] happy-day-restore branch confirmed
- [ ] GitHub push completed (optional but safe)

---

### STEP 1: DATABASE SETUP (cPanel)

```
Time: 5 minutes
Location: https://your-domain.com/cpanel

[ ] Click "MySQL Databases"
[ ] Create Database: school_system
[ ] Create User: school_user / School@2026
[ ] Add User to Database with ALL privileges
```

**Save karo:**
- Database: school_system
- User: school_user
- Password: School@2026

---

### STEP 2: UPDATE .env FILE

```
Time: 2 minutes
File: .env in your project

Change only these 4 lines:
```

```env
DB_HOST=localhost
DB_NAME=school_system
DB_USER=school_user
DB_PASSWORD=School@2026
```

```
[ ] Baki sab same rakhο
[ ] File save karo
```

---

### STEP 3: PUSH TO GITHUB (Optional)

```
Time: 3 minutes
Tool: Git/Terminal

[ ] git add .
[ ] git commit -m "Deploy to Hostinger"
[ ] git push origin happy-day-restore
[ ] Confirm on GitHub.com
```

---

### STEP 4: UPLOAD FILES TO HOSTINGER

```
Time: 5-10 minutes

OPTION A: Git Pull (Recommended)
[ ] SSH login: ssh username@domain.com
[ ] cd public_html
[ ] git clone repo . OR git pull
[ ] Files uploaded!

OPTION B: SFTP Upload (FileZilla)
[ ] Download FileZilla
[ ] Login with SFTP
[ ] Drag-drop all files to public_html
[ ] Verify files uploaded
```

---

### STEP 5: INSTALL DEPENDENCIES

```
Time: 3-5 minutes
Tool: SSH Terminal

[ ] ssh username@domain.com
[ ] cd public_html
[ ] npm install --production
[ ] Wait for "added X packages" message
```

---

### STEP 6: START WITH PM2

```
Time: 2 minutes
Tool: SSH Terminal

[ ] npm install -g pm2
[ ] pm2 start app.js --name "school-crm"
[ ] pm2 startup
[ ] pm2 save
[ ] pm2 status (should show "online")
```

---

### STEP 7: TEST IN BROWSER

```
Time: 2 minutes
Tool: Your Browser

[ ] Open: https://kidsrootsjand.com
[ ] Page loads properly
[ ] CSS styling visible
[ ] No errors in console

[ ] Login page visible
[ ] Try admin login:
    URL: https://kidsrootsjand.com/admin
    User: admin
    Pass: admin123
[ ] Dashboard loads
```

---

### STEP 8: ENABLE HTTPS

```
Time: 1 minute
Location: cPanel

[ ] Go to cPanel
[ ] Search "AutoSSL"
[ ] Click "Install"
[ ] Or use "Let's Encrypt SSL"
[ ] Wait 5-10 minutes
```

---

## ✅ DEPLOYMENT COMPLETE!

```
Agar sabkuch green ✓ nikla toh:
```

```
YOUR SCHOOL CRM IS NOW LIVE!

URL: https://kidsrootsjand.com
Admin: https://kidsrootsjand.com/admin
Database: school_system (Hostinger)
Branch: happy-day-restore ✅
```

---

## 🔍 VERIFICATION CHECKLIST

After deployment, verify:

- [ ] Homepage loads: https://kidsrootsjand.com
- [ ] Admin login works: admin / admin123
- [ ] Student data visible
- [ ] Classes load
- [ ] Fees display
- [ ] HTTPS working (green lock)
- [ ] No console errors
- [ ] pm2 status shows "online"

---

## 📞 QUICK COMMANDS REFERENCE

```bash
# Check app status
pm2 status

# View logs
pm2 logs school-crm

# Restart app
pm2 restart school-crm

# Stop app
pm2 stop school-crm

# Start app
pm2 start app.js --name "school-crm"

# Monitor
pm2 monit
```

---

## 🆘 IF SOMETHING BREAKS

```bash
# 1. Check logs first
pm2 logs school-crm --lines 50

# 2. Restart app
pm2 restart school-crm

# 3. Check .env credentials
nano .env

# 4. Check database connection
# cPanel -> phpMyAdmin -> school_system

# 5. Manual run for debugging
node app.js
```

---

## 💡 IMPORTANT REMINDERS

```
❗ .env file must be uploaded!
❗ Don't upload node_modules
❗ Use strong passwords
❗ Regular database backups
❗ Monitor logs regularly
❗ Keep SSH access safe
```

---

## 📊 MAINTENANCE

**Daily:**
- Check pm2 status

**Weekly:**
- Review pm2 logs
- Database backup

**Monthly:**
- Full system backup
- Performance check

---

## 🎯 CURRENT STATUS

**Branch:** happy-day-restore ✅  
**Domain:** kidsrootsjand.com  
**Host:** Hostinger  
**Database:** school_system  
**Status:** Ready to deploy! 🚀

---

**Total Time: ~30-45 minutes**

**Print this card and tick off as you go!** ✓
