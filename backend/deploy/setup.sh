#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# FirmDesk — Oracle Cloud Always Free (A1.Flex, 2 OCPU, 12 GB) server setup
# ─────────────────────────────────────────────────────────────────────────────
# Usage:
#   cd /opt/firmdesk
#   ./deploy/setup.sh jvaccounting.in [certbot-email]
#
# Prerequisites (transferred to /opt/firmdesk by the README steps):
#   backend:  dist/  package.json  package-lock.json  deploy/  .env
#   frontend: frontend/dist/  (the Vite web build)
# ─────────────────────────────────────────────────────────────────────────────

DOMAIN="${1:-jvaccounting.in}"
EMAIL="${2:-admin@${DOMAIN}}"
APP_DIR="/opt/firmdesk"
NODE_VERSION="22"

# ── Pre-flight checks ───────────────────────────────────────────────────────

if [ "$PWD" != "$APP_DIR" ]; then
  echo "Run this from ${APP_DIR}: cd ${APP_DIR} && ./deploy/setup.sh ${DOMAIN} [email]" >&2
  exit 1
fi

for required in package.json dist/src/server.js deploy/nginx/firmdesk.conf deploy/ecosystem.config.cjs; do
  if [ ! -e "$required" ]; then
    echo "Missing ${required} under ${APP_DIR}. Follow the README transfer steps first." >&2
    exit 1
  fi
done

if [ ! -d "frontend/dist" ]; then
  echo "Missing ${APP_DIR}/frontend/dist/. Build the frontend (npm run build:web) and transfer it first." >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "Missing ${APP_DIR}/.env. Copy your production environment file first (README step 3)." >&2
  exit 1
fi

# ── System setup ─────────────────────────────────────────────────────────────

echo "==> Updating system packages"
sudo apt update && sudo apt upgrade -y

# Swap — prevents OOM during npm ci on a 12 GB VM (safe to skip if swap exists)
if ! swapon --show | grep -q '/swapfile'; then
  echo "==> Creating 2 GB swap file (prevents OOM during builds)"
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
else
  echo "==> Swap already active, skipping"
fi

echo "==> Installing Node.js ${NODE_VERSION}"
curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | sudo -E bash -
sudo apt install -y nodejs git nginx certbot python3-certbot-nginx

echo "==> Installing PM2 globally"
sudo npm install -g pm2

echo "==> Creating log directory"
sudo mkdir -p /var/log/firmdesk
sudo chown "$USER:$USER" /var/log/firmdesk

echo "==> Installing production dependencies"
npm ci --omit=dev 2>/dev/null || npm install --omit=dev

echo "==> Checking MongoDB"
if ! systemctl is-active --quiet mongod 2>/dev/null; then
  echo "    INFO: mongod is not running on this host."
  echo "    Using MongoDB Atlas? Make sure MONGODB_URI in .env points to your Atlas cluster."
  echo "    Self-hosting? Install MongoDB 8.0: https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/"
fi

# ── Automatic security updates ──────────────────────────────────────────────

echo "==> Enabling unattended security upgrades"
sudo apt install -y unattended-upgrades
echo 'APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";' | sudo tee /etc/apt/apt.conf.d/20auto-upgrades > /dev/null

# ── SSL certificate (two-phase: HTTP first, then full HTTPS config) ──────────

# Phase 1: a plain HTTP config so certbot can answer the ACME challenge.
# The production config references cert files that don't exist until certbot runs.
echo "==> Installing temporary HTTP config for certificate issuance"
sudo tee /etc/nginx/sites-available/firmdesk >/dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
    location / {
        root /opt/firmdesk/frontend/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/firmdesk /etc/nginx/sites-enabled/firmdesk
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "==> Obtaining SSL certificate for ${DOMAIN} (certbot email: ${EMAIL})"
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL"

# Phase 2: certificates now exist, deploy the full production config.
echo "==> Installing production nginx config"
sudo cp deploy/nginx/firmdesk.conf /etc/nginx/sites-available/firmdesk
sudo sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" /etc/nginx/sites-available/firmdesk
sudo nginx -t && sudo systemctl reload nginx

# ── Application ──────────────────────────────────────────────────────────────

echo "==> Starting application with PM2"
pm2 start deploy/ecosystem.config.cjs
pm2 save
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME"

# ── Firewall ─────────────────────────────────────────────────────────────────

echo "==> Configuring UFW firewall"
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow OpenSSH
sudo ufw --force enable || true

# Oracle Cloud VMs also use iptables rules managed by the OS. These are
# separate from OCI Security Lists and must also allow HTTP/HTTPS.
echo "==> Opening Oracle Cloud iptables ports"
if sudo iptables -L INPUT -n --line-numbers 2>/dev/null | grep -q "state NEW"; then
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
  if command -v netfilter-persistent &>/dev/null; then
    sudo netfilter-persistent save
  else
    sudo apt install -y iptables-persistent
    sudo netfilter-persistent save
  fi
else
  echo "    iptables rules not in Oracle default format — skipping (UFW should handle it)"
fi

# ── Optional health-check cron ───────────────────────────────────────────────
# Oracle may reclaim idle Always Free instances based on its own utilization
# criteria. This cron is NOT a guaranteed way to prevent reclaim — Oracle's
# policy is outside your control. It is useful as a basic liveness check.
echo "==> Installing periodic health-check cron (liveness, not anti-reclaim)"
(crontab -l 2>/dev/null | grep -v 'firmdesk-healthcheck' || true; \
  echo "0 */6 * * * curl -sf http://localhost:4000/api/v1/health > /dev/null 2>&1 # firmdesk-healthcheck") | crontab -

# ── SSH hardening ────────────────────────────────────────────────────────────

echo "==> Hardening SSH (disabling password auth)"
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "==> Deployment complete!"
echo "    App running at:  https://${DOMAIN}"
echo "    PM2 status:      pm2 status"
echo "    Logs:            pm2 logs firmdesk"
echo "    Restart:         pm2 restart firmdesk"
echo ""
echo "    IMPORTANT: Add ingress rules in OCI Console > Networking > Security Lists"
echo "    for TCP 80 and TCP 443 if not already done."
