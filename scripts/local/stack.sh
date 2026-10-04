#!/usr/bin/env bash
# Production-like local stack: same images and production config as a real cell, on one machine.
#   scripts/local/stack.sh up | seed | test | status | logs [svc] | down | reset
set -euo pipefail
cd "$(dirname "$0")/../.."
HTTP_PORT="${LS_HTTP_PORT:-8088}"
compose() { docker compose --profile stack "$@"; }

wait_healthy() {
  local deadline=$((SECONDS + ${1:-600}))
  local services=(postgres kafka keycloak tenant-registry catalog gateway web-storefront)
  for s in "${services[@]}"; do
    printf '  %-18s' "$s"
    until [ "$(docker inspect -f '{{.State.Health.Status}}' "$(compose ps -q "$s")" 2>/dev/null)" = healthy ]; do
      if (( SECONDS > deadline )); then echo "TIMEOUT"; compose logs --tail 40 "$s"; exit 1; fi
      sleep 3
    done
    echo healthy
  done
}

case "${1:-up}" in
  up)
    command -v pnpm >/dev/null && pnpm --filter @lightshop/api-sdk build >/dev/null  # used by the seeder
    compose up -d --build --remove-orphans
    echo "waiting for services:"; wait_healthy
    compose up seed --no-log-prefix
    cat <<INFO

LightShop is running in production mode:
  Acme Mart (B2C)          http://acme.localhost:${HTTP_PORT}
  Verde Wholesale (B2B)    http://verde.localhost:${HTTP_PORT}
  Sign in                  ana / ana · raj / raj (Keycloak http://localhost:${LS_KEYCLOAK_PORT:-8180}, admin/admin)
  Grafana                  http://localhost:${LS_GRAFANA_PORT:-3001}
  Temporal UI              http://localhost:${LS_TEMPORAL_UI_PORT:-8233}
INFO
    ;;
  seed) compose up seed --no-log-prefix ;;
  test) pnpm --filter @lightshop/web-storefront exec playwright test -c playwright.stack.config.ts "${@:2}" ;;
  status) compose ps --format 'table {{.Service}}\t{{.Status}}' ;;
  logs) compose logs -f --tail 100 "${@:2}" ;;
  down) compose down ;;
  reset) compose down -v ;;
  *) echo "usage: $0 up|seed|test|status|logs [svc]|down|reset"; exit 1 ;;
esac
