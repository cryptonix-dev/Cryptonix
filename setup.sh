#!/usr/bin/env bash
# Usage: bash setup.sh <PUBLIC_IP> [REPO_DIR]
# Example: bash setup.sh 5.189.180.48 /root/Cryptonix

set -euo pipefail

IP="${1:-}"
REPO_DIR="${2:-$HOME/Cryptonix}"
if [[ -z "$IP" ]]; then
  echo "ERROR: Public IP required. Usage: bash setup.sh <PUBLIC_IP> [REPO_DIR]" >&2
  exit 1
fi

echo "[1/8] Ensure Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

echo "[2/8] Enter repo: $REPO_DIR"
if [[ ! -d "$REPO_DIR" ]]; then
  echo "ERROR: Repo dir not found: $REPO_DIR" >&2
  exit 1
fi
cd "$REPO_DIR"

echo "[3/8] Create docker-compose.override.yml (ports + Redis)"
cat > docker-compose.override.yml <<'YAML'
services:
  app:
    ports:
      - "3002:3000"
  websocket:
    ports:
      - "8081:8080"
  redis:
    image: redis:7
    restart: unless-stopped
    networks:
      - shared_backend
YAML

echo "[4/8] Update website/.env for public bind + Redis"
if [[ ! -f website/.env ]]; then
  echo "ERROR: website/.env not found. Create it first, then re-run." >&2
  exit 1
fi
sed -i 's/\r$//' website/.env || true
# remove existing keys we are setting
sed -i '/^HOST=/d;/^PUBLIC_BETTER_AUTH_URL=/d;/^PUBLIC_WEBSOCKET_URL=/d;/^REDIS_URL=/d' website/.env || true
cat >> website/.env <<EOF
HOST=0.0.0.0
PUBLIC_BETTER_AUTH_URL=http://$IP:3002
PUBLIC_WEBSOCKET_URL=ws://$IP:8081
REDIS_URL=redis://redis:6379
EOF

echo "[5/8] Create docker network (if missing)"
docker network create shared_backend >/dev/null 2>&1 || true

echo "[6/8] Build and start"
docker compose down || true
docker compose up -d --build

echo "[7/8] Open firewall (if UFW active)"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -qi active; then
  ufw allow 3002 || true
  ufw allow 8081 || true
fi

echo "[8/8] Verify"
docker compose ps
echo "App curl:"
curl -sS "http://$IP:3002" | head -c 200 || true
echo -e "\nWebSocket health:"
curl -sS "http://$IP:8081/health" || true

echo "Done. Open:"
echo "- App:        http://$IP:3002"
echo "- WebSocket:  http://$IP:8081/health"