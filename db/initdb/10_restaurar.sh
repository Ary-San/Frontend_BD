#!/bin/bash
# Se ejecuta una sola vez, cuando el volumen de datos está vacío.
# Crea los roles de PostgREST, restaura los cuatro dumps y aplica la capa api.
set -euo pipefail

psql -v ON_ERROR_STOP=1 -U postgres -d postgres -v pw="$AUTHENTICATOR_PASSWORD" <<'SQL'
CREATE ROLE web_anon NOLOGIN;
CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD :'pw';
GRANT web_anon TO authenticator;
ALTER ROLE authenticator SET timezone = 'America/Lima';
SQL

for s in 1k 10k 100k 1m; do
  echo ">> Restaurando ev_charge_$s"
  createdb -U postgres "ev_charge_$s"
  pg_restore --exit-on-error --no-owner --no-acl -U postgres -d "ev_charge_$s" "/dumps/ev_$s.dump"
  psql -v ON_ERROR_STOP=1 -q -U postgres -d "ev_charge_$s" -f /api/13_api.sql
  psql -v ON_ERROR_STOP=1 -q -U postgres -d "ev_charge_$s" -c 'ANALYZE'
done
echo ">> Cuatro escenarios listos"
