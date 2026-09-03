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

async function algolia(city, district, purpose, numeric = [], page = 0, extraFilters = []) {
  const facetFilters = [['purpose:' + purpose], ['location.slug:/' + city], ['location.name:' + district], ...extraFilters];
  const res = await fetch(`https://${APP}-dsn.algolia.net/1/indexes/${IDX}/query`, {
    method: 'POST',
    headers: { 'X-Algolia-Application-Id': APP, 'X-Algolia-API-Key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hitsPerPage: 1000,
      page,
      facetFilters,
      numericFilters: numeric || [],
    }),
  });
  if (!res.ok) throw new Error('algolia ' + res.status);
  return res.json();
}

// يسحب كل وحدات حي (بيع) مع التقسيم الديناميكي والترقيم الكامل
async function scrapeDistrict(city, district, purpose = 'for-sale') {
  const seen = new Set();
  const hits = [];

  async function fetchAllPages(numericFilters, extraFilters = []) {
    let page = 0;
    let nbPages = 1;
    while (page < nbPages) {
      const res = await algolia(city, district, purpose, numericFilters, page, extraFilters);
      nbPages = res.nbPages || 1;
      for (const h of res.hits || []) {
        if (!seen.has(h.externalID)) {
          seen.add(h.externalID);
          hits.push(h);
        }
      }
      page++;
    }
  }

  async function rec(lo, hi, extraFilters = []) {
    const nf = [`price>=${lo}`];
    if (hi !== Infinity) nf.push(`price<${hi}`);

    const firstCheck = await algolia(city, district, purpose, nf, 0, extraFilters);
    const total = firstCheck.nbHits || 0;

    if (total === 0) return;

    // إذا كان إجمالي النتائج أقل أو يساوي 1000، يمكن جلبها مباشرة عبر الصفحات
    if (total <= 1000) {
      await fetchAllPages(nf, extraFilters);
      return;
    }

    // إذا تجاوزت 1000 وكان النطاق السعري قابلاً للتقسيم
    if (hi - lo > 1) {
      let mid;
      if (hi === Infinity) {
        // البحث عن سعر أقصى واقعي من النتائج الحالية كحد أدنى للنطاق
        const currentPrices = (firstCheck.hits || []).map((h) => h.price).filter((p) => typeof p === 'number' && p > lo);
        const maxPriceInHits = currentPrices.length ? Math.max(...currentPrices) : lo + 1000000;
        mid = Math.max(lo + 100000, Math.floor((lo + maxPriceInHits) / 2));
      } else {
        mid = Math.floor((lo + hi) / 2);
      }

      await rec(lo, mid, extraFilters);
      await rec(mid, hi, extraFilters);
      return;
    }

    // إذا تساوت الأسعار وما زال العدد أكثر من 1000، نقسم حسب فئات العقارات
    const categories = ['apartments', 'villas', 'floors', 'townhouses', 'residential-building', 'residential-land', 'commercial-land', 'rest_houses', 'offices', 'shops'];
    if (extraFilters.length === 0) {
      for (const cat of categories) {
        await rec(lo, hi, [[`category.slug:${cat}`]]);
      }
      return;
    }

    // في حال الاستنفاد التام لجلب كل الصفحات المتاحة حتى 1000
    await fetchAllPages(nf, extraFilters);
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
