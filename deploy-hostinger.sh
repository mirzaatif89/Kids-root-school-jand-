#!/bin/bash
# Hostinger School CRM Deployment Script
# Run this on Hostinger server after uploading files

echo "======================================"
echo "School CRM - Hostinger Deployment"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "app.js" ]; then
    echo "❌ Error: app.js not found!"
    echo "Make sure you're in the public_html directory"
    exit 1
fi

echo ""
echo "📋 Step 1: Installing dependencies..."
npm install --production

if [ $? -ne 0 ]; then
    echo "❌ npm install failed!"
    exit 1
fi

echo "✅ Dependencies installed"

echo ""
echo "📋 Step 2: Checking Node.js version..."
node --version
npm --version

echo ""
echo "📋 Step 3: Installing PM2 globally..."
npm install -g pm2

if [ $? -ne 0 ]; then
    echo "⚠️ PM2 installation had issues, but continuing..."
fi

echo ""
echo "📋 Step 4: Checking .env file..."
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy your .env file before running this script"
    exit 1
else
    echo "✅ .env file found"
fi

echo ""
echo "📋 Step 5: Starting application with PM2..."
pm2 start app.js --name "school-crm" --instances 2 --exec-mode cluster

if [ $? -ne 0 ]; then
    echo "❌ PM2 start failed!"
    exit 1
fi

echo "✅ Application started"

echo ""
echo "📋 Step 6: Enabling PM2 startup..."
pm2 startup
pm2 save

echo ""
echo "📋 Step 7: Verifying application status..."
pm2 status

echo ""
echo "======================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "======================================"
echo ""
echo "Your School CRM is now running at:"
echo "https://kidsrootsjand.com"
echo ""
echo "Useful commands:"
echo "  pm2 logs school-crm          # View application logs"
echo "  pm2 status                   # Check if app is running"
echo "  pm2 restart school-crm       # Restart application"
echo "  pm2 stop school-crm          # Stop application"
echo ""
echo "======================================"
