#!/bin/bash
# =============================================================================
# OneStopSolutions — VPS Setup Script
# Server: 74.208.132.78   Domain: www.onestopdaily.shop
# Run as root: bash setup-server.sh
# =============================================================================

set -e  # exit on any error

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     OneStopSolutions — VPS Setup Script              ║"
echo "║     Domain: www.onestopdaily.shop                    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─── STEP 1: Update system ──────────────────────────────────────────────────
echo "▶ [1/9] Updating system packages..."
apt update -y && apt upgrade -y

# ─── STEP 2: Install required tools ─────────────────────────────────────────
echo "▶ [2/9] Installing Nginx, Node.js, Certbot, Java..."
apt install -y nginx certbot python3-certbot-nginx curl ufw

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install Java 17 (if not already installed)
if ! java -version 2>&1 | grep -q "17"; then
    apt install -y openjdk-17-jdk
fi

echo "✅ Node: $(node -v)  |  Java: $(java -version 2>&1 | head -1)"

# ─── STEP 3: Firewall setup ──────────────────────────────────────────────────
echo "▶ [3/9] Configuring firewall..."
ufw allow 22/tcp     # SSH
ufw allow 80/tcp     # HTTP
ufw allow 443/tcp    # HTTPS
ufw deny 8080/tcp    # Block direct backend access (proxy only)
ufw --force enable
echo "✅ Firewall configured"

# ─── STEP 4: Create dashboard directory ──────────────────────────────────────
echo "▶ [4/9] Creating web directories..."
mkdir -p /var/www/oss-dashboard
chown -R www-data:www-data /var/www/oss-dashboard
mkdir -p /opt/oss
mkdir -p /var/lib/oss/data
chown -R root:root /var/lib/oss
echo "✅ Directories created"

# ─── STEP 5: Configure Nginx ─────────────────────────────────────────────────
echo "▶ [5/9] Configuring Nginx..."
cat > /etc/nginx/sites-available/onestopdaily << 'NGINX_EOF'
# Redirect bare domain → www
server {
    listen 80;
    listen [::]:80;
    server_name onestopdaily.shop;
    return 301 http://www.onestopdaily.shop$request_uri;
}

server {
    listen 80;
    listen [::]:80;
    server_name www.onestopdaily.shop;

    root /var/www/oss-dashboard;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass         http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Connection        "";
        client_max_body_size 20M;
        proxy_connect_timeout  60s;
        proxy_send_timeout     60s;
        proxy_read_timeout     60s;
    }

    location ~ ^/(hello|items|sales)(/.*)?$ {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
}
NGINX_EOF

# Enable site
ln -sf /etc/nginx/sites-available/onestopdaily /etc/nginx/sites-enabled/onestopdaily
rm -f /etc/nginx/sites-enabled/default

# Test and reload nginx
nginx -t
systemctl enable nginx
systemctl restart nginx
echo "✅ Nginx configured and running"

# ─── STEP 6: Set up systemd service for Spring Boot ──────────────────────────
echo "▶ [6/9] Setting up Spring Boot systemd service..."
cat > /etc/systemd/system/oss.service << 'SERVICE_EOF'
[Unit]
Description=OneStopSolutions Spring Boot App
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/oss
ExecStart=/usr/bin/java -jar /opt/oss/oss-1.0.0.jar
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=oss
Environment="SPRING_PROFILES_ACTIVE=production"

[Install]
WantedBy=multi-user.target
SERVICE_EOF

systemctl daemon-reload
systemctl enable oss.service
echo "✅ oss.service installed (start after deploying JAR)"

# ─── STEP 7: Set up automated database backup ────────────────────────────────
echo "▶ [7/9] Setting up automated backups..."
mkdir -p /backup/oss

cat > /usr/local/bin/backup-oss.sh << 'BACKUP_EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/oss"
mkdir -p $BACKUP_DIR
sqlite3 /var/lib/oss/data/oss.db ".backup /tmp/oss-backup-temp.db" 2>/dev/null || true
if [ -f /tmp/oss-backup-temp.db ]; then
    gzip -c /tmp/oss-backup-temp.db > $BACKUP_DIR/oss-$DATE.db.gz
    rm -f /tmp/oss-backup-temp.db
    echo "✅ Backup: oss-$DATE.db.gz"
fi
find $BACKUP_DIR -name "oss-*.db.gz" -mtime +7 -delete
BACKUP_EOF

chmod +x /usr/local/bin/backup-oss.sh
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-oss.sh >> /var/log/oss-backup.log 2>&1") | crontab -
echo "✅ Daily backup scheduled at 2 AM"

# ─── STEP 8: Placeholder dashboard ──────────────────────────────────────────
echo "▶ [8/9] Deploying placeholder dashboard page..."
cat > /var/www/oss-dashboard/index.html << 'HTML_EOF'
<!DOCTYPE html>
<html><head><title>OSS Dashboard</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a237e;color:white;text-align:center;}</style>
</head><body>
<div>
  <h1>🏪 OneStopSolutions Dashboard</h1>
  <p>Deployment in progress...</p>
  <p style="opacity:0.6;font-size:14px">www.onestopdaily.shop</p>
</div>
</body></html>
HTML_EOF
chown www-data:www-data /var/www/oss-dashboard/index.html
echo "✅ Placeholder page deployed"

# ─── STEP 9: Summary ─────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║              SETUP COMPLETE ✅                        ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Next Steps:                                          ║"
echo "║  1. Add DNS records in IONOS (see DEPLOYMENT.md)     ║"
echo "║  2. Deploy Spring Boot JAR to /opt/oss/              ║"
echo "║  3. Start backend: systemctl start oss               ║"
echo "║  4. Build & deploy dashboard (see DEPLOYMENT.md)     ║"
echo "║  5. Get SSL cert:                                     ║"
echo "║     certbot --nginx -d onestopdaily.shop             ║"
echo "║              -d www.onestopdaily.shop                 ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

