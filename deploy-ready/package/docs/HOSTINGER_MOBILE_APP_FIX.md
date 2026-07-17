# Hostinger Mobile App Login Fix

If the mobile app shows `Could not reach server`, first test:

```bash
curl -i https://kidsrootsjand.com/api/health
```

If the response is `403 Forbidden` with `Server: hcdn` and a page saying `Checking your browser before accessing`, Hostinger CDN security is blocking API requests before they reach Node.js.

Mobile apps and API fetch calls cannot pass Hostinger's browser JavaScript challenge. Turn off the challenge for this app:

1. Open Hostinger hPanel.
2. Go to `Websites` -> `kidsrootsjand.com`.
3. Open `Security` or `Performance/CDN`.
4. Disable Hostinger CDN `Under Attack Mode`, browser challenge, bot protection, or firewall challenge.
5. Clear Hostinger cache/CDN cache.
6. Restart/redeploy the Node.js app.
7. Test `https://kidsrootsjand.com/api/health`; it should return JSON.

The app includes `/health`, `/api/health`, and `/api/ping` so the mobile app can check server availability with a simple JSON endpoint.
