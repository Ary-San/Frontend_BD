#!/bin/bash
# Reaplica 13_api.sql en las cuatro bases sin restaurar los dumps.
# Uso: docker compose exec db bash /api/aplicar_api.sh
set -euo pipefail
for s in 1k 10k 100k 1m; do
  echo ">> ev_charge_$s"
  psql -v ON_ERROR_STOP=1 -q -U postgres -d "ev_charge_$s" -f /api/13_api.sql
done
