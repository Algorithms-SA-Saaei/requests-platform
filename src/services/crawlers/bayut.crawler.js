// سحّاب بيوت (bayut.sa) عبر Algolia — API نقي بلا متصفح. منقول من موصّل منصّة تحليل السوق.
// يعيد عقارات مطبَّعة لشكل Property (Mongo). يدعم تقسيماً سعرياً لتجاوز حد ترقيم Algolia (1000).
import { logger } from '../../utils/logger.js';

const APP = 'LL8IZ711CS';
const KEY = '5b970b39b22a4ff1b99e5167696eef3f';
const IDX = 'bayut-sa-production-ads-ar';

// أحياء الرياض الافتراضية (كما في بيوت — بلا بادئة «حي»)
export const RIYADH_DISTRICTS = [
  'النخيل', 'الرمال', 'حطين', 'الروابي', 'الربوة', 'الملز', 'الغدير', 'المصيف',
  'القيروان', 'العقيق', 'المنار', 'المحمدية', 'الريان', 'التعاون', 'الياسمين', 'النرجس',
  'العارض', 'المونسية', 'قرطبة', 'الملقا', 'الصحافة', 'الوادي',
];

const CAT_MAP = {
  apartments: 'شقة', villas: 'فيلا', floors: 'دور', townhouses: 'تاون هاوس',
  'residential-building': 'عمارة', 'residential-buildings': 'عمارة',
  'residential-land': 'أرض', 'commercial-land': 'أرض', land: 'أرض', lands: 'أرض',
  rest_houses: 'استراحة', offices: 'مكتب', shops: 'محل',
};
function mapCategory(hit) {
  const cats = hit.category || [];
  const last = cats[cats.length - 1] || {};
  let c = CAT_MAP[last.slug] || last.name || '';
  if (c === 'فيلا' && /تاون\s*هاوس/.test(hit.title || '')) c = 'تاون هاوس';
  return c || null;
}
const loc = (h, lv) => { const x = (h.location || []).find((l) => l.level === lv); return x ? x.name : ''; };

async function algolia(city, district, purpose, numeric) {
  const res = await fetch(`https://${APP}-dsn.algolia.net/1/indexes/${IDX}/query`, {
    method: 'POST',
    headers: { 'X-Algolia-Application-Id': APP, 'X-Algolia-API-Key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hitsPerPage: 1000, page: 0,
      facetFilters: [['purpose:' + purpose], ['location.slug:/' + city], ['location.name:' + district]],
      numericFilters: numeric || [],
    }),
  });
  if (!res.ok) throw new Error('algolia ' + res.status);
  return res.json();
}

// يسحب كل وحدات حي (بيع) مع تقسيم سعري تكراري
async function scrapeDistrict(city, district, purpose = 'for-sale') {
  const seen = new Set(); const hits = [];
  async function rec(lo, hi) {
    const nf = [`price>=${lo}`]; if (hi !== Infinity) nf.push(`price<${hi}`);
    const j = await algolia(city, district, purpose, nf);
    if (j.nbHits > 1000 && hi - lo > 1) {
      const mid = Math.floor((lo + (hi === Infinity ? lo * 2 + 2000000 : hi)) / 2);
      await rec(lo, mid); await rec(mid, hi); return;
    }
    for (const h of j.hits || []) if (!seen.has(h.externalID)) { seen.add(h.externalID); hits.push(h); }
  }
  await rec(0, Infinity);
  return hits.map((h) => {
    const area = h.area || null, price = h.price || null;
    const d = loc(h, 3) || district;
    return {
      source: 'bayut',
      sourceId: String(h.externalID),
      title: h.title || '',
      category: mapCategory(h),
      district: String(d).replace(/^حي\s+/, ''),
      city: loc(h, 1) || city,
      beds: h.rooms || null,
      area,
      price,
      pricePerM: (price && area) ? Math.round(price / area) : null,
      lat: h._geoloc?.lat ?? null,
      lng: h._geoloc?.lng ?? null,
      url: 'https://www.bayut.sa/العقار/تفاصيل-' + h.externalID + '.html',
      saleType: h.completionStatus === 'off-plan' ? 'offplan' : h.completionStatus === 'completed' ? 'ready' : null,
      active: true,
    };
  });
}

/** يسحب بيوت لمدينة + قائمة أحياء → عقارات مطبَّعة (Property) */
export async function crawlBayut({ city = 'الرياض', districts = RIYADH_DISTRICTS } = {}) {
  const all = [];
  for (const d of districts) {
    try { const rows = await scrapeDistrict(city, d); all.push(...rows); logger.info('bayut-district', { district: d, count: rows.length }); }
    catch (e) { logger.warn('bayut-district-fail', { district: d, error: e?.message }); }
  }
  return all;
}
