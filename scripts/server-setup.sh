#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root"
  exit 1
fi

APP_DIR="/opt/aquaworld"
REPO_URL="git@github.com:YOUR_ORG/YOUR_REPO.git"

apt update
apt -y upgrade
apt -y install ca-certificates curl gnupg lsb-release ufw fail2ban git nginx certbot python3-certbot-nginx

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

systemctl enable fail2ban
systemctl restart fail2ban

mkdir -p "${APP_DIR}"/{backups,logs,uploads,nginx/sites,scripts}

if [[ ! -d "${APP_DIR}/.git" ]]; then
  git clone "${REPO_URL}" "${APP_DIR}"
fi

chmod +x "${APP_DIR}/scripts/backup.sh" "${APP_DIR}/scripts/restore.sh" || true

if ! crontab -l 2>/dev/null | grep -q '/opt/aquaworld/scripts/backup.sh'; then
  (crontab -l 2>/dev/null; echo "0 2 * * * /opt/aquaworld/scripts/backup.sh >> /opt/aquaworld/logs/backup.log 2>&1") | crontab -
fi

echo "Run certbot after DNS is pointed:"
echo "certbot --nginx -d your-domain.com -d www.your-domain.com"

echo "Server setup complete."
