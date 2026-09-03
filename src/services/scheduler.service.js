// جدولة المهام التلقائية (node-schedule)
// 1. مزامنة الطلبات وتحديث التوكن و.env: كل 3 ساعات (0 */3 * * *)
// 2. سحب بيانات السوق: يوميًا الساعة 4 صباحًا (0 4 * * *)
import schedule from 'node-schedule';
import { logger } from '../utils/logger.js';
import { syncRequests } from './saaeiRequests.service.js';
import { crawlMarket } from './crawl.service.js';

export function initScheduler() {
  logger.info('scheduler-init', { message: 'Cron scheduler initialized with node-schedule' });

  // كل 3 ساعات: مزامنة الطلبات وتحديث التوكن و.env
  const syncJob = schedule.scheduleJob('0 */3 * * *', async () => {
    logger.info('cron-sync-requests-start');
    try {
      const res = await syncRequests({ force: false });
      logger.info('cron-sync-requests-success', res);
    } catch (err) {
      logger.error('cron-sync-requests-failed', { error: err?.message });
    }
  });

  // يوميًا الساعة 4 صباحًا: سحب بيانات السوق (بيوت وعقار)
  const crawlJob = schedule.scheduleJob('0 4 * * *', async () => {
    logger.info('cron-crawl-market-start');
    try {
      const res = await crawlMarket({ sources: ['bayut', 'aqar'] });
      logger.info('cron-crawl-market-success', res);
    } catch (err) {
      logger.error('cron-crawl-market-failed', { error: err?.message });
    }
  });

  return { syncJob, crawlJob };
}
