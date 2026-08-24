// منصة الطلبات — عرض طلبات العملاء (تبويبات مطابَق/غير مطابَق) وأنسب العقارات لكل طلب.
// المطابقة تتطلب تسجيل دخول (§30)؛ المزامنة اليدوية للمشرف فقط.
import { ClientRequest } from '../models/ClientRequest.js';
import { syncRequests, requestCounts, requestSummary } from '../services/saaeiRequests.service.js';
import { matchesForRequest } from '../services/matching.service.js';
import { crawlMarket } from '../services/crawl.service.js';
import { Property } from '../models/Property.js';
import { tokenStatus } from '../services/saaeiToken.service.js';
import { ok, created } from '../utils/response.js';

const TABS = { matched: { matched: 1 }, unmatched: { matched: 0 }, unknown: { matched: null } };

// GET /api/requests?tab=all|matched|unmatched|unknown&page=1&limit=20
export const list = async (req, res) => {
  const tab = TABS[req.query.tab] ? req.query.tab : 'all';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter = TABS[tab] || {};

  const [items, total, counts, ts] = await Promise.all([
    ClientRequest.find(filter)
      .sort({ saaeiCreatedAt: -1, syncedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ClientRequest.countDocuments(filter),
    requestCounts(),
    tokenStatus(),
  ]);

  return ok(res, items.map((r) => ({
    id: r.saaeiId,
    clientName: r.clientName,
    phone: r.phone,
    summary: requestSummary(r),
    category: r.category, district: r.district, beds: r.beds,
    priceMin: r.priceMin, priceMax: r.priceMax,
    purpose: r.purpose, status: r.status, matched: r.matched, employee: r.employee,
    createdAt: r.saaeiCreatedAt,
  })), {
    tab, page, limit, total, pageCount: Math.ceil(total / limit),
    counts, token: { set: ts.set, daysLeft: ts.daysLeft },
  });
};

// GET /api/requests/:id/matches — أنسب العقارات لطلب
export const matches = async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 30));
  const data = await matchesForRequest(String(req.params.id), { limit });
  return ok(res, data.results, { pool: data.pool, request: {
    id: data.request.saaeiId, clientName: data.request.clientName, summary: requestSummary(data.request),
  } });
};

// POST /api/requests/sync — مزامنة يدوية كاملة + وسم فوري (الصلاحية مفروضة في المسار: admin/manager)
export const sync = async (_req, res) => {
  const result = await syncRequests({ force: true });
  return created(res, result);
};

// POST /api/requests/crawl — سحب السوق (بيوت+عقار) لتعبئة مخزون المطابقة (admin/manager)
export const crawl = async (req, res) => {
  const sources = Array.isArray(req.body?.sources) ? req.body.sources : ['bayut', 'aqar'];
  const result = await crawlMarket({ sources });
  return created(res, result);
};
// GET /api/inventory — حالة مخزون العقارات
export const inventory = async (_req, res) => {
  const [total, bySrc] = await Promise.all([
    Property.countDocuments({ active: true }),
    Property.aggregate([{ $match: { active: true } }, { $group: { _id: '$source', n: { $sum: 1 } } }]),
  ]);
  return ok(res, { total, bySource: bySrc.map((x) => ({ source: x._id, count: x.n })) });
};
