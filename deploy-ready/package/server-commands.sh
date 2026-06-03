#!/usr/bin/env bash
set -euo pipefail

# Run from the live server project root after uploading files.

node -v
npm -v

if [ ! -f ".env" ]; then
  cp deploy-ready/env.production.template .env
  echo "Created .env from template. Edit .env before starting the app."
  exit 1
fi

mkdir -p logs
npm ci --omit=dev
npm run validate

if command -v pm2 >/dev/null 2>&1; then
  pm2 start ecosystem.config.js
  pm2 save
  pm2 logs school-crm
else
  npm start
fi

