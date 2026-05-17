# School Management System - Deployment Guide

## Overview
This project deploys in two parts:
1. Frontend -> Vercel (static HTML/CSS/JS)
2. Backend -> Render (Node.js API + MySQL)

---

## Prerequisites

### 1) GitHub account
- Create a GitHub account if you do not have one.
- Push the project to a GitHub repository.

### 2) Platform accounts
- Vercel: https://vercel.com/signup
- Render: https://render.com/register

---

## Step 1: Upload code to GitHub

### Option A: Git command line
```bash
cd "d:\All Projects\School Management System\PROJECT"

git init
git add .
git commit -m "Initial commit - School Management System"
git remote add origin https://github.com/YOUR_USERNAME/school-management-system.git
git branch -M main
git push -u origin main
```

### Option B: GitHub Desktop
1. Install GitHub Desktop.
2. Click `Add Local Repository`.
3. Select your project folder.
4. Click `Publish Repository`.

---

## Step 2: Deploy backend on Render

1. Open https://dashboard.render.com
2. Click `New +` -> `Blueprint`
3. Select your GitHub repository
4. Render detects `render.yaml` automatically
5. Click `Apply`
6. Wait for deployment (first deployment may take 5-10 minutes)
7. Copy backend URL (example):
   ```
   https://school-management-backend.onrender.com
   ```

---

## Step 3: Deploy frontend on Vercel

1. Open https://vercel.com/dashboard
2. Click `Add New Project`
3. Import your repository
4. Use configuration:
   - Framework Preset: `Other`
   - Root Directory: `./`
   - Build Command: empty
   - Output Directory: `./`
5. Add environment variable:
   - Name: `VITE_API_URL`
   - Value: `https://school-management-backend.onrender.com`
6. Click `Deploy`

---

## Step 4: Connect frontend to backend

Update `script.js` so API requests use your backend URL.

Example:
```javascript
const API_URL = 'https://school-management-backend.onrender.com';
fetch(`${API_URL}/api/students`);
```

Commit and push changes:
```bash
git add .
git commit -m "Connect frontend to backend"
git push
```

---

## Step 5: Testing

### Backend test
Open:
```
https://YOUR-BACKEND-URL.onrender.com/api/students
```
Expected: JSON response (often an empty array initially).

### Frontend test
Open:
```
https://YOUR-FRONTEND-URL.vercel.app
```
Expected: application loads and login works.

---

## Common Issues

### 1) Backend is slow on first request
Render free services can sleep after inactivity. First request may take 30-60 seconds.

### 2) Database connection errors
- Verify Render database credentials.
- Verify backend environment variables.

### 3) CORS issues
Ensure backend CORS allows your deployed frontend domain.

---

## Cost Notes
- Vercel: free tier available
- Render: free tier available
- Render MySQL pricing may change; check current Render pricing page

---

## Updating after deployment
Whenever you update code:
```bash
git add .
git commit -m "Your update message"
git push
```
Vercel and Render redeploy automatically.

---

## Support Checklist
1. Check Render logs.
2. Check Vercel deployment logs.
3. Check browser console (`F12`).
4. Test backend endpoint directly in browser/Postman.

---

## Next Steps
- Add custom domain
- Verify HTTPS/SSL
- Configure monitoring
- Add regular backups
