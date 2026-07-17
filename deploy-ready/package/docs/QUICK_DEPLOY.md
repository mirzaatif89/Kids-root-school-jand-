# Quick Deployment Commands

## Step 1: Commit Your Code
```bash
git add .
git commit -m "Ready for deployment - School Management System"
git push
```

## Step 2: Deploy Backend to Render
1. Go to https://dashboard.render.com
2. Click "New +" → "Blueprint"
3. Connect your GitHub repository
4. Render will detect `render.yaml` automatically
5. Click "Apply"
6. Wait 5-10 minutes for deployment
7. Copy your backend URL (e.g., https://school-management-backend.onrender.com)

## Step 3: Update Frontend Configuration
Open `script.js` and update line 18:
```javascript
const BACKEND_URL = isLocalhost 
    ? 'http://localhost:3000' 
    : 'YOUR_RENDER_BACKEND_URL_HERE'; // Paste your Render URL
```

## Step 4: Commit Backend URL Update
```bash
git add script.js
git commit -m "Updated backend URL for production"
git push
```

## Step 5: Deploy Frontend to Vercel
1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Configure:
   - Framework Preset: Other
   - Build Command: (leave empty)
   - Output Directory: ./
4. Click "Deploy"
5. Wait 2-3 minutes

## Done! 🎉
Your app is now live at:
- Frontend: https://your-project.vercel.app
- Backend: https://your-backend.onrender.com

## Important Notes:
- Render free tier sleeps after 15 minutes of inactivity
- First request after sleep will take 30-60 seconds
- Vercel deployment is instant and always active
- Both platforms auto-deploy on git push
