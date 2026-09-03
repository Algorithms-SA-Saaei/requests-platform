// دراسة السوق — تقارير من مخزون Property (سحب بيوت+عقار): وسيط سعر المتر بالحي/التصنيف،
// النظرة العامة، وقائمة الأحياء ذات البيانات (للبحث والاختيار المطابق).
import { Property } from '../models/Property.js';

const median = (arr) => {
  const v = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
};
const stripHay = (s) => String(s || '').replace(/^حي\s+/, '').trim();

/** تقرير حي + تصنيف: وسيط/مدى سعر المتر + عيّنة عقارات */
export async function marketReport(district, category, { city } = {}) {
  const q = { active: true, pricePerM: { $ne: null }, area: { $gte: 100 } };
  if (district) q.district = stripHay(district);
  if (category) q.category = category;
  if (city) q.city = city;
  const rows = await Property.find(q).select('pricePerM price area beds district source url title').limit(4000).lean();
  const ppms = rows.map((r) => r.pricePerM).filter(Number.isFinite);
  const prices = rows.map((r) => r.price).filter(Number.isFinite);
  const areas = rows.map((r) => r.area).filter(Number.isFinite);
  return {
    district: stripHay(district), category, city: city || null,
    count: rows.length,
    ppmMedian: median(ppms),
    ppmMin: ppms.length ? Math.min(...ppms) : null,
    ppmMax: ppms.length ? Math.max(...ppms) : null,
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
    areaMin: areas.length ? Math.min(...areas) : null,
    areaMax: areas.length ? Math.max(...areas) : null,
    sample: rows.slice(0, 30).map((r) => ({
      district: r.district, category, beds: r.beds, area: r.area, price: r.price,
      pricePerM: r.pricePerM, url: r.url, title: (r.title || '').slice(0, 60), source: r.source,
    })),
  };
}

/** الأحياء ذات البيانات (للقائمة القابلة للبحث) — تصنيف اختياري */
export async function districtsWithData(category) {
  const match = { active: true, pricePerM: { $ne: null }, area: { $gte: 100 } };
  if (category) match.category = category;
  const rows = await Property.aggregate([
    { $match: match },
    { $group: { _id: { district: '$district', city: '$city' }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: 400 },
  ]);
  return rows.map((r) => ({ district: r._id.district, city: r._id.city, count: r.n }));
}

/** نظرة عامة: إجمالي المخزون + وسيط سعر المتر لكل تصنيف */
export async function marketOverview() {
  const [total, byCat, bySrc] = await Promise.all([
    Property.countDocuments({ active: true }),
    Property.aggregate([
      { $match: { active: true, pricePerM: { $ne: null }, area: { $gte: 100 } } },
      { $group: { _id: '$category', n: { $sum: 1 }, ppms: { $push: '$pricePerM' } } },
      { $sort: { n: -1 } },
    ]),
    Property.aggregate([{ $match: { active: true } }, { $group: { _id: '$source', n: { $sum: 1 } } }]),
  ]);
  return {
    total,
    bySource: bySrc.map((x) => ({ source: x._id, count: x.n })),
    byCategory: byCat.map((c) => ({ category: c._id, count: c.n, ppmMedian: median(c.ppms) })),
  };
}

// مقارنة الأحياء: وسيط سعر المتر لكل حي في تصنيف
export async function compareDistricts(category, { limit = 40 } = {}) {
  const rows = await Property.aggregate([
    { $match: { active: true, pricePerM: { $ne: null }, area: { $gte: 100 }, ...(category ? { category } : {}) } },
    { $group: { _id: '$district', ppms: { $push: '$pricePerM' }, n: { $sum: 1 } } },
    { $match: { n: { $gte: 3 } } },
  ]);
  const med = (a) => { const v = a.filter(Number.isFinite).sort((x, y) => x - y); return v.length ? (v.length % 2 ? v[v.length >> 1] : Math.round((v[(v.length >> 1) - 1] + v[v.length >> 1]) / 2)) : null; };
  return rows.map((r) => ({ district: stripHay(r._id), count: r.n, ppmMedian: med(r.ppms) }))
    .filter((r) => r.ppmMedian).sort((a, b) => b.ppmMedian - a.ppmMedian).slice(0, limit);
}

// تسعير وحدة: تقدير السعر من وسيط سوق الحي × المساحة
export async function priceUnit(district, category, area) {
  const rep = await marketReport(district, category);
  const a = +area || 0;
  if (!rep.ppmMedian || !a) return { ...rep, area: a, estimate: null };
  return {
    district: stripHay(district), category, area: a, sample: rep.count,
    ppmMedian: rep.ppmMedian, ppmMin: rep.ppmMin, ppmMax: rep.ppmMax,
    estimate: Math.round(rep.ppmMedian * a),
    estimateLow: Math.round(rep.ppmMin * a),
    estimateHigh: Math.round(rep.ppmMax * a),
  };
}

// جاهز/خارطة: وسيط سعر المتر لكل حالة بيع في حي/تصنيف
export async function saleSplit(district, category) {
  const q = { active: true, pricePerM: { $ne: null }, area: { $gte: 100 } };
  if (district) q.district = stripHay(district);
  if (category) q.category = category;
  const rows = await Property.find(q).select('pricePerM saleType').lean();
  const g = { ready: [], offplan: [], unknown: [] };
  for (const r of rows) (g[r.saleType || 'unknown'] || g.unknown).push(r.pricePerM);
  const med = (a) => { const v = a.filter(Number.isFinite).sort((x, y) => x - y); return v.length ? (v.length % 2 ? v[v.length >> 1] : Math.round((v[(v.length >> 1) - 1] + v[v.length >> 1]) / 2)) : null; };
  const diff = (g.ready.length && g.offplan.length) ? Math.round((med(g.offplan) - med(g.ready)) * 100 / med(g.ready)) : null;
  return {
    district: stripHay(district), category,
    ready: { count: g.ready.length, ppmMedian: med(g.ready) },
    offplan: { count: g.offplan.length, ppmMedian: med(g.offplan) },
    unknown: { count: g.unknown.length },
    offplanVsReadyPct: diff,
  };
}
