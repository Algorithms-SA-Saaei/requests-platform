#!/usr/bin/env bash
# نسخ احتياطي لمونجو مع تحقّق فعلي بالاسترجاع (§65)
# «نسخة لم تُختبر استعادتها لا تُعتبر موثوقة» — لذلك يستعيد السكربت كل نسخة إلى قاعدة مؤقتة ويقارن الأعداد.
#
#   sudo bash backup-mongo.sh            تشغيل نسخة الآن
#   sudo bash backup-mongo.sh --install  جدولة يومية 03:00
set -euo pipefail

BACKUP_DIR=${BACKUP_DIR:-/var/backups/marhab}
DB=${DB:-marhab}
RETENTION_DAYS=${RETENTION_DAYS:-14}
URI=${MONGODB_URI:-mongodb://127.0.0.1:27017}

if [ "${1:-}" = "--install" ]; then
  SELF=$(readlink -f "$0")
  ( crontab -l 2>/dev/null | grep -v "$SELF" ; echo "0 3 * * * bash $SELF >> /var/log/marhab/backup.log 2>&1" ) | crontab -
  echo "تمت الجدولة يوميًا 03:00 — السجل: /var/log/marhab/backup.log"
  exit 0
fi

STAMP=$(date +%Y%m%d-%H%M%S)
TARGET="$BACKUP_DIR/$STAMP"
mkdir -p "$TARGET"

echo "==> [1/4] أخذ النسخة"
mongodump --uri="$URI" --db="$DB" --out="$TARGET" --quiet

echo "==> [2/4] التحقّق بالاسترجاع الفعلي إلى قاعدة مؤقتة"
VERIFY_DB="${DB}_verify_$STAMP"
mongorestore --uri="$URI" --nsFrom="${DB}.*" --nsTo="${VERIFY_DB}.*" "$TARGET/$DB" --quiet

SRC=$(mongosh "$URI/$DB" --quiet --eval 'db.calls.countDocuments() + ":" + db.users.countDocuments()')
DST=$(mongosh "$URI/$VERIFY_DB" --quiet --eval 'db.calls.countDocuments() + ":" + db.users.countDocuments()')
mongosh "$URI/$VERIFY_DB" --quiet --eval 'db.dropDatabase()' >/dev/null

if [ "$SRC" != "$DST" ]; then
  echo "!! فشل التحقّق: الأصل($SRC) لا يطابق المستعاد($DST) — النسخة غير موثوقة"
  exit 1
fi
echo "    مطابقة تامة (مكالمات:مستخدمون = $SRC)"

echo "==> [3/4] ضغط"
tar -czf "$TARGET.tar.gz" -C "$BACKUP_DIR" "$STAMP" && rm -rf "$TARGET"

echo "==> [4/4] حذف ما تجاوز $RETENTION_DAYS يومًا"
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +"$RETENTION_DAYS" -delete

echo "تمت النسخة والتحقّق: $TARGET.tar.gz ($(du -h "$TARGET.tar.gz" | cut -f1))"
