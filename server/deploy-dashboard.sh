#!/bin/bash
# =============================================================================
# deploy-dashboard.sh — Build & push dashboard to 74.208.132.78
# Run from: C:\dev\mobile_apps\oss-dashboard\
# Requirements: Git Bash / WSL / PowerShell with ssh + scp
# =============================================================================

SERVER="sahan@74.208.132.78"
REMOTE_DIR="/var/www/oss-dashboard"

echo "🔨 Building OSS Dashboard..."
npm run build

echo "📦 Uploading to $SERVER:$REMOTE_DIR ..."
scp -r dist/* $SERVER:$REMOTE_DIR/

echo "🔧 Setting permissions..."
ssh $SERVER "sudo chown -R www-data:www-data $REMOTE_DIR && sudo nginx -t && sudo systemctl reload nginx"

echo "🚀 Pushing changes to Git..."
git add .
git commit -m "Auto-deploy: report features and UI fixes $(date +'%Y-%m-%d %H:%M:%S')"
git push

echo ""
echo "✅ Dashboard deployed and code pushed to Git!"
echo "🌐 https://www.onestopdaily.shop"
