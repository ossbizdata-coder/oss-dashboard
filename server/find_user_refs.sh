#!/bin/bash
PW='sasu*9999'
DB=/var/lib/oss/data/oss.db

echo "Tables with 'user' in schema:"
echo "$PW" | sudo -S sqlite3 $DB "SELECT name, sql FROM sqlite_master WHERE type='table' AND lower(sql) LIKE '%user%';"

echo "\nCounts of rows referencing user_id=6 (where column named user_id):"
echo "$PW" | sudo -S sqlite3 $DB "SELECT tbl_name, sql FROM sqlite_master WHERE type='table' AND lower(sql) LIKE '%user_id%';" | while read -r tbl sql; do
  name=$(echo "$tbl" | tr -d '\r')
  echo "--- $name ---"
  echo "$PW" | sudo -S sqlite3 $DB "SELECT count(*) FROM $name WHERE user_id=6;" || true
done

echo "\nCheck specific common tables: foodhut_sales, shop_transactions, cash_transactions"
echo "$PW" | sudo -S sqlite3 $DB "SELECT count(*) FROM foodhut_sales WHERE user_id=6;" || true
echo "$PW" | sudo -S sqlite3 $DB "SELECT count(*) FROM shop_transactions WHERE user_id=6;" || true
echo "$PW" | sudo -S sqlite3 $DB "SELECT count(*) FROM cash_transactions WHERE user_id=6;" || true
