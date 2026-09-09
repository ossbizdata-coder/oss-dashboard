#!/bin/bash
# =============================================================================
# deploy-dashboard.sh — Build, Sync to Git, and Deploy to VPS
# =============================================================================

# Stop on first error
set -e

# Keep window open on error so you can see why it failed
trap 'echo ""; echo "❌ DEPLOYMENT FAILED!"; echo "Check the error message above."; echo "Press Enter to close this window..."; read' ERR

# Configuration
SERVER="sahan@74.208.132.78"
REMOTE_DIR="/var/www/oss-dashboard"
TMP_DIR="/home/sahan/oss-dashboard-deploy-tmp"

echo "--------------------------------------------------"
echo "🚀 Starting OSS Dashboard Deployment"
echo "--------------------------------------------------"

# 1. Build the project
echo "🔨 Step 1: Building production assets..."
npm run build

# 2. Git Sync
echo "🚀 Step 2: Syncing with Git..."
git add .
if git diff-index --quiet HEAD --; then
    echo "ℹ️  No changes to commit."
else
    echo "📝 Committing changes..."
    git commit -m "Auto-deploy: logic fixes $(date +'%Y-%m-%d %H:%M:%S')"
    echo "📤 Pushing to Git repository..."
    git push
fi

# 3. Server Preparation
echo "📦 Step 3: Preparing server..."
ssh $SERVER "mkdir -p $TMP_DIR && rm -rf $TMP_DIR/*"

# 4. Upload
echo "📤 Step 4: Uploading build directory to $SERVER..."
# Copy the whole dist folder instead of using a wildcard
scp -r dist $SERVER:$TMP_DIR/

# 5. Move to Web Root & Cleanup
echo "🔧 Step 5: Moving files to web root and setting permissions..."
# Since we uploaded the folder 'dist', the files are in $TMP_DIR/dist/
ssh -tt $SERVER "
    echo '📂 Clearing remote directory...'
    sudo rm -rf $REMOTE_DIR/*
    echo '📂 Copying new files to web root...'
    sudo cp -r $TMP_DIR/dist/* $REMOTE_DIR/
    echo '🔑 Setting ownership to www-data...'
    sudo chown -R www-data:www-data $REMOTE_DIR
    echo '🧹 Cleaning up temp directory...'
    rm -rf $TMP_DIR
    echo '🔄 Reloading Nginx...'
    sudo nginx -t && sudo systemctl reload nginx
"

echo "--------------------------------------------------"
echo "✅ Deployment Complete!"
echo "🌐 URL: https://www.onestopdaily.shop"
echo "--------------------------------------------------"

echo "Press Enter to close this window..."
read
