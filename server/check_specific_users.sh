#!/bin/bash
PW='sasu*9999'
DB=/var/lib/oss/data/oss.db
IDS=(6 26)
for id in "${IDS[@]}"; do
  echo "---USER $id---"
  echo "$PW" | sudo -S sqlite3 $DB "SELECT * FROM users WHERE id=$id;" || echo "(query failed)"
  echo "PRAGMA table_info('users'):"
  echo "$PW" | sudo -S sqlite3 $DB "PRAGMA table_info('users');" | sed -n '1,200p'
done
