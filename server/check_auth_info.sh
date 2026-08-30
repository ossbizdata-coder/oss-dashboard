#!/bin/bash
PW='sasu*9999'
DB=/var/lib/oss/data/oss.db

echo "===ADMINS / MANAGERS==="
echo "$PW" | sudo -S sqlite3 $DB "SELECT id,name,role FROM users WHERE lower(role) LIKE '%admin%' OR lower(role) LIKE '%manager%' ORDER BY id;" || true

echo "\n===USERS WITH PASSWORD (sample)==="
echo "$PW" | sudo -S sqlite3 $DB "SELECT id,name,password,role FROM users WHERE password IS NOT NULL AND password!='' LIMIT 20;" || true

echo "\n===EXTRACT AND SEARCH JAR FOR 'login' and 'auth' STRINGS (first matches)==="
echo "$PW" | sudo -S mkdir -p /tmp/inspect || true
cd /tmp/inspect || exit 0
# extract classes (no overwrite)
echo "$PW" | sudo -S jar xf /opt/oss/oss-1.0.0.jar BOOT-INF/classes || true
# search
echo "$PW" | sudo -S bash -c "grep -a -i 'login' BOOT-INF/classes -R | sed -n '1,200p'" || true
echo "---"
echo "$PW" | sudo -S bash -c "grep -a -i '/auth' BOOT-INF/classes -R | sed -n '1,200p'" || true

echo "\n===END==="