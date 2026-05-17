# GitHub Auto Deploy (Push -> Live Update)

This setup makes live hosting auto-update whenever you push to `main`.

## 1) One-time server setup

Run on your live server (SSH):

```bash
cd /home/<cpanel_user>
mkdir -p my_school_app
cd my_school_app
git clone <your-repo-url> .
```

Set your production `.env` in this same folder.

In cPanel `Setup Node.js App`:
- Application root: `/home/<cpanel_user>/my_school_app`
- Startup file: `app.js`

## 2) Add GitHub Secrets

In GitHub repo: `Settings -> Secrets and variables -> Actions -> New repository secret`

Add:
- `LIVE_HOST` = server host (example: `example.com`)
- `LIVE_PORT` = SSH port (usually `22`)
- `LIVE_USER` = SSH username
- `LIVE_SSH_KEY` = private SSH key content (full key text)
- `LIVE_APP_PATH` = app path (example: `/home/<cpanel_user>/my_school_app`)
- `LIVE_BRANCH` = `main` (optional; default is `main`)

## 3) What auto deploy does

Workflow file: `.github/workflows/deploy-live.yml`

On each push to `main`, it:
1. Connects to server via SSH
2. Backs up these files before update:
   - `.env`
   - `permissions.json`
   - `date_sheet.json`
   - `admin_credentials.json` (if present)
3. Pulls latest GitHub code (`git reset --hard origin/main`)
4. Restores backed-up files
5. Runs `npm ci --omit=dev` (or `npm install --omit=dev`)
6. Restarts app using `tmp/restart.txt`

This protects runtime settings and reduces data-loss risk during updates.

## 4) Deployment flow

Now your flow is:

```bash
git add .
git commit -m "your update"
git push origin main
```

Then GitHub Actions deploys to live automatically.

## 5) Important

- Main data stays in MySQL, so code deploy should not remove students/fees.
- Keep regular DB backups (daily recommended).
- Do not store real production secrets in Git.
