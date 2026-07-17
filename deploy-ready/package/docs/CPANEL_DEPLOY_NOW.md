# cPanel Deploy (ZIP Upload + Live)

## 1) Create a local ZIP

PowerShell:

```powershell
cd d:\AI\ezyZip22
.\create-hosting-zip.ps1 -Output hosting-upload.zip
```

If you do not want to run `npm install` on the server, create a larger ZIP:

```powershell
.\create-hosting-zip.ps1 -Output hosting-upload-with-node_modules.zip -IncludeNodeModules
```

## 2) Upload to cPanel

1. Open `File Manager`.
2. Create the app folder: `/home/<cpanel_user>/my_school_app`
3. Upload `hosting-upload.zip` and extract it into that folder.

Important: the cPanel Node.js application path must match this folder exactly.

## 3) Configure Node.js App in cPanel

In `Setup Node.js App`:

- Node version: `18+` (or highest available)
- Application mode: `Production`
- Application root: `/home/<cpanel_user>/my_school_app`
- Application URL: your domain/subdomain
- Application startup file: `app.js`

Create the app.

## 4) Set environment variables

Set these variables in the Node app environment:

- `DB_HOST=localhost`
- `DB_PORT=3306`
- `DB_NAME=<your_cpanel_db_name>`
- `DB_USER=<your_cpanel_db_user>`
- `DB_PASSWORD=<your_cpanel_db_password>`
- `PORT` (can stay blank; cPanel sets it)
- `JWT_SECRET=<strong_secret>`
- `AUTO_CREATE_DB=false`

`AUTO_CREATE_DB=false` is recommended for shared hosting.

## 5) Install dependencies and restart

If your ZIP does not include `node_modules`:

1. Click `Run NPM Install` in the Node app dashboard.
2. Restart the app.

## 6) Verify

Check these URLs in the browser:

- `https://your-domain/health` -> should return JSON (`success: true`)
- `https://your-domain/api/students` -> should return JSON response
- `https://your-domain/` -> frontend should load

## 7) If you get 404, check these first

1. Confirm logs do not show `Path for NodeJS application is invalid`.
2. Confirm app root path is correct.
3. Confirm startup file is `app.js`.
4. Confirm the app was restarted.
