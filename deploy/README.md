# نشر مرحاب على VPS

مسار الطلب النهائي — واحد واضح بلا تعارض (§73):

```
المستخدم → Cloudflare (DNS/Proxy/SSL) → Nginx :443 → Node.js :3000 (PM2 cluster)
                                                          ├─→ MongoDB (localhost)
                                                          ├─→ api.saaei.co
                                                          └─→ Firebase FCM
```

## الملفات

| الملف | الوظيفة | البند |
|---|---|---|
| `setup-vps.sh` | تهيئة السيرفر أول مرة: Node، مونجو، Nginx، PM2، جدار حماية، مستخدم التطبيق | §67، §68 |
| `deploy.sh` | نشر متكرر بأقل توقّف + تراجع تلقائي عند فشل فحص الصحة | §70، §71 |
| `backup-mongo.sh` | نسخ احتياطي **مع تحقّق فعلي بالاسترجاع** | §65 |
| `nginx/marhab.conf` | الموقع الرئيسي: SSL، حدود، ترويسات، توجيه | §39، §40، §46 |
| `nginx/marhab-proxy.conf` | إعدادات التمرير المشتركة + عنوان الزائر الحقيقي | §44، §50 |
| `nginx/marhab-upgrade-map.conf` | تعريف ترقية WebSocket على مستوى http | §39 |
| `../ecosystem.config.cjs` | PM2: عامل لكل نواة، إعادة تشغيل، إطفاء رشيق | §36، §37، §52 |

## الترتيب

```bash
# 1) على السيرفر لأول مرة
sudo bash deploy/setup-vps.sh          # ثم نفّذ الخطوات اليدوية الستّ التي يطبعها

# 2) الكود
sudo git clone <repo> /var/www/marhab && cd /var/www/marhab
sudo -u marhab cp .env.example .env    # عبّئ القيم ثم: chmod 600 .env

# 3) هجرة البيانات (مرة واحدة)
node scripts/migrate-from-d1.js dump.json --dry   # تجربة أولًا
node scripts/migrate-from-d1.js dump.json

# 4) التشغيل
pm2 start ecosystem.config.cjs --env production && pm2 save && pm2 startup

# 5) النشر بعدها
bash deploy/deploy.sh
```

## إعداد Cloudflare (§38-§43)
- سجل DNS لـ`kiosk.webnan.io` → عنوان الـVPS، **مع تفعيل الوكيل (السحابة البرتقالية)**.
- SSL/TLS: **Full (strict)** — ممنوع Flexible (§40).
- شهادة الأصل في `/etc/ssl/marhab/` (Cloudflare Origin Certificate أو Let's Encrypt).
- **لا تخزين مؤقت** لـ`/api/auth/*` و`/api/clients` و`/api/notifications/*` (§74).
- تحقّق أن الـWorker الحالي لا يعترض مسارات هذا النطاق (§73).

## قائمة ما قبل الإطلاق (§76)
- [ ] HTTPS يعمل وHTTP يعيد التوجيه
- [ ] مصادقة مونجو مفعّلة والمنفذ مغلق على localhost
- [ ] `JWT_SECRET` قوي (32 حرفًا فأكثر) و`.env` بصلاحية 600 وخارج git
- [ ] CORS محصور بالنطاق الحقيقي
- [ ] حدود المعدّل تعمل (تحقّق: عنوان الزائر الحقيقي يصل — لا عنوان Cloudflare)
- [ ] `/health/ready` يرجع `ready`
- [ ] النسخ الاحتياطي مجدول **واستُعيدت نسخة اختبارًا**
- [ ] اختبار حمل حقيقي 100 مستخدم متزامن على السيرفر
- [ ] الإشعارات تصل والتطبيق مغلق (§29)

## ملاحظات تشغيلية مُثبَتة محليًا
- **حارس الإعداد يعمل**: في وضع الإنتاج يرفض التطبيق الإقلاع إذا نقص `MONGODB_URI` أو `JWT_SECRET` أو `CORS_ORIGINS` بدل أن يعمل ناقصًا.
- **عزل الطلبات مؤكَّد عبر 10 عمّال**: 60 دخولًا متزامنًا بصفر تداخل — لا حالة مشتركة (§37).
- **كاش لكل عامل**: 10 عمّال = حتى 10 طلبات لساعي عند الكاش البارد (لا طلب واحد). محدود بعدد العمّال لا بعدد الطلبات. عند التوسّع لعدة خوادم انقل الكاش إلى Redis (§54).
- `deploy.sh` يستخدم `pm2 reload` لا `restart` — تبديل العمّال تدريجيًا فلا تسقط الطلبات الجارية (§71).
