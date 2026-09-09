#!/bin/bash
set -euo pipefail

SERVER="sahan@74.208.132.78"
REMOTE_DIR="/var/www/oss-dashboard"

echo "🧪 Preflight checks..."
command -v npm >/dev/null 2>&1 || { echo "❌ npm not found in PATH"; exit 1; }
command -v ssh >/dev/null 2>&1 || { echo "❌ ssh not found in PATH"; exit 1; }
command -v scp >/dev/null 2>&1 || { echo "❌ scp not found in PATH"; exit 1; }

echo "🔐 Checking SSH access to $SERVER ..."
if ! ssh -o ConnectTimeout=10 "$SERVER" "echo connected" >/dev/null 2>&1; then
  echo "❌ Cannot authenticate to $SERVER."
  echo "   Fix SSH auth first (key or password), then rerun this script."
  exit 1
fi

echo "🔨 Building OSS Dashboard..."
npm run build

echo "📦 Uploading to $SERVER:$REMOTE_DIR ..."
scp -r dist/* $SERVER:$REMOTE_DIR/

echo "🔧 Setting permissions..."
ssh $SERVER "sudo chown -R www-data:www-data $REMOTE_DIR && sudo nginx -t && sudo systemctl reload nginx"

echo ""
echo "✅ Dashboard deployed to VPS successfully!"
echo "🌐 https://www.onestopdaily.shop"
