// سحّاب عقار (sa.aqar.fm) — البيانات مدمجة في RSC (self.__next_f.push). fetch + تفكيك، بلا متصفح.
// منقول من موصّل منصّة تحليل السوق. يعيد عقارات مطبَّعة لشكل Property (Mongo). صفحة أولى لكل حي×تصنيف.
import { logger } from '../../utils/logger.js';

const BASE = 'https://sa.aqar.fm';
const IMG_HOST = 'https://images.aqar.fm';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

export const CATEGORIES = [
  { category: 'شقة', slug: 'شقق-للبيع' },
  { category: 'دور', slug: 'دور-للبيع' },
  { category: 'فيلا', slug: 'فلل-للبيع' },
  { category: 'أرض', slug: 'أراضي-للبيع' },
];
export const RIYADH_DISTRICTS = [
  'النرجس', 'الرمال', 'حطين', 'الملقا', 'الياسمين', 'العارض', 'المونسية', 'قرطبة',
  'العقيق', 'الصحافة', 'النخيل', 'الملز', 'المحمدية', 'الربوة', 'الروضة',
];

const num = (v) => { if (v == null) return null; const n = Number(String(v).replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : null; };

// تفكيك كائنات الإعلانات من حمولة RSC — يفكّ كل مقطع بـJSON.parse ثم يطابق الأقواس حول كل "price"
function parseListings(html) {
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let blob = '', m;
  while ((m = re.exec(html)) !== null) {
    try { blob += JSON.parse('"' + m[1] + '"'); } catch { /* مقطع تالف */ }
  }
  const out = []; let idx = -1;
  while ((idx = blob.indexOf('"price"', idx + 1)) !== -1) {
    let depth = 0, start = -1;
    for (let j = idx; j >= 0; j--) {
      const ch = blob[j];
      if (ch === '}') depth++;
      else if (ch === '{') { if (depth === 0) { start = j; break; } depth--; }
    }
    if (start === -1) continue;
    depth = 0; let end = -1;
    for (let k = start; k < blob.length; k++) {
      const ch = blob[k];
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { end = k; break; } }
    }
    if (end === -1) continue;
    try { const o = JSON.parse(blob.slice(start, end + 1)); if (o && o.price != null && o.area != null && o.id != null) out.push(o); }
    catch { /* ليس إعلانًا */ }
  }
  const seen = new Set();
  return out.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
}

function normalize(o, target) {
  const area = num(o.area), price = num(o.price);
  return {
    source: 'aqar',
    sourceId: String(o.id),
    title: o.title || null,
    category: target.category,
    district: String(o.district || target.district).replace(/^حي\s+/, ''),
    city: o.city || 'الرياض',
    beds: num(o.beds),
    area,
    price,
    pricePerM: (price && area) ? Math.round(price / area) : null,
    lat: o.location?.lat ?? null,
    lng: o.location?.lng ?? null,
    url: o.path ? BASE + '/' + String(o.path).replace(/^\//, '') : null,
    saleType: /على الخارطة|الخريطة|تحت الإنشاء|وافي/.test(o.content || o.title || '') ? 'offplan' : /جاهز|استلام فوري/.test(o.content || o.title || '') ? 'ready' : null,
    active: true,
  };
}

async function fetchPage(slug, district, page = 1) {
  const pageParam = page > 1 ? `/${page}` : '';
  const url = `${BASE}/${encodeURIComponent(slug)}/${encodeURIComponent(district)}${pageParam}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ar' }, redirect: 'follow' });
  if (!res.ok) return [];
  return parseListings(await res.text());
}

/** يسحب عقار لمدينة + أحياء × تصنيفات عبر جميع الصفحات المتوفرة → عقارات مطبَّعة (Property) */
export async function crawlAqar({ districts = RIYADH_DISTRICTS, categories = CATEGORIES } = {}) {
  const all = [];
  const seenIds = new Set();

  for (const d of districts) {
    for (const cat of categories) {
      let page = 1;
      let hasMore = true;
      let catCount = 0;

      try {
        while (hasMore) {
          const objs = await fetchPage(cat.slug, d, page);
          
          if (!objs || objs.length === 0) {
            hasMore = false;
            break;
          }

          let newItemsCount = 0;
          for (const o of objs) {
            if (!seenIds.has(o.id)) {
              seenIds.add(o.id);
              all.push(normalize(o, { category: cat.category, district: d }));
              newItemsCount++;
            }
          }

          catCount += newItemsCount;

          // إذا لم تُرجع الصفحة أي عناصر جديدة مضافة (بسبب الوصول لصفحة مكررة أو نفاذ الإعلانات)، نتوقف
          if (newItemsCount === 0 || objs.length < 5) {
            hasMore = false;
          } else {
            page++;
          }
        }
        logger.info('aqar-target', { district: d, category: cat.category, count: catCount, pages: page });
      } catch (e) {
        logger.warn('aqar-target-fail', { district: d, category: cat.category, error: e?.message });
      }
    }
  }
  return all;
}
