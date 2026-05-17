# Vercel Deployment

## What was prepared

- Static pages are served directly by Vercel
- Express API is exposed through `api/index.js`
- Frontend API URLs use same-origin on deployed environments
- Local development with `node server.js` still works

## Required Environment Variables

Set these in the Vercel project settings:

```env
DB_HOST=your-mysql-host
DB_PORT=3306
DB_NAME=school_system
DB_USER=your-mysql-user
DB_PASSWORD=your-mysql-password
JWT_SECRET=your-jwt-secret
ADMIN_USERNAME=Myownschool
ADMIN_PASSWORD=myownschool1122
PRINCIPAL_USERNAME=principal@school.com
PRINCIPAL_PASSWORD=Principal123
```

## Deploy Steps

1. Push this project to GitHub
2. Import the repo into Vercel
3. Add the environment variables above
4. Deploy

## Important Notes

- Vercel does not provide MySQL, so use an external MySQL database
- `Socket.IO` real-time behavior is not suitable for Vercel serverless in the same way as a long-running Node server
- Core HTTP API and static pages are prepared for Vercel deployment

## Local Development

```bash
npm install
npm start
```

Open:

```txt
http://localhost:3000/index.html
```
