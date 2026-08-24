# منصة الطلبات — Saaei Requests Platform

خدمة **Node.js + Express + MongoDB** تربط طلبات عملاء ساعي بأنسب العقارات وتعرضها للفريق. مبنية بمعمارية ساعي الموحّدة (نفس نمط طبقة مرحاب: خدمة خارجية صامدة، JWT عديم الحالة، helmet/CORS/حدود معدّل، سجل مُهيكل، `/health`).

## ما تفعله
- تسحب طلبات عملاء ساعي (`GET /requests`) وتخزّنها في `ClientRequest`.
- تصنّفها تمامًا كما في ساعي: **مطابَق** (`hasSuggestedAdvertisements=true`) · **غير مطابَق / فرصة** (`=false`) · **غير محدَّد** (`null`).
- تطبّع الأنواع والأحياء من الإنجليزية للعربية (`Apartment→شقة`, `An Narjis→النرجس`).
- لكل طلب: تقترح أنسب العقارات من مخزون `Property` بدرجة تطابق ٠–١٠٠٪.

## قيود ساعي المطبَّقة (متطلبات مدير الآيتي)
- **حجم الصفحة 20** لكل نداء (لا 200) — `PAGE=20`.
- **مزامنة تفاضلية**: تقف عند أول صفحة كلها معروفة → لا تُثقل خادم ساعي.
- **تجديد التوكن يوميًا** عبر `PUT /refreshToken` (JWT عمره 7 أيام يُخزَّن في `AppState` ويتدحرج)، والوسم مرة يوميًا.

## التشغيل المحلي
```bash
brew services start mongodb-community        # أو: docker run -d -p 27017:27017 mongo
cp .env.example .env                         # اضبط JWT_SECRET (32+) وSAAEI_API_TOKEN (بذرة)
npm ci
npm run seed                                 # مستخدمو التطوير (admin/manager/agent — SEED_PASSWORD)
npm start                                    # الخادم على PORT (افتراضي 3000)
```

## الفحص والمزامنة
```bash
npm run verify                               # فحص وحدة (دوال نقية، بلا قاعدة/شبكة) — 11 فحصًا
node scripts/sync-requests.js                # مزامنة تفاضلية (جدولة PM2/cron كل 3 ساعات)
node scripts/sync-requests.js --force        # سحب كامل + تجديد توكن + وسم فوري
node scripts/import-properties.js data.json --source market   # تعبئة مخزون المطابقة
```
جدولة مقترحة (PM2 cron أو crontab): `0 */3 * * * node scripts/sync-requests.js`

## المسارات
| المسار | الوصف |
|---|---|
| `GET /health` · `GET /health/ready` | فحص الصحة والجاهزية |
| `POST /api/auth/login` · `GET /api/auth/me` · `POST /api/auth/logout` | المصادقة (JWT) |
| `GET /api/requests?tab=all\|matched\|unmatched\|unknown&page=&limit=` | قائمة الطلبات (تبويبات + ترقيم + عدّادات) |
| `GET /api/requests/:id/matches?limit=` | أنسب العقارات لطلب |
| `POST /api/requests/sync` | مزامنة كاملة فورية (admin/manager) |

## قرار مفتوح لفريق ساعي — مصدر مخزون المطابقة
المطابقة تعمل على مجموعة `Property`. مصدرها يحسمه فريق ساعي:
1. **إعلانات ساعي** (`theAds`) — يحتاج تأكيد بنية endpoint الوحدات (نداء `/theAds/{projectId}` أرجع خطأ؛ يبدو أنه يتطلب معرّف مبنى). لم نشحن كودًا يستدعي endpoint غير مؤكَّد.
2. **تصدير من منصة تحليل السوق** — عبر `scripts/import-properties.js` (idempotent، upsert على `source+sourceId`).

فور تعبئة `Property` من أي مصدر، تعمل المطابقة والمسارات فورًا بلا تغيير.

## واجهة الويب (Frontend)
صفحات HTML مُخدَّمة من الخادم بهوية ساعي (بلا إطار خارجي — تعمل مباشرة):
| المسار | الوصف |
|---|---|
| `GET /login` · `POST /login` · `GET /logout` | صفحة الدخول (اسم مستخدم + كلمة مرور) |
| `GET /` | لوحة الطلبات: تبويبات (الكل/غير مطابَقة/مطابَقة/غير محدَّدة) + قائمة + ترقيم + زر مزامنة (admin/manager) |
| `GET /r/:id` | تفاصيل الطلب + بطاقات العقارات المناسبة بنسبة تطابق |
الدخول ببيانات `npm run seed` (admin/manager/agent). واجهة البيانات `/api/*` تبقى JSON للتكاملات.

## سحب السوق (تعبئة مخزون المطابقة)
سحّابات Node نقية (بلا متصفح) تملأ مجموعة `Property` التي تعمل عليها المطابقة:
- **بيوت** (Algolia API) — شامل، تقسيم سعري لتجاوز حد 1000.
- **عقار** (RSC) — صفحة أولى لكل حي×تصنيف.
```bash
node scripts/crawl-market.js                 # بيوت + عقار → Property
node scripts/crawl-market.js --sources bayut # مصدر محدد
```
جدولة: `0 4 * * * node scripts/crawl-market.js`. مسار إداري: `POST /api/requests/crawl` · حالة المخزون: `GET /api/inventory`.
الملفات: `src/services/crawl.service.js` + `src/services/crawlers/{bayut,aqar}.crawler.js`.

## البنية
```
server.js · src/app.js
src/config/{environment,database}.js
src/middleware/{auth,error,rateLimit,requestId}.middleware.js
src/models/{User,AuditLog,ClientRequest,Property,AppState}.js
src/services/{saaeiToken,saaeiRequests,matching}.service.js
src/controllers/{auth,requests,web}.controller.js · src/routes/{index,web}.js
src/utils/{errors,logger,response}.js
scripts/{seed,sync-requests,import-properties,verify-requests}.js
deploy/  (Nginx · PM2 · إعداد VPS · نسخ احتياطي)
```

## النشر
ملفات النشر في `deploy/` (Nginx، PM2، تهيئة السيرفر، النسخ الاحتياطي). عدّل أسماء الخدمة/الدومين حسب بيئتكم.
