#!/bin/bash
PW='sasu*9999'
echo "$PW" | sudo -S sqlite3 /var/lib/oss/data/oss.db "SELECT sql FROM sqlite_master WHERE name='attendance';"