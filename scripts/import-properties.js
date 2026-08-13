// استيراد مخزون العقارات إلى مجموعة Property (مصدر المطابقة).
// مصدر البيانات يحسمه فريق ساعي: إعلانات ساعي، أو تصدير من منصة تحليل السوق الحالية.
// الاستخدام:  node scripts/import-properties.js <properties.json> [--source market] [--dry]
// شكل الملف: مصفوفة عناصر، كل عنصر (الحقول المرنة تُطبَّع):
//   { sourceId|id|uid, title, category, district, city, beds, area, price, price_per_m|pricePerM, url, projectName }
// idempotent: upsert على (source, sourceId).
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { env } from '../src/config/environment.js';
import { logger } from '../src/utils/logger.js';
import { Property } from '../src/models/Property.js';

const [, , filePath, ...flags] = process.argv;
const dryRun = flags.includes('--dry');
const source = (flags[flags.indexOf('--source') + 1] && !flags[flags.indexOf('--source') + 1].startsWith('--'))
  ? flags[flags.indexOf('--source') + 1] : 'market';

if (!filePath) { console.error('الاستخدام: node scripts/import-properties.js <properties.json> [--source X] [--dry]'); process.exit(1); }

const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
const str = (v) => (v == null || v === '' ? null : String(v));

function normalize(r) {
  return {
    source,
    sourceId: String(r.sourceId ?? r.id ?? r.uid ?? ''),
    title: str(r.title) || '',
    category: str(r.category),
    district: str(r.district ? String(r.district).replace(/^حي\s+/, '') : null),
    city: str(r.city),
    beds: num(r.beds),
    area: num(r.area ?? r.clean_area),
    price: num(r.price),
    pricePerM: num(r.pricePerM ?? r.price_per_m),
    projectId: str(r.projectId ?? r.project_key),
    projectName: str(r.projectName),
    url: str(r.url),
    active: r.active !== false,
    syncedAt: new Date(),
  };
}

async function main() {
  const raw = JSON.parse(await readFile(filePath, 'utf8'));
  const items = (Array.isArray(raw) ? raw : (raw.data || raw.properties || raw.listings || [])).map(normalize).filter((p) => p.sourceId);
  logger.info('import-properties-source', { count: items.length, source });
  if (dryRun) { console.log(JSON.stringify(items.slice(0, 3), null, 2)); return; }

  await mongoose.connect(env.mongoUri, { maxPoolSize: 5 });
  let done = 0;
  for (let i = 0; i < items.length; i += 500) {
    const ops = items.slice(i, i + 500).map((p) => ({
      updateOne: { filter: { source: p.source, sourceId: p.sourceId }, update: { $set: p }, upsert: true },
    }));
    const r = await Property.bulkWrite(ops, { ordered: false });
    done += (r.upsertedCount || 0) + (r.modifiedCount || 0);
  }
  logger.info('import-properties-done', { imported: done, total: items.length });
  console.log(JSON.stringify({ imported: done, total: items.length, source }, null, 2));
}

main()
  .catch((e) => { logger.error('import-properties-failed', { error: e?.message }); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
