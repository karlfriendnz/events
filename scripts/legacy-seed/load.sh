#!/usr/bin/env bash
# Load a generated club seed into its own MySQL database (legacy fm_tmpl- schema).
# Usage: ./load.sh <dbname> <seed.sql>
set -euo pipefail
DB="$1"; SEED="$2"
C="fm-legacy"; MP="-uroot -pfmroot"
SCHEMA="/Users/karl/Desktop/Temp/fm_tmpl-.sql"

docker cp "$SCHEMA" $C:/tmp/tmpl.sql >/dev/null
docker cp "$SEED"   $C:/tmp/seed.sql >/dev/null
# resolve DEFINER (view + triggers) BEFORE loading the schema so the view builds
docker exec $C mysql $MP -e "CREATE USER IF NOT EXISTS 'fmsystem'@'%' IDENTIFIED BY 'x'; GRANT ALL ON *.* TO 'fmsystem'@'%';" 2>/dev/null
docker exec $C mysql $MP -e "DROP DATABASE IF EXISTS \`$DB\`; CREATE DATABASE \`$DB\`;" 2>/dev/null
docker exec $C sh -c "mysql $MP $DB < /tmp/tmpl.sql" 2>/dev/null
# drop the cross-db audit triggers so seed inserts don't try to write fm_system.PersonLog
docker exec $C mysql $MP "$DB" -e "DROP TRIGGER IF EXISTS Person_AFTER_INSERT; DROP TRIGGER IF EXISTS Person_AFTER_UPDATE;" 2>/dev/null
docker exec $C sh -c "mysql $MP $DB < /tmp/seed.sql" 2>&1 | grep -v "Using a password" || true
echo "loaded $SEED -> $DB"
