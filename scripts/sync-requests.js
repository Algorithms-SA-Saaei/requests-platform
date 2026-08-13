// مزامنة طلبات العملاء من ساعي — يُشغَّل بجدولة (cron/PM2) دوريًا، أو يدويًا.
// الاستخدام:  node scripts/sync-requests.js [--force]
//   بلا force: مزامنة تفاضلية خفيفة (تقف عند المعروف) + تجديد/وسم يومي حسب الجدولة.
//   --force:   سحب كامل + تجديد توكن + وسم فوري.
// جدولة مقترحة (PM2 cron أو crontab): كل 3 ساعات →  0 */3 * * *  node scripts/sync-requests.js
import mongoose from 'mongoose';
import { env } from '../src/config/environment.js';
import { logger } from '../src/utils/logger.js';
import { syncRequests, requestCounts } from '../src/services/saaeiRequests.service.js';

const force = process.argv.includes('--force');

async function main() {
  await mongoose.connect(env.mongoUri, { maxPoolSize: 5 });
  const result = await syncRequests({ force });
  const counts = await requestCounts();
  logger.info('sync-requests-done', { ...result, counts });
  console.log(JSON.stringify({ result, counts }, null, 2));
}

main()
  .catch((e) => { logger.error('sync-requests-failed', { error: e?.message }); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
