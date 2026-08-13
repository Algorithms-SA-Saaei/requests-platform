#!/usr/bin/env bash
# نشر متكرر بأقل توقّف (§70، §71)
# التسلسل: سحب ← تحقّق الإعداد ← npm ci ← فحص ← reload بلا انقطاع ← فحص صحة ← تراجع تلقائي عند الفشل
set -euo pipefail

APP_DIR=${APP_DIR:-/var/www/marhab}
APP_NAME=${APP_NAME:-marhab-api}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:3000/health/ready}
BRANCH=${BRANCH:-main}

cd "$APP_DIR"

echo "==> [1/7] النسخة الحالية"
PREVIOUS=$(git rev-parse HEAD)
echo "    $PREVIOUS"

echo "==> [2/7] سحب $BRANCH"
git fetch --all --quiet
git checkout "$BRANCH" --quiet
git pull --ff-only --quiet

echo "==> [3/7] التحقّق من متغيّرات البيئة"
[ -f .env ] || { echo "خطأ: ملف .env مفقود"; exit 1; }
for key in NODE_ENV MONGODB_URI JWT_SECRET CORS_ORIGINS SAAEI_API_URL; do
  grep -qE "^${key}=.+" .env || { echo "خطأ: ${key} مفقود أو فارغ في .env"; exit 1; }
done

echo "==> [4/7] الاعتماديات"
npm ci --omit=dev --silent

echo "==> [5/7] فحص الصياغة والاتصال بالقاعدة"
node --check server.js
node -e '
  import("mongoose").then(async ({default:m})=>{
    const uri=require("fs").readFileSync(".env","utf8").match(/^MONGODB_URI=(.*)$/m)[1].trim();
    await m.connect(uri,{serverSelectionTimeoutMS:5000});
    await m.connection.close(); console.log("    اتصال مونجو سليم");
    process.exit(0);
  }).catch(e=>{ console.error("    فشل اتصال مونجو:", e.message); process.exit(1); });
'

echo "==> [6/7] إعادة تحميل بلا انقطاع"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$APP_NAME" --update-env    # reload لا restart: يبدّل العمّال تدريجيًا فلا تسقط الطلبات
else
  pm2 start ecosystem.config.cjs --env production
fi
pm2 save --force

echo "==> [7/7] فحص الصحة"
OK=0
for i in $(seq 1 12); do
  sleep 2
  if curl -fsS --max-time 5 "$HEALTH_URL" | grep -q '"status":"ready"'; then OK=1; break; fi
  echo "    محاولة $i…"
done

if [ "$OK" -ne 1 ]; then
  echo "!! فشل فحص الصحة — تراجع تلقائي إلى $PREVIOUS"
  git reset --hard "$PREVIOUS" --quiet
  npm ci --omit=dev --silent
  pm2 reload "$APP_NAME" --update-env
  echo "!! تم التراجع. راجع: pm2 logs $APP_NAME --lines 100"
  exit 1
fi

echo "==> نجح النشر: $(git rev-parse --short HEAD)"
pm2 status "$APP_NAME"
