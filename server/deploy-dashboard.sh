#!/bin/bash
# =============================================================================
# deploy-dashboard.sh — Build & push dashboard to 74.208.132.78
# Run from: C:\dev\oss\oss-dashboard\
# Requirements: Git Bash / WSL / PowerShell with ssh + scp
# =============================================================================

SERVER="root@74.208.132.78"
REMOTE_DIR="/var/www/oss-dashboard"

echo "🔨 Building OSS Dashboard..."
npm run build

echo "📦 Uploading to $SERVER:$REMOTE_DIR ..."
scp -r dist/* $SERVER:$REMOTE_DIR/

echo "🔧 Setting permissions..."
ssh $SERVER "chown -R www-data:www-data $REMOTE_DIR && nginx -t && systemctl reload nginx"

echo ""
echo "✅ Dashboard deployed!"
echo "🌐 https://www.onestopdaily.shop"

