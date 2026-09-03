// البورصة العقارية (وزارة العدل) — صفقات مسجّلة لا عروضًا معلنة.
// GetAreaInfo عام بلا دخول ويعمل من الخادم (يكفي Origin/Referer/User-Agent).
// القيد: areaSerial لا يُشتق من اسم الحي (SearchAddress خلف النفاذ) — يُدخل يدويًا في AreaCode.
// فخّ مثبَّت: GetAreaInfo تقبل realEstateTypes وتتجاهلها، فلا نرسلها ولا نعتمد عليها للفرز.
import { logger } from '../utils/logger.js';

const SREM_URL = 'https://prod-srem-api-srem.moj.gov.sa/api/v1/Dashboard/GetAreaInfo';
const HEADERS = {
  'Content-Type': 'application/json',
  Origin: 'https://srem.moj.gov.sa',
  Referer: 'https://srem.moj.gov.sa/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
};

/**
 * صفقات حيّ من البورصة. periodCategory: 'Y' (12 شهرًا) · 'A' (السلسلة السنوية) · 'M' (أيام الشهر).
 * يُرجع { average, totalPrice, totalArea, deals, points } أو null عند الفشل.
 * AveragePrice = TotalPrice ÷ TotalArea بالضبط. الشهر الجاري ناقص دائمًا — يُستبعد من الأحدث.
 */
export async function fetchAreaInfo(areaSerial, areaType = 'R', { periodCategory = 'Y', timeoutMs = 12000 } = {}) {
  if (!areaSerial) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(SREM_URL, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ periodCategory, period: 1, areaSerial: Number(areaSerial), areaType }),
      signal: ctrl.signal,
    });
    if (!r.ok) { logger.error('srem-http', { areaSerial, status: r.status }); return null; }
    const j = await r.json();
    // العقد الفعلي: { IsSuccess, Data: { Stats: [ { AggregationDate, TotalArea, TotalPrice, TotalCount, AveragePrice } ] } }
    const rows = j?.Data?.Stats || j?.data?.Stats || (Array.isArray(j?.Data) ? j.Data : Array.isArray(j) ? j : []);
    const points = (rows || [])
      .map((p) => ({
        label: p.AggregationDate || p.aggregationDate || p.date || p.label || null,
        average: num(p.AveragePrice ?? p.averagePrice),
        totalPrice: num(p.TotalPrice ?? p.totalPrice),
        totalArea: num(p.TotalArea ?? p.totalArea),
        deals: num(p.TotalCount ?? p.totalCount ?? p.transactionsCount ?? p.count),
      }))
      .filter((p) => Number.isFinite(p.average) || Number.isFinite(p.totalPrice));
    if (!points.length) return null;
    const totalPrice = points.reduce((a, p) => a + (p.totalPrice || 0), 0);
    const totalArea = points.reduce((a, p) => a + (p.totalArea || 0), 0);
    const deals = points.reduce((a, p) => a + (p.deals || 0), 0);
    const average = totalArea ? Math.round(totalPrice / totalArea) : median(points.map((p) => p.average).filter(Number.isFinite));
    return { average, totalPrice, totalArea, deals, points };
  } catch (e) {
    logger.error('srem-fetch-failed', { areaSerial, error: e?.message });
    return null;
  } finally {
    clearTimeout(t);
  }
}

const num = (v) => { const n = typeof v === 'string' ? parseFloat(v.replace(/,/g, '')) : Number(v); return Number.isFinite(n) ? n : null; };
const median = (arr) => { const v = (arr || []).filter(Number.isFinite).sort((a, b) => a - b); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2); };
