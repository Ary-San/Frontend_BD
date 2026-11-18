#!/bin/bash
# Devuelve un escenario al estado de su dump (deshace lo que escribió la pantalla Operación).
# Uso: docker compose exec db bash /api/restaurar.sh 1k      (1k | 10k | 100k | 1m)
set -euo pipefail
s="${1:-}"
case "$s" in 1k|10k|100k|1m) ;; *) echo "Uso: restaurar.sh 1k|10k|100k|1m" >&2; exit 1 ;; esac

db="ev_charge_$s"
echo ">> Restaurando $db desde /dumps/ev_$s.dump"
# WITH (FORCE) corta las conexiones de PostgREST; PostgREST se reconecta solo.
psql -v ON_ERROR_STOP=1 -q -U postgres -d postgres -c "DROP DATABASE IF EXISTS $db WITH (FORCE)"
createdb -U postgres "$db"
pg_restore --exit-on-error --no-owner --no-acl -U postgres -d "$db" "/dumps/ev_$s.dump"
psql -v ON_ERROR_STOP=1 -q -U postgres -d "$db" -f /api/13_api.sql
psql -v ON_ERROR_STOP=1 -q -U postgres -d "$db" -c 'ANALYZE'
echo ">> $db listo"
