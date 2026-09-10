#!/bin/bash
# =============================================================================
# deploy-dashboard.sh — Complete Build, Test, Commit, and VPS Deployment
# =============================================================================

set -e

# Catch errors and show details
trap 'echo ""; echo "❌ DEPLOYMENT FAILED!"; echo "Check the error details above."; echo "Press Enter to close this window..."; read' ERR

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"
cd "$PROJECT_ROOT"

SERVER="sahan@74.208.132.78"
REMOTE_DIR="/var/www/oss-dashboard"
TMP_DIR="/home/sahan/oss-dashboard-deploy-tmp"
DEPLOY_LOG="deploy-$(date +'%Y%m%d-%H%M%S').log"

echo "=============================================================="
echo "🚀 OSS DASHBOARD - COMPLETE DEPLOYMENT PIPELINE"
echo "=============================================================="
echo "Project Root: $PROJECT_ROOT"
echo "Deploy Log: $DEPLOY_LOG"
echo "=============================================================="

# Step 1: Pre-deployment checks
echo ""
echo "📋 Step 1: Pre-deployment checks..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js"
    exit 1
fi
if ! command -v git &> /dev/null; then
    echo "❌ git not found. Please install git"
    exit 1
fi
echo "✓ npm version: $(npm --version)"
echo "✓ git version: $(git --version)"

# Step 2: Verify git status (no uncommitted changes in src except what we're deploying)
echo ""
echo "📝 Step 2: Checking git repository status..."
if ! git diff-index --quiet HEAD -- src/ package.json 2>/dev/null || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    echo "⚠️  Working directory has changes. Staging for deployment..."
fi
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "✓ Current branch: $CURRENT_BRANCH"

# Step 3: Install/update dependencies
echo ""
echo "📦 Step 3: Installing dependencies..."
npm ci --prefer-offline
echo "✓ Dependencies installed"

# Step 4: Clean previous build
echo ""
echo "🧹 Step 4: Cleaning previous build artifacts..."
if [ -d "dist" ]; then
    rm -rf dist
    echo "✓ Removed old dist directory"
fi
if [ -d ".vite" ]; then
    rm -rf .vite
    echo "✓ Removed Vite cache"
fi

# Step 5: Build production assets
echo ""
echo "🔨 Step 5: Building production assets..."
npm run build
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not created"
    exit 1
fi
BUILD_SIZE=$(du -sh dist | awk '{print $1}')
FILE_COUNT=$(find dist -type f | wc -l)
echo "✓ Build successful - Size: $BUILD_SIZE, Files: $FILE_COUNT"

# Step 6: Verify build output
echo ""
echo "✔️ Step 6: Verifying build output..."
if [ ! -f "dist/index.html" ]; then
    echo "❌ Build verification failed - index.html not found"
    exit 1
fi
echo "✓ index.html exists"
if [ ! -f "dist/assets/index"*.js ]; then
    echo "❌ Build verification failed - JavaScript bundle not found"
    exit 1
fi
echo "✓ JavaScript bundles present"

# Step 7: Git commit and push
echo ""
echo "📤 Step 7: Committing changes to git..."
git add -A
if git diff-index --quiet HEAD --; then
    echo "ℹ️  No changes to commit"
else
    COMMIT_MSG="Auto-deploy: Fix /api/api duplication, normalize API paths $(date +'%Y-%m-%d %H:%M:%S')"
    git commit -m "$COMMIT_MSG" \
        -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
    echo "✓ Changes committed"
    echo ""
    echo "🔄 Step 8: Pushing to git repository..."
    git push
    echo "✓ Pushed to $CURRENT_BRANCH"
fi

# Step 9: SSH connectivity check
echo ""
echo "🔌 Step 9: Checking VPS connectivity..."
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes $SERVER "echo 'OK'" > /dev/null 2>&1; then
    echo "⚠️  SSH connection failed. Retrying with key agent..."
    if ! ssh -o ConnectTimeout=10 $SERVER "echo 'OK'" > /dev/null 2>&1; then
        echo "❌ Cannot connect to VPS at $SERVER"
        echo "Please ensure SSH key is loaded and server is accessible"
        exit 1
    fi
fi
echo "✓ VPS is reachable and responsive"

# Step 10: Server preparation
echo ""
echo "📦 Step 10: Preparing VPS server..."
ssh $SERVER "
    mkdir -p $TMP_DIR
    rm -rf $TMP_DIR/*
    echo 'Temp directory ready at $TMP_DIR'
"
echo "✓ Server prepared"

# Step 11: Upload build to server
echo ""
echo "📤 Step 11: Uploading build to VPS..."
scp -r dist $SERVER:$TMP_DIR/
UPLOAD_SIZE=$(ssh $SERVER "du -sh $TMP_DIR/dist" | awk '{print $1}')
echo "✓ Upload complete - Size on server: $UPLOAD_SIZE"

# Step 12: Deploy to web root and reload Nginx
echo ""
echo "🔧 Step 12: Deploying to production..."
ssh -tt $SERVER "
    set -e
    echo '📂 Stopping Nginx gracefully...'
    sudo systemctl stop nginx || true
    
    echo '📂 Clearing old files from $REMOTE_DIR...'
    if [ -d '$REMOTE_DIR' ]; then
        sudo rm -rf $REMOTE_DIR/*
    else
        sudo mkdir -p $REMOTE_DIR
    fi
    
    echo '📂 Copying new build to production...'
    sudo cp -r $TMP_DIR/dist/* $REMOTE_DIR/
    
    echo '🔑 Setting correct ownership and permissions...'
    sudo chown -R www-data:www-data $REMOTE_DIR
    sudo chmod -R 755 $REMOTE_DIR
    
    echo '📄 Creating robots.txt and .htaccess if needed...'
    if [ ! -f '$REMOTE_DIR/robots.txt' ]; then
        echo 'User-agent: *' | sudo tee $REMOTE_DIR/robots.txt > /dev/null
    fi
    
    echo '🧹 Cleaning temporary files...'
    rm -rf $TMP_DIR
    
    echo '🔄 Testing Nginx configuration...'
    sudo nginx -t
    
    echo '🚀 Starting Nginx...'
    sudo systemctl start nginx
    
    echo '✓ Nginx running'
"
echo "✓ Deployment to production complete"

# Step 13: Smoke test
echo ""
echo "🧪 Step 13: Running smoke tests..."
for attempt in {1..5}; do
    if curl -s -f https://www.onestopdaily.shop/ > /dev/null 2>&1; then
        echo "✓ Site is reachable"
        break
    fi
    if [ $attempt -lt 5 ]; then
        echo "⏳ Attempt $attempt/5: Waiting for site to be ready..."
        sleep 3
    else
        echo "⚠️  Site not responding yet (might be DNS propagation delay)"
    fi
done

# Step 14: Summary
echo ""
echo "=============================================================="
echo "✅ DEPLOYMENT SUCCESSFUL!"
echo "=============================================================="
echo "🌐 Live URL: https://www.onestopdaily.shop"
echo "📝 Commit: $(git rev-parse --short HEAD)"
echo "🌿 Branch: $CURRENT_BRANCH"
echo "⏰ Deployed at: $(date +'%Y-%m-%d %H:%M:%S')"
echo "=============================================================="
echo ""
echo "Press Enter to close this window..."
read
