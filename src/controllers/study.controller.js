// دراسات المشاريع — API: إنشاء/قائمة/تحليل/حذف.
import { Study } from '../models/Study.js';
import { analyzeStudy } from '../services/study.service.js';
import { ok, created } from '../utils/response.js';
import { badRequest } from '../utils/errors.js';

export const create = async (req, res) => {
  const b = req.body || {};
  if (!b.name) throw badRequest('اسم المشروع مطلوب', 'MISSING_NAME');
  const units = (Array.isArray(b.units) ? b.units : []).map((u) => ({
    type: u.type || null, floor: u.floor || null,
    area: +u.area || 0, privateArea: +u.privateArea || +u.private || 0,
    price: +u.price || 0, count: +u.count || 1,
  })).filter((u) => u.area > 0 && u.price > 0);
  const study = await Study.create({
    name: String(b.name), developer: b.developer || null, district: b.district || null,
    city: b.city || 'الرياض', units, notes: b.notes || null, createdBy: req.user?.id || null,
  });
  return created(res, { id: study._id });
};

export const list = async (_req, res) => {
  const items = await Study.find().sort({ createdAt: -1 }).limit(100)
    .select('name developer district createdAt').lean();
  return ok(res, items.map((s) => ({ id: s._id, name: s.name, developer: s.developer, district: s.district, createdAt: s.createdAt })));
};

export const analyze = async (req, res) => {
  const data = await analyzeStudy(String(req.params.id));
  return ok(res, data);
};

export const remove = async (req, res) => {
  await Study.deleteOne({ _id: req.params.id });
  return ok(res, { deleted: true });
};
