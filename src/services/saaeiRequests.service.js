// مزامنة طلبات العملاء من ساعي → القاعدة، ووسمها مطابَق/غير مطابَق كما في ساعي.
// قيود متطلبات ساعي: حجم الصفحة 20 (تخفيف حمل خادمهم)، مزامنة تفاضلية تقف عند الطلبات المعروفة،
// وتجديد التوكن يوميًا. (§17 صمود · §18 مهلة · §21 لا أسرار في الكود)
import { env } from '../config/environment.js';
import { logger } from '../utils/logger.js';
import { ClientRequest } from '../models/ClientRequest.js';
import { stateDue } from '../models/AppState.js';
import { getActiveToken, refreshToken, tokenStatus } from './saaeiToken.service.js';

const PAGE = 20; // مطلوب من مدير آيتي ساعي — لا يُغيَّر دون إذنهم

// ---------- طلب مُهلة إلى ساعي بالتوكن النشط ----------
async function saaeiGet(path, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.saaeiTimeoutMs);
  try {
    const res = await fetch(`${env.saaeiApiUrl}${path}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (res.status === 401 || res.status === 403) {
      const ref = await refreshToken();
      if (ref.ok && ref.token) {
        return saaeiGet(path, ref.token);
      }
    }
    if (!res.ok) return { ok: false, status: res.status };
    const j = await res.json().catch(() => null);
    const arr = Array.isArray(j) ? j : (j?.data || j?.results || j?.items || []);
    return { ok: true, arr: Array.isArray(arr) ? arr : [], pageCount: j?.pageCount ?? null, total: j?.totalCount ?? null };
  } catch (e) {
    return { ok: false, status: 0, error: e?.message };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- تطبيع الحقول (ساعي يرسل بالإنجليزية) ----------
const pick = (o, keys) => { for (const k of keys) if (o?.[k] != null && o[k] !== '') return o[k]; return null; };
const deep = (o, p) => { try { return p.split('.').reduce((a, k) => (a == null ? a : a[k]), o); } catch { return null; } };
const numOr = (v) => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) && n > 0 ? n : null; };

function normCat(v) {
  const s = String(v || '');
  if (/شقة|شقق|apartment/i.test(s)) return 'شقة';
  if (/تاون|townhouse/i.test(s)) return 'تاون هاوس';
  if (/دوبلكس|duplex/i.test(s)) return 'فيلا';
  if (/دور|floor/i.test(s)) return 'دور';
  if (/فيلا|فلل|villa/i.test(s)) return 'فيلا';
  if (/أرض|ارض|land/i.test(s)) return 'أرض';
  if (/عمارة|عماير|building/i.test(s)) return 'عمارة';
  return s || null;
}

// أحياء الرياض بالجذر (بلا أداة تعريف) → العربية. غير المُطابَق يبقى كما ورد (لا اختراع).
const AREA_AR = {
  munisiyah: 'المونسية', monsiyah: 'المونسية', 'dar al baida': 'الدار البيضاء', baida: 'الدار البيضاء',
  narjis: 'النرجس', yasmin: 'الياسمين', arid: 'العارض', aarid: 'العارض', malqa: 'الملقا', hittin: 'حطين',
  nakheel: 'النخيل', nakhil: 'النخيل', wadi: 'الوادي', ghadir: 'الغدير', sahafah: 'الصحافة', rabie: 'الربيع', rabi: 'الربيع',
  qurtubah: 'قرطبة', qurtoba: 'قرطبة', qadisiyah: 'القادسية', rimal: 'الرمال', aqiq: 'العقيق', malaz: 'الملز',
  olaya: 'العليا', ulaya: 'العليا', sulimaniyah: 'السليمانية', sulaymaniyah: 'السليمانية', murabba: 'المربع', wurud: 'الورود',
  mughrizat: 'المغرزات', izdihar: 'الازدهار', nada: 'الندى', falah: 'الفلاح', qirawan: 'القيروان', kairawan: 'القيروان',
  tuwaiq: 'طويق', irqah: 'عرقة', irga: 'عرقة', 'dhahrat laban': 'ظهرة لبن', namar: 'نمار', shifa: 'الشفا', aziziyah: 'العزيزية',
  badiah: 'البديعة', suwaidi: 'السويدي', swaidi: 'السويدي', dariyah: 'الدرعية', diriyah: 'الدرعية', laban: 'لبن',
  mansuriyah: 'المنصورية', khaleej: 'الخليج', khalij: 'الخليج', rayan: 'الريان', rayyan: 'الريان', rayaan: 'الريان',
  maizilah: 'المعيزيلة', janadriyah: 'الجنادرية', rawdah: 'الروضة', andalus: 'الأندلس', ishbiliyah: 'إشبيلية',
  quds: 'القدس', hamra: 'الحمراء', nadwa: 'الندوة', salam: 'السلام', fayha: 'الفيحاء', faiha: 'الفيحاء',
  marwah: 'المروة', murooj: 'المروج', muruj: 'المروج', safa: 'الصفا', safaa: 'الصفا', saadah: 'السعادة', saada: 'السعادة',
  manar: 'المنار', taawun: 'التعاون', muhammadiyah: 'المحمدية', rabwah: 'الربوة', rawabi: 'الروابي', khuzama: 'الخزامى',
  yarmuk: 'اليرموك', naseem: 'النسيم', nasim: 'النسيم', mahdiyah: 'المهدية', nahdah: 'النهضة', 'wadi laban': 'وادي لبن',
  fursan: 'الفرسان', nuzhah: 'النزهة', bayan: 'البيان', hazm: 'الحزم', uqaz: 'عكاظ', rehab: 'الرحاب', masif: 'المصيف',
  ufuq: 'الأفق', mursalat: 'المرسلات', 'king faisal': 'الملك فيصل', ghirnatah: 'غرناطة', ghirnata: 'غرناطة', badr: 'بدر',
  'king fahd': 'الملك فهد', 'east naseem': 'النسيم الشرقي', nafl: 'النفل', farouk: 'الفاروق', faruq: 'الفاروق',
  'umm al hamam eastern': 'أم الحمام الشرقي', 'umm al hamam western': 'أم الحمام الغربي', 'umm al hamam': 'أم الحمام',
  taibah: 'طيبة', ashuhada: 'الشهداء', shuhada: 'الشهداء', nakhbah: 'النخبة', 'king abdullah': 'الملك عبدالله',
  zomorod: 'الزمرد', zumurrud: 'الزمرد', wizarat: 'الوزارات', waha: 'الواحة',
};
function normArea(name) {
  const raw = String(name || '').trim();
  if (!raw) return null;
  if (/[؀-ۿ]/.test(raw)) return raw.replace(/^حي\s+/, ''); // عربي أصلًا
  const low = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (AREA_AR[low]) return AREA_AR[low];
  const core = low.replace(/^(al|an|as|ash|ar|ad|at|ath|az|el)\s+/, '');
  return AREA_AR[core] || raw;
}
function purposeOf(r) {
  const s = String(pick(r, ['clientType']) || '') + String(pick(r, ['purpose']) || '');
  if (/rent|إيجار|ايجار/i.test(s)) return 'إيجار';
  if (/housing|buy|sale|بيع|تمليك/i.test(s)) return 'بيع';
  return null;
}

// استخراج على بنية ساعي الحقيقية (subCategory إنجليزي، area.areaName إنجليزي، priceFrom/priceTo، user=الموظف)
export function extractRequest(raw) {
  const catRaw = deep(raw, 'subCategory.categoryName') || deep(raw, 'category.categoryName') || pick(raw, ['type']);
  return {
    saaeiId: String(pick(raw, ['id', '_id', 'requestId']) || ''),
    clientName: pick(raw, ['fullname', 'clientName', 'name']),
    phone: pick(raw, ['phone', 'mobile']),
    category: normCat(catRaw),
    city: deep(raw, 'city.cityName') || pick(raw, ['city']),
    district: normArea(deep(raw, 'area.areaName') || pick(raw, ['district', 'neighborhood'])),
    purpose: purposeOf(raw),
    beds: numOr(pick(raw, ['bedrooms', 'rooms', 'beds'])),
    priceMin: numOr(pick(raw, ['priceFrom', 'minPrice', 'budgetFrom'])),
    priceMax: numOr(pick(raw, ['priceTo', 'maxPrice', 'budgetTo', 'budget'])),
    areaMin: numOr(pick(raw, ['spaceFrom', 'areaFrom', 'minArea'])),
    areaMax: numOr(pick(raw, ['spaceTo', 'areaTo', 'maxArea'])),
    status: pick(raw, ['status', 'state']),
    // القائمة تُسلسل null كـfalse فلا تُميّز — نثق بـtrue فقط، والباقي يُوسَم لاحقًا بفلتر الخادم
    matched: raw.hasSuggestedAdvertisements === true ? 1 : null,
    employee: deep(raw, 'user.fullname') || deep(raw, 'assignedTo.fullname'),
    note: [raw.firstHousing ? 'أول سكن' : '', raw.clientType ? `نوع: ${raw.clientType}` : ''].filter(Boolean).join(' · ') || null,
    saaeiCreatedAt: pick(raw, ['createdAt', 'actionDate']),
    raw,
  };
}

async function upsertRequest(doc) {
  const { saaeiId, ...rest } = doc;
  if (!saaeiId) return;
  await ClientRequest.updateOne({ saaeiId }, { $set: { ...rest, saaeiId, syncedAt: new Date() } }, { upsert: true });
}

// ---------- مزامنة تفاضلية ----------
export async function syncRequests({ force = false, maxPages = 300 } = {}) {
  // تجديد التوكن عند كل عملية مزامنة وتحديث .env وقاعدة البيانات
  await refreshToken();
  const token = await getActiveToken();
  if (!token) return { ok: false, reason: 'no_token', added: 0 };

  let added = 0, page = 1;
  for (; page <= maxPages; page++) {
    const r = await saaeiGet(`/requests?page=${page}&limit=${PAGE}`, token);
    if (!r.ok) return { ok: false, reason: `http_${r.status}`, added };
    if (!r.arr.length) break;

    const ids = r.arr.map((x) => String(x.id ?? x._id)).filter(Boolean);
    let knownBefore = 0;
    if (ids.length && !force) {
      knownBefore = await ClientRequest.countDocuments({ saaeiId: { $in: ids } });
    }

    for (const raw of r.arr) { await upsertRequest(extractRequest(raw)); added++; }
    if (r.arr.length < PAGE || (r.pageCount && page >= r.pageCount)) break; // آخر صفحة

    // توقف تفاضلي: إن كانت كل معرّفات الصفحة موجودة مسبقًا وليس force، فقد بلغنا الطلبات المزامَنة سابقًا
    if (!force && ids.length && knownBefore >= ids.length) break;
  }

  // وسم «غير مطابَق» من فلتر الخادم — مرة يوميًا فقط (أو force) تخفيفًا لحمل ساعي
  let tagged = -1;
  if (force || (await stateDue('saaei_tag', 20))) tagged = await tagMatched(token);
  logger.info('requests-sync', { added, pages: page, tagged });
  return { ok: true, added, pages: page, unmatched: tagged };
}

// يجلب معرّفات «غير المطابَقة» من فلتر الخادم (20/صفحة) ويضبط matched=0 (true محفوظ من الصف، وإلا null)
export async function tagMatched(token) {
  const ids = [];
  for (let page = 1; page <= 400; page++) {
    const r = await saaeiGet(`/requests?hasSuggestedAdvertisements=false&page=${page}&limit=${PAGE}`, token);
    if (!r.ok) break;
    for (const x of r.arr) { const id = x.id ?? x._id; if (id != null) ids.push(String(id)); }
    if (r.arr.length < PAGE || (r.pageCount && page >= r.pageCount)) break;
  }
  if (!ids.length) return 0;
  await ClientRequest.updateMany({ saaeiId: { $in: ids } }, { $set: { matched: 0 } });
  return ids.length;
}

export async function requestCounts() {
  const [all, matched, unmatched] = await Promise.all([
    ClientRequest.estimatedDocumentCount(),
    ClientRequest.countDocuments({ matched: 1 }),
    ClientRequest.countDocuments({ matched: 0 }),
  ]);
  return { all, matched, unmatched, unknown: all - matched - unmatched };
}

// نصّ الطلب لأغراض السجل/العرض
export function requestSummary(r) {
  return [r.category, r.beds ? `${r.beds} غرف` : '', r.district || r.city,
  r.purpose, r.priceMax ? `حتى ${r.priceMax}` : ''].filter(Boolean).join(' · ');
}
