#!/bin/bash
PW='sasu*9999'
DB=/var/lib/oss/data/oss.db

echo "$PW" | sudo -S sqlite3 $DB <<'SQL'
BEGIN TRANSACTION;
CREATE TABLE attendance_new (
  id bigint,
  deduction_hours float,
  deduction_reason TEXT,
  is_working boolean not null,
  overtime_hours float,
  overtime_reason TEXT,
  status varchar(255) not null check (status in ('CHECKED_IN','COMPLETED','WORKING','NOT_WORKING')),
  work_date bigint not null,
  user_id bigint not null,
  primary key (id)
);
INSERT INTO attendance_new SELECT * FROM attendance;
DROP TABLE attendance;
ALTER TABLE attendance_new RENAME TO attendance;
COMMIT;
SQL

echo "attendance table recreated with bigint id"
