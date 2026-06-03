# cPanel Node.js Notes

Use these settings in cPanel Setup Node.js App:

- Node.js version: 18+ or 20+
- Application mode: Production
- Application root: your uploaded project folder
- Application URL: your domain/subdomain
- Application startup file: `app.js`

After creating the app:

```bash
cd ~/path-to-project
cp deploy-ready/env.production.template .env
nano .env
npm ci --omit=dev
```

Then click Restart in cPanel Node.js App.

If the app gives a 503 or Passenger error, check:

- `.env` exists in project root
- MySQL credentials are correct
- `frontend/` and `backend/` were uploaded
- startup file is exactly `app.js`
- Node version is 18+

