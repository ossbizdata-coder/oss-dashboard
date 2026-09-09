#!/bin/bash
set -euo pipefail

SERVER="sahan@74.208.132.78"
REMOTE_DIR="/var/www/oss-dashboard"

trap 'echo "❌ Deployment failed. Check the previous step output above."; exit 1' ERR

echo "🧪 Preflight checks..."
command -v npm >/dev/null 2>&1 || { echo "❌ npm not found in PATH"; exit 1; }
command -v ssh >/dev/null 2>&1 || { echo "❌ ssh not found in PATH"; exit 1; }
command -v scp >/dev/null 2>&1 || { echo "❌ scp not found in PATH"; exit 1; }

echo "🔐 SSH auth check..."
if ssh -o BatchMode=yes -o ConnectTimeout=10 "$SERVER" "echo connected" >/dev/null 2>&1; then
  echo "✅ SSH key auth available."
else
  echo "ℹ️  SSH key auth not configured. Interactive password prompts are expected."
fi

echo "🔨 Building OSS Dashboard..."
npm run build

echo "📦 Uploading to $SERVER:$REMOTE_DIR ..."
scp -r dist/* $SERVER:$REMOTE_DIR/

echo "🔧 Setting permissions and reloading Nginx (you may be asked for sudo password)..."
ssh "$SERVER" "sudo sh -c 'chown -R www-data:www-data $REMOTE_DIR && nginx -t && systemctl reload nginx'"

echo ""
echo "✅ Dashboard deployed to VPS successfully!"
echo "🌐 https://www.onestopdaily.shop"

if [[ -t 1 && -z "${CI:-}" ]]; then
  echo ""
  read -rp "Press Enter to close..."
fi
