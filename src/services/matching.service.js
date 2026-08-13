// مطابقة طلب عميل بأنسب العقارات من المخزون (Property). درجة 0–100٪ بأوزان لكل معيار مذكور.
// محايدة المصدر: تعمل على أي مخزون في مجموعة Property (إعلانات ساعي افتراضيًا).
import { Property } from '../models/Property.js';
import { ClientRequest } from '../models/ClientRequest.js';
import { notFound } from '../utils/errors.js';

// أوزان المعايير (تُطبَّق فقط على المعايير المذكورة في الطلب)
const W = { category: 1.4, beds: 1.6, price: 1.7, area: 1.0, district: 1.5 };

function scoreProperty(p, req) {
  let sum = 0, wsum = 0;
  const add = (w, s) => { sum += w * s; wsum += w; };

  if (req.category) add(W.category, p.category === req.category ? 1 : 0.15);
  if (req.beds != null && p.beds != null) {
    const diff = Math.abs(p.beds - req.beds);
    add(W.beds, diff === 0 ? 1 : diff === 1 ? 0.6 : 0.15);
  }
  // السعر: داخل النطاق = 1، وإلا يتناقص بالبُعد النسبي
  if ((req.priceMin || req.priceMax) && p.price != null) {
    const lo = req.priceMin || 0, hi = req.priceMax || Infinity;
    let s = 1;
    if (p.price < lo) s = Math.max(0, 1 - (lo - p.price) / (lo || 1));
    else if (p.price > hi && hi !== Infinity) s = Math.max(0, 1 - (p.price - hi) / hi);
    add(W.price, s);
  }
  if ((req.areaMin || req.areaMax) && p.area != null) {
    const lo = req.areaMin || 0, hi = req.areaMax || Infinity;
    let s = 1;
    if (p.area < lo) s = Math.max(0, 1 - (lo - p.area) / (lo || 1));
    else if (p.area > hi && hi !== Infinity) s = Math.max(0, 1 - (p.area - hi) / hi);
    add(W.area, s);
  }
  if (req.district) add(W.district, p.district === req.district ? 1 : 0.1);

  const score = wsum ? Math.round((sum / wsum) * 100) : 0;
  const reasons = [];
  if (req.category && p.category === req.category) reasons.push(`النوع: ${p.category}`);
  if (req.beds != null && p.beds === req.beds) reasons.push(`${p.beds} غرف`);
  if (req.district && p.district === req.district) reasons.push(`الحي: ${p.district}`);
  if ((req.priceMin || req.priceMax) && p.price != null && p.price >= (req.priceMin || 0) && p.price <= (req.priceMax || Infinity))
    reasons.push('ضمن الميزانية');
  return { score, reasons };
}

/**
 * أنسب العقارات لطلب مخزَّن.
 * @param {string} saaeiId معرّف الطلب
 * @param {object} opts { limit }
 */
export async function matchesForRequest(saaeiId, { limit = 30 } = {}) {
  const req = await ClientRequest.findOne({ saaeiId }).lean();
  if (!req) throw notFound('الطلب غير موجود', 'REQUEST_NOT_FOUND');

  // تقليل المرشّحين قبل التقييم: النوع + نطاق سعري متساهل
  const q = { active: true };
  if (req.category) q.category = req.category;
  if (req.priceMax) q.price = { $lte: Math.round(req.priceMax * 1.35) };
  if (req.priceMin) q.price = { ...(q.price || {}), $gte: Math.round(req.priceMin * 0.65) };

  const candidates = await Property.find(q).limit(1500).lean();
  const scored = candidates
    .map((p) => ({
      id: p._id, sourceId: p.sourceId, source: p.source, title: p.title, category: p.category,
      district: p.district, beds: p.beds, area: p.area, price: p.price, url: p.url,
      projectName: p.projectName, ...scoreProperty(p, req),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { request: req, pool: candidates.length, results: scored };
}
