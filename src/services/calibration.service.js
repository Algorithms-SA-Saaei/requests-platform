// المعايرة — تقارن وسيط سعر متر العرض (من مخزوننا) بمتوسط صفقات البورصة الفعلية.
// الأحياء ذات الرمز فقط تُعاير؛ ما لا رمز له يُدرَج صراحةً كـ«يحتاج رمزًا» (لا رقم مخترع).
import { Property } from '../models/Property.js';
import { AreaCode } from '../models/AreaCode.js';
import { fetchAreaInfo } from './srem.service.js';

const stripHay = (s) => String(s || '').replace(/^حي\s+/, '').trim();
const median = (arr) => { const v = (arr || []).filter(Number.isFinite).sort((a, b) => a - b); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2); };

/** وسيط سعر متر العرض عندنا لحيّ (كل التصنيفات أو تصنيف محدّد) */
async function askingPpm(district, { category, city } = {}) {
  const q = { active: true, pricePerM: { $ne: null }, area: { $gte: 100 }, district: stripHay(district) };
  if (category) q.category = category;
  if (city) q.city = city;
  const rows = await Property.find(q).select('pricePerM').limit(8000).lean();
  const ppms = rows.map((r) => r.pricePerM).filter(Number.isFinite);
  return { median: median(ppms), count: ppms.length };
}

/**
 * تقرير المعايرة: لكل حي له رمز → عرضنا مقابل صفقات البورصة والفارق٪.
 * opts.city للتقييد. يُنفَّذ نداء البورصة لكل رمز (بالتوازي، مع تحمّل الفشل).
 */
export async function calibrationReport({ city } = {}) {
  const codes = await AreaCode.find(city ? { city } : {}).lean();
  const calibrated = await Promise.all(
    codes.map(async (c) => {
      const [asking, srem] = await Promise.all([
        askingPpm(c.district, { city: c.city }),
        fetchAreaInfo(c.areaSerial, c.areaType, { periodCategory: 'Y' }),
      ]);
      const actual = srem?.average ?? null;
      const gapPct = actual && asking.median ? Math.round(((asking.median - actual) / actual) * 100) : null;
      return {
        district: c.district, city: c.city, areaSerial: c.areaSerial, areaType: c.areaType,
        askingMedian: asking.median, askingCount: asking.count,
        actualAverage: actual, deals: srem?.deals ?? null, gapPct,
        ok: actual != null,
      };
    })
  );
  // أحياء لدينا بيانات عرض عنها بلا رمز بورصة — تحتاج التقاط رمز بدخول النفاذ
  const coded = new Set(codes.map((c) => c.district));
  const withData = await Property.aggregate([
    { $match: { active: true, pricePerM: { $ne: null } } },
    { $group: { _id: '$district', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 60 },
  ]);
  const needsCode = withData
    .map((d) => ({ district: stripHay(d._id), count: d.count }))
    .filter((d) => d.district && !coded.has(d.district));
  return {
    calibrated: calibrated.sort((a, b) => (b.gapPct ?? -999) - (a.gapPct ?? -999)),
    needsCode,
    codesCount: codes.length,
  };
}

export async function addAreaCode({ district, city, areaSerial, areaType, note }) {
  const d = stripHay(district);
  if (!d || !areaSerial) throw new Error('district و areaSerial مطلوبان');
  await AreaCode.findOneAndUpdate(
    { district: d, city: city || 'الرياض' },
    { district: d, city: city || 'الرياض', areaSerial: Number(areaSerial), areaType: areaType || 'R', note: note || null, addedAt: new Date() },
    { upsert: true }
  );
  return { district: d, areaSerial: Number(areaSerial) };
}

export async function removeAreaCode(district, city) {
  await AreaCode.deleteOne({ district: stripHay(district), city: city || 'الرياض' });
  return { ok: true };
}

export async function listAreaCodes() {
  return AreaCode.find({}).sort({ city: 1, district: 1 }).lean();
}
