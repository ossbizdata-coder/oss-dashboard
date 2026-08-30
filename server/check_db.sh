#!/bin/bash
PW='sasu*9999'

echo "$PW" | sudo -S stat -c "%n %s %y" /var/lib/oss/data/oss.db 2>/dev/null || echo DB-MISSING

echo "===TABLES==="
echo "$PW" | sudo -S sqlite3 /var/lib/oss/data/oss.db "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" || echo SQLITE-ERR

echo "===USER6==="
echo "$PW" | sudo -S sqlite3 /var/lib/oss/data/oss.db "SELECT * FROM users WHERE id=6;" || echo USER-QUERY-ERR

echo "===USERS-COUNT==="
echo "$PW" | sudo -S sqlite3 /var/lib/oss/data/oss.db "SELECT count(*) FROM users;" || echo COUNT-ERR
