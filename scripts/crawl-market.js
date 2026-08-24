// سحب السوق (بيوت + عقار) → Property. الاستخدام:
//   node scripts/crawl-market.js [--sources bayut,aqar]
// جدولة مقترحة: يوميًا  0 4 * * *  node scripts/crawl-market.js
import mongoose from 'mongoose';
import { env } from '../src/config/environment.js';
import { logger } from '../src/utils/logger.js';
import { crawlMarket } from '../src/services/crawl.service.js';

const arg = process.argv.find((a) => a.startsWith('--sources'));
const sources = arg ? (arg.split('=')[1] || process.argv[process.argv.indexOf(arg) + 1] || '').split(',').filter(Boolean) : ['bayut', 'aqar'];

async function main() {
  await mongoose.connect(env.mongoUri, { maxPoolSize: 5 });
  const res = await crawlMarket({ sources: sources.length ? sources : ['bayut', 'aqar'] });
  logger.info('crawl-market-done', res);
  console.log(JSON.stringify(res, null, 2));
}
main().catch((e) => { logger.error('crawl-market-failed', { error: e?.message }); process.exitCode = 1; }).finally(() => mongoose.disconnect());
