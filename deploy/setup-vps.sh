#!/usr/bin/env bash
# تهيئة السيرفر لأول مرة (§67، §68، §69) — Ubuntu LTS
# التشغيل: sudo bash setup-vps.sh
# يُنفَّذ مرة واحدة. النشر المتكرر عبر deploy.sh
set -euo pipefail

APP_DIR=/var/www/marhab
LOG_DIR=/var/log/marhab
APP_USER=marhab

echo "==> تحديث النظام"
apt-get update -qq && apt-get upgrade -y -qq

echo "==> Node.js LTS"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> MongoDB"
if ! command -v mongod >/dev/null 2>&1; then
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb.gpg --dearmor
  echo "deb [signed-by=/usr/share/keyrings/mongodb.gpg] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-7.0.list
  apt-get update -qq && apt-get install -y mongodb-org
fi
systemctl enable --now mongod

echo "==> Nginx + أدوات"
apt-get install -y nginx ufw git curl

echo "==> PM2 وتدوير السجلّات"
npm install -g pm2
pm2 install pm2-logrotate || true
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true

echo "==> مستخدم التطبيق والمجلدات"
id -u "$APP_USER" >/dev/null 2>&1 || useradd -r -s /bin/bash -d "$APP_DIR" "$APP_USER"
mkdir -p "$APP_DIR" "$LOG_DIR" /etc/ssl/marhab /var/www/certbot
chown -R "$APP_USER":"$APP_USER" "$APP_DIR" "$LOG_DIR"

echo "==> جدار الحماية: 22 و80 و443 فقط (§68)"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose

echo "==> تأمين مونجو: الاستماع على localhost فقط (§68، §69)"
if ! grep -q "bindIp: 127.0.0.1" /etc/mongod.conf; then
  sed -i 's/^  bindIp:.*/  bindIp: 127.0.0.1/' /etc/mongod.conf
fi
# تفعيل المصادقة — يتطلب إنشاء المستخدم أولًا (الخطوة التالية) ثم إعادة التشغيل
cat <<'NOTE'

--------------------------------------------------------------------
خطوات يدوية متبقية (لا يمكن أتمتتها بأمان — تحتاج كلمات سرّك):

1) أنشئ مستخدم قاعدة البيانات بأقل صلاحية (§69):
   mongosh
   use admin
   db.createUser({ user:"marhabAdmin", pwd:"<كلمة قوية>", roles:[{role:"userAdminAnyDatabase",db:"admin"}] })
   use marhab
   db.createUser({ user:"marhabApp", pwd:"<كلمة قوية>", roles:[{role:"readWrite",db:"marhab"}] })

2) فعّل المصادقة:
   sudo sed -i 's/^#security:/security:\n  authorization: enabled/' /etc/mongod.conf
   sudo systemctl restart mongod

3) ضع شهادة الأصل (§40):
   /etc/ssl/marhab/origin.pem  و  /etc/ssl/marhab/origin.key
   (Cloudflare Origin Certificate — ثم اضبط SSL/TLS على Full (strict))

4) ركّب إعدادات Nginx:
   sudo cp deploy/nginx/marhab-upgrade-map.conf /etc/nginx/conf.d/
   sudo mkdir -p /etc/nginx/snippets
   sudo cp deploy/nginx/marhab-proxy.conf /etc/nginx/snippets/
   sudo cp deploy/nginx/marhab.conf /etc/nginx/sites-available/marhab
   sudo ln -sf /etc/nginx/sites-available/marhab /etc/nginx/sites-enabled/marhab
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t && sudo systemctl reload nginx

5) عبّئ /var/www/marhab/.env من .env.example (وMONGODB_URI بمستخدم marhabApp)

6) فعّل النسخ الاحتياطي: sudo bash deploy/backup-mongo.sh --install
--------------------------------------------------------------------
NOTE
