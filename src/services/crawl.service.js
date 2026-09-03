// تنسيق سحب السوق (بيوت + عقار) → مجموعة Property في Mongo (مصدر مطابقة الطلبات).
// يُشغَّل بجدولة أو يدويًا. idempotent: upsert على (source, sourceId).
import { logger } from '../utils/logger.js';
import { stateSet } from '../models/AppState.js';
import { Property } from '../models/Property.js';
import { crawlBayut } from './crawlers/bayut.crawler.js';
import { crawlAqar } from './crawlers/aqar.crawler.js';

async function storeProperties(rows) {
  if (!rows.length) return 0;
  let done = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const ops = rows.slice(i, i + 500)
      .filter((p) => p.sourceId && (p.price > 0) && (p.area > 0))
      .map((p) => ({ updateOne: { filter: { source: p.source, sourceId: p.sourceId }, update: { $set: { ...p, syncedAt: new Date() } }, upsert: true } }));
    if (!ops.length) continue;
    const r = await Property.bulkWrite(ops, { ordered: false });
    done += (r.upsertedCount || 0) + (r.modifiedCount || 0);
  }
  return done;
}

/** سحب السوق كاملًا (بيوت + عقار) وتخزينه. opts.sources لتحديد المصادر. */
export async function crawlMarket({ sources = ['bayut', 'aqar'], city = 'الرياض', districts, categories } = {}) {
  const summary = { bayut: 0, aqar: 0 };
  if (sources.includes('bayut')) {
    const rows = await crawlBayut({ city, ...(districts ? { districts } : {}) });
    summary.bayut = await storeProperties(rows);
    logger.info('crawl-bayut-done', { fetched: rows.length, stored: summary.bayut });
  }
  if (sources.includes('aqar')) {
    const rows = await crawlAqar({ ...(districts ? { districts } : {}), ...(categories ? { categories } : {}) });
    summary.aqar = await storeProperties(rows);
    logger.info('crawl-aqar-done', { fetched: rows.length, stored: summary.aqar });
  }
  const total = await Property.countDocuments({ active: true });
  await stateSet('last_crawl', { at: new Date().toISOString(), sources, ...summary });
  return { ...summary, totalActive: total };
}
