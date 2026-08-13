// نقطة التشغيل — تحقّق الإعداد، اتصال القاعدة، ثم إطفاء رشيق (§52)
import { createApp } from './src/app.js';
import { env, assertProductionConfig } from './src/config/environment.js';
import { connectDatabase, disconnectDatabase } from './src/config/database.js';
import { initFirebase } from './src/services/firebase.service.js';
import { logger } from './src/utils/logger.js';

const missing = assertProductionConfig();
if (missing.length) {
  logger.error('config-missing', { missing });
  process.exit(1);
}

await connectDatabase();
initFirebase(); // غياب إعداد Firebase لا يمنع الإقلاع — تُعطَّل الإشعارات فقط

const app = createApp();
const server = app.listen(env.port, () => logger.info('server-started', { port: env.port, env: env.nodeEnv }));

// إطفاء رشيق: نتوقّف عن قبول الجديد، ننهي الجاري، نغلق القاعدة، ثم نخرج (§52)
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('shutdown-start', { signal });
  const force = setTimeout(() => { logger.error('shutdown-forced'); process.exit(1); }, 15000);
  server.close(async () => {
    try { await disconnectDatabase(); } catch (e) { logger.error('shutdown-db', { error: e?.message }); }
    clearTimeout(force);
    logger.info('shutdown-complete');
    process.exit(0);
  });
}

['SIGTERM', 'SIGINT'].forEach((s) => process.on(s, () => shutdown(s)));
// لا نُسقط العملية على خطأ غير ملتقط — نسجّله ونطفئ بنظافة (§17)
process.on('unhandledRejection', (reason) => logger.error('unhandled-rejection', { reason: String(reason) }));
process.on('uncaughtException', (error) => { logger.error('uncaught-exception', { error: error?.message, stack: error?.stack }); shutdown('uncaughtException'); });
