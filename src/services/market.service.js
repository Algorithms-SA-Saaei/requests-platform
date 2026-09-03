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

const km = (la1, lo1, la2, lo2) => {
  const R = 6371, dLa = (la2 - la1) * Math.PI / 180, dLo = (lo2 - lo1) * Math.PI / 180;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
// وحدات قرب موقع (نطاق كم) — تصفية بالتصنيف
export async function nearbyProperties(lat, lng, { radius = 3, category, limit = 60 } = {}) {
  const la = +lat, lo = +lng;
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return { center: null, results: [] };
  const d = radius / 111;
  const q = { active: true, lat: { $gte: la - d, $lte: la + d }, lng: { $gte: lo - d * 1.3, $lte: lo + d * 1.3 } };
  if (category) q.category = category;
  const rows = await Property.find(q).select('lat lng category district beds area price pricePerM url title').limit(2000).lean();
  return {
    center: { lat: la, lng: lo }, radius,
    results: rows.map((r) => ({ ...r, dist: Math.round(km(la, lo, r.lat, r.lng) * 10) / 10 }))
      .filter((r) => r.dist <= radius).sort((a, b) => a.dist - b.dist).slice(0, limit),
  };
}
// عقارات حي (بإحداثيات) للخريطة
export async function mapProperties(district, category, { limit = 500 } = {}) {
  const q = { active: true, lat: { $ne: null }, lng: { $ne: null } };
  if (district) q.district = stripHay(district);
  if (category) q.category = category;
  const rows = await Property.find(q).select('lat lng category price pricePerM title district').limit(limit).lean();
  return rows.map((r) => ({ lat: r.lat, lng: r.lng, ppm: r.pricePerM, price: r.price, cat: r.category, t: (r.title || '').slice(0, 50), d: stripHay(r.district) }));
}


/** المشاريع/المجمّعات: تجميع حسب projectName مع الوسيط والنوع (جاهز/خارطة) */
export async function projectsList({ category, saleType, city, limit = 200 } = {}) {
  const q = { active: true, projectName: { $ne: null, $nin: ['', null] } };
  if (category) q.category = category;
  if (saleType) q.saleType = saleType;
  if (city) q.city = city;
  const rows = await Property.find(q).select('projectName category saleType district pricePerM price area city').limit(8000).lean();
  const g = new Map();
  for (const r of rows) {
    const key = r.projectName;
    if (!g.has(key)) g.set(key, { project: key, count: 0, ppms: [], districts: new Set(), cats: new Set(), ready: 0, offplan: 0, city: r.city });
    const o = g.get(key);
    o.count++;
    if (Number.isFinite(r.pricePerM)) o.ppms.push(r.pricePerM);
    if (r.district) o.districts.add(stripHay(r.district));
    if (r.category) o.cats.add(r.category);
    if (r.saleType === 'ready') o.ready++; else if (r.saleType === 'offplan') o.offplan++;
  }
  return [...g.values()]
    .map((o) => ({ project: o.project, count: o.count, ppmMedian: median(o.ppms), districts: [...o.districts], categories: [...o.cats], ready: o.ready, offplan: o.offplan, city: o.city }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** صحة البيانات: عدد كل مصدر، آخر سحب، تغطية الأحياء/التصنيفات، والنواقص */
export async function dataHealth() {
  const { stateGet } = await import('../models/AppState.js');
  const [total, active, bySourceAgg, catAgg, lastCrawl, noGeo, noPrice, districtsCount] = await Promise.all([
    Property.countDocuments({}),
    Property.countDocuments({ active: true }),
    Property.aggregate([{ $match: { active: true } }, { $group: { _id: '$source', count: { $sum: 1 }, last: { $max: '$syncedAt' } } }]),
    Property.aggregate([{ $match: { active: true } }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    stateGet('last_crawl'),
    Property.countDocuments({ active: true, $or: [{ lat: null }, { lng: null }] }),
    Property.countDocuments({ active: true, $or: [{ price: null }, { price: 0 }] }),
    Property.distinct('district', { active: true }),
  ]);
  return {
    total, active,
    bySource: bySourceAgg.map((s) => ({ source: s._id, count: s.count, last: s.last })).sort((a, b) => b.count - a.count),
    byCategory: catAgg.map((c) => ({ category: c._id, count: c.count })),
    districts: (districtsCount || []).filter(Boolean).length,
    lastCrawl: lastCrawl || null,
    missing: { noGeo, noPrice },
  };
}

/** تصدير المخزون كـCSV (سطر لكل عقار) */
export async function exportPropertiesCsv({ city, category, district } = {}) {
  const q = { active: true };
  if (city) q.city = city;
  if (category) q.category = category;
  if (district) q.district = stripHay(district);
  const rows = await Property.find(q).select('source category district city beds area price pricePerM saleType projectName url').limit(50000).lean();
  const head = ['المصدر', 'التصنيف', 'الحي', 'المدينة', 'الغرف', 'المساحة', 'السعر', 'سعر المتر', 'النوع', 'المشروع', 'الرابط'];
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [head.join(',')];
  for (const r of rows) lines.push([r.source, r.category, stripHay(r.district), r.city, r.beds, r.area, r.price, r.pricePerM, r.saleType === 'ready' ? 'جاهز' : r.saleType === 'offplan' ? 'خارطة' : '', r.projectName, r.url].map(esc).join(','));
  return '﻿' + lines.join('\n');
}


/** يلتقط لقطة يومية: وسيط سعر المتر وعدد الوحدات لكل (حي، تصنيف). idempotent باليوم. */
export async function snapshotMarket({ city } = {}) {
  const { Snapshot } = await import('../models/Snapshot.js');
  const q = { active: true, pricePerM: { $ne: null }, area: { $gte: 100 } };
  if (city) q.city = city;
  const rows = await Property.find(q).select('district category city pricePerM price').limit(50000).lean();
  const g = new Map();
  for (const r of rows) {
    const d = stripHay(r.district), c = r.category;
    if (!d || !c) continue;
    const key = d + ' ' + c;
    if (!g.has(key)) g.set(key, { district: d, category: c, city: r.city, ppms: [], prices: [] });
    const o = g.get(key);
    if (Number.isFinite(r.pricePerM)) o.ppms.push(r.pricePerM);
    if (Number.isFinite(r.price)) o.prices.push(r.price);
  }
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const ops = [...g.values()]
    .filter((o) => o.ppms.length)
    .map((o) => ({
      updateOne: {
        filter: { day, district: o.district, category: o.category },
        update: { $set: { day, at: now, district: o.district, category: o.category, city: o.city, ppmMedian: median(o.ppms), priceMedian: median(o.prices), count: o.ppms.length } },
        upsert: true,
      },
    }));
  if (ops.length) await Snapshot.bulkWrite(ops, { ordered: false });
  return { day, groups: ops.length };
}

/** سلسلة زمنية لسعر متر حي/تصنيف (من اللقطات) */
export async function trendSeries(district, category, { city, days = 180 } = {}) {
  const { Snapshot } = await import('../models/Snapshot.js');
  const q = {};
  if (district) q.district = stripHay(district);
  if (category) q.category = category;
  if (city) q.city = city;
  const rows = await Snapshot.find(q).select('day ppmMedian priceMedian count').sort({ day: 1 }).limit(days).lean();
  return rows.map((r) => ({ day: r.day, ppm: r.ppmMedian, price: r.priceMedian, count: r.count }));
}

/** ازواج (حي، تصنيف) التي لها لقطتان فاكثر — صالحة لعرض اتجاه */
export async function trendPairs() {
  const { Snapshot } = await import('../models/Snapshot.js');
  const agg = await Snapshot.aggregate([
    { $group: { _id: { district: '$district', category: '$category' }, snaps: { $sum: 1 } } },
    { $match: { snaps: { $gte: 2 } } },
    { $sort: { snaps: -1 } },
    { $limit: 300 },
  ]);
  return agg.map((a) => ({ district: a._id.district, category: a._id.category, snaps: a.snaps }));
}
