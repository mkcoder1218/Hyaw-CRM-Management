#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/opt/hyaw-crm}"
REPO_URL="${REPO_URL:-https://github.com/mkcoder1218/Hyaw-CRM-Management.git}"

command -v docker >/dev/null 2>&1 || { echo "Docker is required"; exit 1; }
command -v nginx >/dev/null 2>&1 || { echo "Nginx is required"; exit 1; }

sudo mkdir -p "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo git clone "$REPO_URL" "$APP_DIR"
fi
sudo chown -R "$USER":"$USER" "$APP_DIR"

sudo cp "$APP_DIR/infra/nginx/hyaw-crm.conf" /etc/nginx/sites-available/hyaw-crm
sudo ln -sf /etc/nginx/sites-available/hyaw-crm /etc/nginx/sites-enabled/hyaw-crm
sudo nginx -t
sudo systemctl reload nginx

echo "Create $APP_DIR/.env.production, then run:"
echo "cd $APP_DIR && docker compose -f docker-compose.prod.yml up -d --build"
echo "After DNS points to this VPS, enable TLS:"
echo "sudo certbot --nginx -d CRM.hyaw.tech -d adminCRM.hyaw.tech -d apiCRM.hyaw.tech"
