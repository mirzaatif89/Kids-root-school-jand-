# School CRM Live Deployment Guide

Ye folder project ko live karne ke liye quick deployment kit hai. Recommended setup VPS ya cPanel Node.js app hai jahan Node.js 18+ aur MySQL available ho.

## 1. Server Requirements

- Node.js 18 ya 20
- MySQL database
- SSH access recommended
- Domain/subdomain app ke folder ya Node app se connected
- PM2 recommended for VPS

## 2. Upload Karne Wali Files

Project root se ye files/folders server par upload karein:

- `app.js`
- `package.json`
- `package-lock.json`
- `backend/`
- `frontend/`
- `config/`
- `permissions.json`
- `permissions-detailed.json`
- `date_sheet.json`
- `.htaccess` agar cPanel/Apache reverse proxy use kar rahe hain
- `ecosystem.config.js` agar PM2 use karna hai

Upload na karein:

- `node_modules/`
- `.git/`
- `.env` local wali
- `logs/`
- `.whatsapp-session/` jab tak WhatsApp session migrate karna zaroori na ho
- `*.log`

## 3. Server Par Environment File

Server par project root mein `.env` banayein. Template ke liye:

```bash
cp deploy-ready/env.production.template .env
nano .env
```

Important values zaroor change karein:

- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `APP_URL`
- `JWT_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `PRINCIPAL_USERNAME`
- `PRINCIPAL_PASSWORD`
- SMTP values agar email live use karni hai

## 4. Database

MySQL mein database aur user bana kar permissions dein:

```sql
CREATE DATABASE school_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'school_user'@'localhost' IDENTIFIED BY 'strong_password_here';
GRANT ALL PRIVILEGES ON school_system.* TO 'school_user'@'localhost';
FLUSH PRIVILEGES;
```

App start par Sequelize tables automatically create/update karega.

## 5. Install Aur Run

Server project folder mein:

```bash
npm ci --omit=dev
npm run validate
npm start
```

PM2 ke sath:

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 logs school-crm
```

## 6. cPanel Node.js App

cPanel mein Node.js App create karein:

- Application root: project folder
- Application startup file: `app.js`
- Node version: 18+ ya 20+
- Environment: `production`
- App URL/domain select karein

Phir cPanel terminal ya Setup Node.js App screen se:

```bash
npm ci --omit=dev
```

App restart karein.

## 7. Quick Checks

Browser mein check karein:

- `https://your-domain.com/`
- `https://your-domain.com/login`
- `https://your-domain.com/api/health` agar route available ho

Server logs:

```bash
pm2 logs school-crm
```

Ya cPanel Node.js logs check karein.

## 8. Common Issues

- `Database offline`: `.env` DB credentials ya MySQL permissions check karein.
- `Port already in use`: `.env` mein `PORT` change karein ya old process stop karein.
- Static pages 404: `frontend/` folder upload hua hai ya nahi check karein.
- Email nahi ja rahi: SMTP app password aur `SMTP_SECURE`/`SMTP_PORT` verify karein.

