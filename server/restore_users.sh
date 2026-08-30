#!/bin/bash
PW='sasu*9999'
DB=/var/lib/oss/data/oss.db
MISSING=(6 8 24 26 46)
for id in "${MISSING[@]}"; do
  cnt=$(echo "$PW" | sudo -S sqlite3 $DB "SELECT count(*) FROM users WHERE id=$id;")
  if [ "$cnt" -eq "0" ]; then
    echo "$PW" | sudo -S sqlite3 $DB "INSERT INTO users (id, hourly_rate, name, role) VALUES ($id, 0.0, 'Restored User $id', 'STAFF');"
    echo "Inserted user $id"
  else
    echo "User $id already exists"
  fi
done
