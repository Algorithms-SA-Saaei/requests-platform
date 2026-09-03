// دراسة السوق — API: تقرير حي، نظرة عامة، قائمة الأحياء.
import { marketReport, marketOverview, districtsWithData } from '../services/market.service.js';
import { ok } from '../utils/response.js';

export const report = async (req, res) => {
  const data = await marketReport(req.query.district || null, req.query.category || 'شقة', { city: req.query.city || null });
  return ok(res, data);
};
export const overview = async (_req, res) => ok(res, await marketOverview());
export const districts = async (req, res) => ok(res, await districtsWithData(req.query.category || null));
