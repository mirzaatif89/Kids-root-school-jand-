# ✅ Deployment Checklist - School CRM

Use this checklist to ensure all steps are completed before deployment.

---

## 📋 Pre-Deployment Phase

### Project Preparation
- [ ] Review all documentation in `/docs/` folder
- [ ] Understand project architecture ([PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md))
- [ ] Review security guidelines ([PRODUCTION_README.md](PRODUCTION_README.md#-security-features))

### Environment Setup
- [ ] Copy `.production.env.example` to `.env`
- [ ] Fill all required `.env` variables:
  - [ ] `DB_HOST` (usually: localhost)
  - [ ] `DB_NAME` (from cPanel)
  - [ ] `DB_USER` (from cPanel)
  - [ ] `DB_PASSWORD` (from cPanel)
  - [ ] `JWT_SECRET` (strong random string, min 32 chars)
  - [ ] `SMTP_HOST` (e.g., smtp.gmail.com)
  - [ ] `SMTP_USER` (your email)
  - [ ] `SMTP_PASS` (Gmail App Password)
  - [ ] `SMTP_FROM_EMAIL`
  - [ ] `SMTP_FROM_NAME` (school name)
  - [ ] `PRINCIPAL_USERNAME`
  - [ ] `PRINCIPAL_PASSWORD`

### Dependencies
- [ ] Run `npm install` to install all packages
- [ ] Verify no installation errors

### Local Testing
- [ ] Run `npm run validate` - should pass all checks
- [ ] Run `npm run dev` - should start without errors
- [ ] Open `http://localhost:3000` - login page visible
- [ ] Try logging in with default credentials
- [ ] Create test student record
- [ ] Test other main features

---

## 🚀 cPanel Deployment Phase

### cPanel Account Setup
- [ ] Have cPanel login credentials ready
- [ ] cPanel account has Node.js support (Node 16+)
- [ ] Enough disk space for application

### Database Setup in cPanel
- [ ] Open cPanel → MySQL Databases
- [ ] Create new database
- [ ] Create new MySQL user
- [ ] Add user to database with ALL PRIVILEGES
- [ ] Save credentials:
  - Database Name: `_______________`
  - DB User: `_______________`
  - DB Password: `_______________`

### Domain/SSL Setup
- [ ] Domain/subdomain points to your cPanel account
- [ ] SSL certificate installed (or AutoSSL enabled)
- [ ] Can access `https://yourdomain.com`

### Application Upload
- [ ] Run `.\create-hosting-zip.ps1 -Output school-crm.zip`
- [ ] Create folder `/home/username/my_school_app` in cPanel File Manager
- [ ] Upload `school-crm.zip` to that folder
- [ ] Extract the ZIP file
- [ ] Delete the ZIP file
- [ ] Verify folder structure exists:
  - [ ] `app.js` present
  - [ ] `package.json` present
  - [ ] `backend/` folder present
  - [ ] `frontend/` folder present

### Node.js App Configuration
- [ ] Open cPanel → Setup Node.js App
- [ ] Create new app with:
  - [ ] Node version: `18.x` (or latest)
  - [ ] Application mode: `Production`
  - [ ] Application root: `/home/username/my_school_app`
  - [ ] Application URL: `yourdomain.com`
  - [ ] Startup file: `app.js`
- [ ] Click **Create**

### Environment Variables in cPanel
- [ ] Add all variables from your `.env` file:
  - [ ] `NODE_ENV` = `production`
  - [ ] `DB_HOST` = `localhost`
  - [ ] `DB_NAME` = (your value)
  - [ ] `DB_USER` = (your value)
  - [ ] `DB_PASSWORD` = (your value)
  - [ ] `JWT_SECRET` = (your value)
  - [ ] `SMTP_HOST` = (your value)
  - [ ] `SMTP_PORT` = `587`
  - [ ] `SMTP_USER` = (your value)
  - [ ] `SMTP_PASS` = (your value)
  - [ ] `SMTP_FROM_EMAIL` = (your value)
  - [ ] `SMTP_FROM_NAME` = (your value)
  - [ ] `PRINCIPAL_USERNAME` = (your value)
  - [ ] `PRINCIPAL_PASSWORD` = (your value)
  - [ ] `AUTO_CREATE_DB` = `false`
  - [ ] `PENDING_FEE_REMINDER_ENABLED` = `true`
  - [ ] `PENDING_FEE_REMINDER_TIME` = `09:00`

### Dependencies Installation
- [ ] Click **Run NPM Install** in Node app dashboard
- [ ] Wait for installation to complete (2-5 minutes)
- [ ] Check for errors in install log

### Application Start
- [ ] Click **Restart** button
- [ ] Wait for app to start (30-60 seconds)
- [ ] Check app status (should be "Running")

---

## ✅ Post-Deployment Verification

### Health Checks
- [ ] Open `https://yourdomain.com/health` in browser
- [ ] Should see JSON response with `success: true`
- [ ] Check the `initialized` field is `true`

### Frontend Access
- [ ] Open `https://yourdomain.com/` in browser
- [ ] Login page should load
- [ ] Can see all UI elements

### Login Test
- [ ] Try logging in with admin credentials
- [ ] Dashboard should load successfully
- [ ] No JavaScript console errors
- [ ] Can navigate between pages

### API Test
- [ ] Test API endpoint in browser or cURL:
  ```
  https://yourdomain.com/api/students
  ```
- [ ] Should return JSON response (may show auth error, that's okay)

### Feature Tests
- [ ] Create new student record
- [ ] Edit student record
- [ ] View student list
- [ ] Test fees module
- [ ] Test teacher management
- [ ] Test other main features

### Database Connection
- [ ] No "database connection" errors in logs
- [ ] Data persists after page reload
- [ ] Can query students from different browsers

### Email Testing
- [ ] Send test email via app settings
- [ ] Verify email received
- [ ] Check email format and content
- [ ] If failed, review SMTP credentials

### Logs Check
- [ ] Open cPanel File Manager
- [ ] Navigate to `/home/username/my_school_app/logs/`
- [ ] Check `app.log` for startup messages
- [ ] No critical errors in `error.log`

### Performance Check
- [ ] Page loads in reasonable time (< 3 seconds)
- [ ] No 502 or 503 errors
- [ ] App responsive to user interactions
- [ ] Charts/data load correctly

---

## 🔒 Security Verification

- [ ] Using HTTPS (not HTTP)
- [ ] SSL certificate valid (green lock icon)
- [ ] JWT secret is strong (min 32 chars, random)
- [ ] Admin password is strong
- [ ] Database user password is strong
- [ ] SMTP password is App Password (Gmail) or secure
- [ ] `.env` file not accessible via web
- [ ] `node_modules` not accessible via web
- [ ] Error messages don't expose sensitive info

---

## 🔧 Maintenance Setup

### Backups
- [ ] Set up cPanel backup schedule
- [ ] Test backup restoration process
- [ ] Document backup location

### Monitoring
- [ ] Monitor `/logs/app.log` regularly
- [ ] Set up email alerts if available
- [ ] Document any errors encountered

### Updates
- [ ] Note Node.js version installed
- [ ] Plan for Node.js version updates
- [ ] Plan for npm dependency updates

### Documentation
- [ ] Document your:
  - [ ] cPanel username
  - [ ] Application root path
  - [ ] Database name
  - [ ] Database user
  - [ ] Domain name
  - [ ] Any customizations made

---

## 🆘 Troubleshooting During Deployment

If you encounter issues:

1. **Check logs:**
   ```bash
   ssh user@domain.com
   tail -100 /home/username/my_school_app/logs/app.log
   tail -100 /home/username/my_school_app/logs/error.log
   ```

2. **Verify environment variables are set**
   - Check each variable in cPanel Node app dashboard

3. **Test database connection:**
   ```bash
   mysql -h localhost -u your_db_user -p your_database
   ```

4. **Review documentation:**
   - [CPANEL_DEPLOYMENT_COMPLETE.md](docs/CPANEL_DEPLOYMENT_COMPLETE.md#troubleshooting)
   - [PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)

5. **Common fixes:**
   - Restart the Node.js app in cPanel
   - Run npm install again
   - Check database credentials
   - Verify SMTP settings
   - Clear browser cache

---

## ✨ Post-Deployment Optimization

After successful deployment:

- [ ] Enable SSL auto-renewal (AutoSSL in cPanel)
- [ ] Set up cPanel automatic backups
- [ ] Configure email for admin alerts
- [ ] Review and customize app settings
- [ ] Create administrator guide for staff
- [ ] Test disaster recovery plan
- [ ] Document any customizations
- [ ] Plan regular maintenance schedule

---

## 📊 Deployment Summary

| Item | Status | Notes |
|------|--------|-------|
| **Environment** | ☐ | |
| **Database** | ☐ | |
| **cPanel Setup** | ☐ | |
| **Upload & Extract** | ☐ | |
| **Node.js Config** | ☐ | |
| **npm Install** | ☐ | |
| **Health Check** | ☐ | |
| **Login Test** | ☐ | |
| **Features Test** | ☐ | |
| **Security Check** | ☐ | |
| **Email Setup** | ☐ | |
| **Backups** | ☐ | |
| **Monitoring** | ☐ | |

---

## 📞 Need Help?

1. **Review Documentation:**
   - [Quick Start](DEPLOYMENT_QUICK_START.md)
   - [Full Guide](CPANEL_DEPLOYMENT_COMPLETE.md)
   - [Architecture](PROJECT_STRUCTURE.md)

2. **Check Logs:**
   ```bash
   tail -100 logs/app.log
   ```

3. **Run Validation:**
   ```bash
   npm run validate
   ```

4. **Test Connections:**
   - Database: `mysql -h localhost -u user -p database`
   - API: `curl https://yourdomain.com/health`
   - Frontend: Open `https://yourdomain.com/`

---

## ✅ Final Sign-Off

- [ ] All checklist items completed
- [ ] Application working correctly
- [ ] All features tested
- [ ] Security verified
- [ ] Backups configured
- [ ] Monitoring in place
- [ ] Documentation reviewed
- [ ] Ready for production use

**Deployment Date:** _______________  
**Deployed By:** _______________  
**cPanel Username:** _______________  
**Domain:** _______________  

---

**Last Updated:** May 26, 2026  
**Version:** 1.0
