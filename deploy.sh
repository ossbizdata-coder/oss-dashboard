#!/bin/bash
# =============================================================================
# deploy.sh — Build, Commit/Push, and VPS Deploy
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR"
cd "$PROJECT_ROOT"

SERVER="sahan@74.208.132.78"
REMOTE_DIR="/var/www/oss-dashboard"
TMP_DIR="/home/sahan/oss-dashboard-deploy-tmp"
LIVE_URL="https://www.onestopdaily.shop/"
SSH_OPTS="-o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=3"

on_exit() {
    local status="$1"
    echo ""
    if [ "$status" -eq 0 ]; then
        echo "✅ Script finished successfully."
    else
        echo "❌ Script failed (exit code: $status)."
    fi
    if [ -t 0 ]; then
        echo ""
        read -r -p "Press Enter to close this window..."
    fi
}
trap 'on_exit $?' EXIT

if ! git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "❌ Must run inside git repository"
    exit 1
fi

for cmd in npm git ssh scp curl; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "❌ Missing required command: $cmd"
        exit 1
    fi
done

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "🚀 Deploying branch: $CURRENT_BRANCH"

echo "🔌 Checking SSH access..."
if ! ssh $SSH_OPTS "$SERVER" "echo OK" >/dev/null 2>&1; then
    echo "❌ Cannot connect/authenticate to $SERVER over SSH."
    echo "   Run this first and fix login: ssh $SERVER"
    exit 1
fi

echo "📦 Installing dependencies..."
npm ci --prefer-offline

echo "🔨 Building production bundle..."
npm run build

if [ ! -f "dist/index.html" ]; then
    echo "❌ Build output missing: dist/index.html"
    exit 1
fi

# Keep git add/commit/push as requested.
echo "📤 Committing and pushing..."
git add -A
if git diff-index --quiet HEAD --; then
    echo "ℹ️ No changes to commit"
else
    COMMIT_MSG="Auto-deploy: Dashboard updates $(date +'%Y-%m-%d %H:%M:%S')"
    git commit -m "$COMMIT_MSG" \
        -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
    git push
fi

echo "📡 Uploading build to VPS..."
ssh $SSH_OPTS "$SERVER" "mkdir -p '$TMP_DIR' && rm -rf '$TMP_DIR/dist'"
scp $SSH_OPTS -r dist "$SERVER:$TMP_DIR/"

echo "🔧 Deploying on VPS..."
ssh $SSH_OPTS "$SERVER" "
    set -euo pipefail
    test -f '$TMP_DIR/dist/index.html'
    sudo mkdir -p '$REMOTE_DIR'
    sudo rm -rf '$REMOTE_DIR'/*
    sudo cp -r '$TMP_DIR/dist/'* '$REMOTE_DIR/'
    sudo chown -R www-data:www-data '$REMOTE_DIR'
    sudo nginx -t
    sudo systemctl reload nginx
    rm -rf '$TMP_DIR'
"

echo "🧪 Smoke test..."
for attempt in 1 2 3 4 5; do
    if curl -sSf "$LIVE_URL" >/dev/null; then
        echo "✅ Deployment successful"
        echo "🌐 $LIVE_URL"
        echo "🌿 Branch: $CURRENT_BRANCH"
        echo "📝 Commit: $(git rev-parse --short HEAD)"
        break
    fi
    sleep 3
done

if ! curl -sSf "$LIVE_URL" >/dev/null; then
    echo "⚠️ Deploy finished, but smoke test did not confirm site response"
fi
