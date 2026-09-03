// دراسة السوق — API: تقرير حي، نظرة عامة، قائمة الأحياء.
import { marketReport, marketOverview, districtsWithData, compareDistricts, priceUnit, saleSplit, nearbyProperties, mapProperties, projectsList, dataHealth } from '../services/market.service.js';
import { demandGaps } from '../services/demand.service.js';
import { ok } from '../utils/response.js';

export const report = async (req, res) => {
  const data = await marketReport(req.query.district || null, req.query.category || 'شقة', { city: req.query.city || null });
  return ok(res, data);
};
export const overview = async (_req, res) => ok(res, await marketOverview());
export const districts = async (req, res) => ok(res, await districtsWithData(req.query.category || null));
export const compare = async (req, res) => ok(res, await compareDistricts(req.query.category || 'شقة'));
export const price = async (req, res) => ok(res, await priceUnit(req.query.district || null, req.query.category || 'شقة', req.query.area));
export const split = async (req, res) => ok(res, await saleSplit(req.query.district || null, req.query.category || 'شقة'));
export const gaps = async (_req, res) => ok(res, await demandGaps());
export const nearby = async (req, res) => ok(res, await nearbyProperties(req.query.lat, req.query.lng, { radius: +req.query.radius || 3, category: req.query.category || null }));
export const mapData = async (req, res) => ok(res, await mapProperties(req.query.district || null, req.query.category || null));
export const projects = async (req, res) => ok(res, await projectsList({ category: req.query.category || null, saleType: req.query.saleType || null, city: req.query.city || null }));
export const health = async (_req, res) => ok(res, await dataHealth());
