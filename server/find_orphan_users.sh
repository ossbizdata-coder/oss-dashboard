#!/bin/bash
PW='sasu*9999'
DB=/var/lib/oss/data/oss.db

echo "Checking tables that declare user_id for orphan references..."
echo "$PW" | sudo -S sqlite3 $DB "SELECT name FROM sqlite_master WHERE type='table' AND lower(sql) LIKE '%user_id%';" | while read tbl; do
  tbl=$(echo "$tbl" | tr -d '\r')
  if [ -z "$tbl" ]; then continue; fi
  echo "--- $tbl ---"
  echo "$PW" | sudo -S sqlite3 $DB "SELECT DISTINCT user_id FROM $tbl WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users);"
done
