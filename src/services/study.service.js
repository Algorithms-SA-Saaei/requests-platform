// تحليل دراسة مشروع: لكل وحدة سعر المتر على الإجمالي (بناء+خاص) مقابل وسيط السوق بالحي.
// وسيط السوق من مجموعة Property (سحب بيوت+عقار)، بمطابقة الحي والتصنيف واستبعاد <100م².
import { Study } from '../models/Study.js';
import { Property } from '../models/Property.js';
import { notFound } from '../utils/errors.js';

const median = (arr) => {
  const v = arr.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
};
const stripHay = (s) => String(s || '').replace(/^حي\s+/, '').trim();

export async function analyzeStudy(studyId) {
  const study = await Study.findById(studyId).lean();
  if (!study) throw notFound('الدراسة غير موجودة', 'STUDY_NOT_FOUND');
  const district = stripHay(study.district);

  // وسيط السوق لكل تصنيف في الحي (Property نشط، سعر متر موجود، مساحة ≥100)
  const marketRows = await Property.find({
    district, active: true, pricePerM: { $ne: null }, area: { $gte: 100 },
  }).select('category pricePerM').lean();
  const byCat = {};
  for (const r of marketRows) { (byCat[r.category] ||= []).push(r.pricePerM); }
  const marketMed = (cat) => median(byCat[cat] || []);
  const marketN = (cat) => (byCat[cat] || []).length;

  const rows = study.units.map((u) => {
    const built = +u.area || 0, priv = +u.privateArea || 0, total = built + priv;
    const price = +u.price || 0;
    const ppm = total > 0 ? Math.round(price / total) : null;
    const mkt = marketMed(u.type);
    const diff = (ppm && mkt) ? Math.round((ppm - mkt) * 100 / mkt) : null;
    return {
      type: u.type, floor: u.floor, built, privateArea: priv, total, price, count: u.count || 1,
      ppm, marketPpm: mkt, marketSample: marketN(u.type), diffPct: diff,
    };
  });

  const ppms = rows.map((r) => r.ppm).filter(Number.isFinite);
  const diffs = rows.map((r) => r.diffPct).filter(Number.isFinite);
  const totals = {
    units: rows.reduce((a, r) => a + (r.count || 0), 0),
    value: rows.reduce((a, r) => a + r.price * (r.count || 0), 0),
    medianPpm: median(ppms),
    avgDiff: diffs.length ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length) : null,
    marketRefs: marketRows.length,
  };
  return { study, rows, totals };
}
