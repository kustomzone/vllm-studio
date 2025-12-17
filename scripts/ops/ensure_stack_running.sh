#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

LOG_DIR="${VLLMSTUDIO_LOG_DIR:-/tmp}"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

API_PORT="${VLLMSTUDIO_API_PORT:-8080}"
PROXY_PORT="${VLLMSTUDIO_PROXY_PORT:-8001}"
API_PORT="${VLLMSTUDIO_CONTROLLER_API_PORT:-${API_PORT}}"

CONTROLLER_CONFIG="${VLLMSTUDIO_CONTROLLER_CONFIG:-${ROOT_DIR}/config/controller.json}"
CONTROLLER_CONFIG_ARGS=()
if [ -f "${CONTROLLER_CONFIG}" ]; then
  CONTROLLER_CONFIG_ARGS=(--config "${CONTROLLER_CONFIG}")
fi

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

is_listening() {
  local port="$1"
  ss -lnt "sport = :$port" | tail -n +2 | rg -q ":$port"
}

ensure_api() {
  if curl -fsS "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then
    return 0
  fi

  log "Controller not healthy; starting vllmstudio_controller on :${API_PORT}"
  nohup env VLLMSTUDIO_CONTROLLER_API_PORT="${API_PORT}" python -m vllmstudio_controller.cli "${CONTROLLER_CONFIG_ARGS[@]}" \
    >"${LOG_DIR}/vllmstudio-controller.log" 2>&1 &
}

ensure_proxy() {
  if curl -fsS "http://localhost:${PROXY_PORT}/health" >/dev/null 2>&1; then
    return 0
  fi

log "Proxy not healthy; starting proxy on :${PROXY_PORT}"
  PROXY_AUTH="${VLLMSTUDIO_PROXY_AUTH_API_KEY:-${VLLMSTUDIO_CONTROLLER_ADMIN_KEY:-${VLLMSTUDIO_API_KEY:-}}}"
  nohup env AUTH_API_KEY="${PROXY_AUTH}" python -m uvicorn proxy.main:app --host 0.0.0.0 --port "${PROXY_PORT}" \
    >"${LOG_DIR}/vllmstudio-proxy.log" 2>&1 &
}

ensure_frontend() {
  if is_listening 3000; then
    return 0
  fi

if [ ! -d "$ROOT_DIR/frontend" ]; then
    log "frontend/ missing; skipping"
    return 0
  fi

  log "Frontend not listening; starting Next.js on :3000"
  (
    cd "$ROOT_DIR/frontend"
    export PORT=3000
    export BACKEND_URL="http://localhost:${API_PORT}"
    export NEXT_PUBLIC_API_URL="http://localhost:${API_PORT}"
    export API_KEY="${API_KEY:-${VLLMSTUDIO_CONTROLLER_ADMIN_KEY:-${VLLMSTUDIO_API_KEY:-}}}"

    if [ ! -f ".next/BUILD_ID" ]; then
      log "No Next.js build found; building frontend"
      npm run build >/dev/null
    fi

    nohup npm start >"${LOG_DIR}/vllmstudio-frontend.log" 2>&1 &
  )
}

ensure_cloudflared() {
  if docker ps --format '{{.Names}}' | rg -q '^cloudflared-homelabai$'; then
    return 0
  fi

  if [ ! -f "/home/ser/.cloudflared/config.docker.yml" ]; then
    log "Cloudflared config missing: /home/ser/.cloudflared/config.docker.yml (skipping)"
    return 0
  fi

  log "Cloudflared container not running; starting cloudflared-homelabai"
  docker rm -f cloudflared-homelabai >/dev/null 2>&1 || true
  docker run -d --name cloudflared-homelabai --restart unless-stopped --network host \
    --user "$(id -u):$(id -g)" \
    -v /home/ser/.cloudflared:/etc/cloudflared \
    cloudflare/cloudflared:latest \
    tunnel --config /etc/cloudflared/config.docker.yml run >/dev/null
}

ensure_cloudflared
ensure_api
ensure_proxy
ensure_frontend
