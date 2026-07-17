# Kids Roots Jand

Project is structured for separate frontend, backend, API, and runtime data work.

## Structure

- `frontend/` - HTML, CSS, browser JavaScript, images, and static pages.
- `backend/` - Express app startup, local/cPanel server code, and backend helper scripts.
- `api/` - Serverless/API endpoint handlers grouped by feature.
- `data/` - Runtime JSON state such as permissions and date-sheet data.
- `docs/` - Setup, deployment, and integration notes.

## Run

```bash
npm install
npm start
```

The root `app.js` starts the Express app from `backend/server.js`, serves the frontend from `frontend/`, and exposes APIs from `/api/...`.

# Kids-root-school-jand-
