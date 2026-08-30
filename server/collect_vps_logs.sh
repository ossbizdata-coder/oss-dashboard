#!/bin/bash
PW='sasu*9999'
OUTFILE=/tmp/oss_logs_$(date +%s).txt
exec > /tmp/oss_logs_collected.txt 2>&1

echo "=== HOST ==="
uname -a

echo "\n=== OSS SERVICE STATUS ==="
echo "$PW" | sudo -S systemctl status oss --no-pager || true

echo "\n=== OSS JOURNAL (last 500 lines) ==="
echo "$PW" | sudo -S journalctl -u oss -n 500 --no-pager -o cat || true

echo "\n=== NGINX STATUS ==="
echo "$PW" | sudo -S systemctl status nginx --no-pager || true

echo "\n=== NGINX JOURNAL (last 200 lines) ==="
echo "$PW" | sudo -S journalctl -u nginx -n 200 --no-pager -o cat || true

echo "\n=== /var/log/nginx/error.log (tail 200) ==="
echo "$PW" | sudo -S sh -c 'if [ -f /var/log/nginx/error.log ]; then tail -n 200 /var/log/nginx/error.log; else echo "(no /var/log/nginx/error.log)"; fi' || true

echo "\n=== /var/log/nginx/access.log (tail 200) ==="
echo "$PW" | sudo -S sh -c 'if [ -f /var/log/nginx/access.log ]; then tail -n 200 /var/log/nginx/access.log; else echo "(no /var/log/nginx/access.log)"; fi' || true

echo "\n=== /var/log/syslog (tail 200) ==="
echo "$PW" | sudo -S sh -c 'if [ -f /var/log/syslog ]; then tail -n 200 /var/log/syslog; else echo "(no /var/log/syslog)"; fi' || true

echo "\n=== /var/log/messages (tail 200) ==="
echo "$PW" | sudo -S sh -c 'if [ -f /var/log/messages ]; then tail -n 200 /var/log/messages; else echo "(no /var/log/messages)"; fi' || true

echo "\n=== LISTENING PORTS ==="
echo "$PW" | sudo -S ss -ltnp || true

echo "\n=== /var/lib/oss/data — files ==="
echo "$PW" | sudo -S ls -la /var/lib/oss/data || true

echo "\n=== END ==="

# Print path of collected file
echo "COLLECTED_FILE=/tmp/oss_logs_collected.txt" 
