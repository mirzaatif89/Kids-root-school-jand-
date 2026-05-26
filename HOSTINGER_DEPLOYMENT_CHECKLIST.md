# HOSTINGER DEPLOYMENT - QUICK CHECKLIST

## 📋 Pre-Deployment Tasks

- [ ] Hostinger Hosting Account ready
- [ ] Node.js enabled on hosting (18+)
- [ ] SSH access available
- [ ] MySQL Database access ready
- [ ] Domain: `kidsrootsjand.com` 
- [ ] SSL Certificate ready

---

## 🔧 STEP-BY-STEP DEPLOYMENT

### 1. CREATE MYSQL DATABASE (cPanel)

```
Database Name:  school_system
Username:       school_user
Password:       [Strong Password - Save This!]
Host:          localhost
```

**Privileges to Give:**
- [x] SELECT, INSERT, UPDATE, DELETE
- [x] CREATE, ALTER, DROP, INDEX
- [x] REFERENCES, LOCK TABLES, EXECUTE, CREATE TEMPORARY TABLES

---

### 2. PREPARE PROJECT FOR PRODUCTION

```bash
# 1. Update .env file
nano .env

# Change these:
DB_HOST=localhost
DB_NAME=school_system
DB_USER=school_user
DB_PASSWORD=YOUR_NEW_PASSWORD
NODE_ENV=production
PORT=3000
```

---

### 3. UPLOAD TO HOSTINGER VIA SFTP

Using FileZilla or Hostinger's File Manager:

```
Upload to: public_html/

Structure:
├── backend/
├── frontend/
├── config/
├── app.js
├── package.json
├── .env
├── permissions.json
└── ecosystem.config.js
```

---

### 4. INSTALL DEPENDENCIES (SSH)

```bash
# SSH into server
ssh your_username@kidsrootsjand.com
cd public_html

# Install only production dependencies
npm install --production

# Verify installation
npm list
```

---

### 5. START APPLICATION (Using PM2 Recommended)

**Option A: PM2 (Best Practice)**
```bash
npm install -g pm2
pm2 start app.js --name "school-crm"
pm2 startup
pm2 save
pm2 status
```

**Option B: Using Hostinger Node.js Manager**
- Go to cPanel → Node.js Manager
- Create new Node.js App
- Point to app.js file

---

### 6. CONFIGURE DOMAIN

In Hostinger cPanel:
- [ ] Domain points to public_html
- [ ] DNS configured correctly
- [ ] A Record → Your Server IP
- [ ] CNAME/MX records if needed

---

### 7. SSL CERTIFICATE

```bash
cPanel → AutoSSL  [Auto Install - Usually works]
OR
cPanel → Let's Encrypt SSL → Install
```

---

### 8. MIGRATE DATABASE (if you have existing data)

```bash
# Export from local:
mysqldump -u root -p school_system > backup.sql

# Import to Hostinger via phpMyAdmin:
# cPanel → phpMyAdmin → school_system → Import → backup.sql
```

---

## ✅ VERIFICATION

### Test Your Application:

```bash
# SSH into server and test
curl https://kidsrootsjand.com
pm2 logs school-crm

# Check in browser:
https://kidsrootsjand.com
https://kidsrootsjand.com/login
https://kidsrootsjand.com/admin
```

---

## 🔐 SECURITY CHECKLIST

- [ ] .env file is NOT in git
- [ ] Strong DB password set
- [ ] Strong JWT_SECRET set
- [ ] SSL certificate enabled
- [ ] Firewall configured (if available)
- [ ] Regular backups scheduled

---

## 🐛 TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| `Cannot find module` | Run `npm install --production` |
| `Database connection error` | Check .env credentials in cPanel |
| `502 Bad Gateway` | Restart: `pm2 restart school-crm` |
| `Application timeout` | Check PM2 logs: `pm2 logs` |
| `Domain not working` | Check DNS A record points to server IP |

---

## 📊 MAINTENANCE

```bash
# View logs
pm2 logs school-crm

# Monitor performance
pm2 monit

# Restart application
pm2 restart school-crm

# View database
# cPanel → phpMyAdmin → school_system

# Backup database (regular)
# cPanel → Backups → Full Backups
```

---

## 🎯 IMPORTANT NOTES

1. **Database Credentials:** Keep .env safe
2. **Node Version:** Use v18 or higher
3. **Memory:** Ensure enough for Node.js
4. **Storage:** Check available disk space
5. **Bandwidth:** Monitor usage

---

## 📞 SUPPORT CONTACTS

- **Hostinger Support:** support@hostinger.com
- **Check Server Logs:** `tail -f /var/log/nodejs.log`
- **PM2 Logs:** `pm2 logs school-crm`

---

**After deployment:** Your School CRM will be live at `https://kidsrootsjand.com` ✨
