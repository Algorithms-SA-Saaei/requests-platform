// واجهة الويب (صفحات HTML مُخدَّمة من الخادم) — دخول + لوحة الطلبات (تبويبات) + العقارات المناسبة.
// تستهلك نفس الخدمات والنماذج. المصادقة بكوكي JWT (نفس رمز الـAPI).
import { ClientRequest } from '../models/ClientRequest.js';
import { requestCounts, requestSummary, syncRequests } from '../services/saaeiRequests.service.js';
import { matchesForRequest } from '../services/matching.service.js';
import { tokenStatus } from '../services/saaeiToken.service.js';
import { marketReport, districtsWithData, compareDistricts, priceUnit, saleSplit } from '../services/market.service.js';
import { demandGaps } from '../services/demand.service.js';
import { nearbyProperties, mapProperties, marketOverview, projectsList, dataHealth, exportPropertiesCsv } from '../services/market.service.js';
import { User, verifyPassword } from '../models/User.js';
import { signToken } from '../middleware/auth.middleware.js';
import { env } from '../config/environment.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n) => (n == null || !Number.isFinite(+n) ? '—' : Number(Math.round(+n)).toLocaleString('en-US'));
const cookieOpts = { httpOnly: true, secure: env.isProd, sameSite: 'lax', maxAge: 12 * 3600 * 1000, path: '/' };

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
  *{box-sizing:border-box} body{margin:0;background:#f0f2f4;color:#17222e;font-family:"Tajawal",sans-serif;border-top:4px solid #23305a}
  a{color:#229799;text-decoration:none}
  header{background:#fff;border-bottom:1px solid #e2ebec;padding:14px 26px;display:flex;align-items:center;justify-content:space-between}
  header .b{display:flex;align-items:center;gap:10px} header img{height:28px} header h1{font-size:17px;margin:0;color:#23305a}
  header .u{font-size:12.5px;color:#6b7a84} header a.out{color:#b23a48;font-size:13px;font-weight:700}
  .wrap{max-width:1040px;margin:0 auto;padding:22px}
  .tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
  .tab{background:#fff;border:1px solid #e2ebec;border-radius:10px;padding:9px 16px;font-size:13.5px;font-weight:700;color:#5b6b76}
  .tab.on{background:#23305a;color:#fff;border-color:#23305a}
  .tab .tn{display:inline-block;background:rgba(0,0,0,.08);border-radius:10px;padding:1px 8px;font-size:11.5px;margin-inline-start:4px}
  .tab.on .tn{background:rgba(255,255,255,.2)}
  .bar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px}
  .btn{background:#229799;color:#fff;border:0;border-radius:10px;padding:9px 16px;font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit;text-decoration:none;display:inline-block}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2ebec;border-radius:12px;overflow:hidden}
  th,td{padding:11px 12px;text-align:right;border-bottom:1px solid #eef2f3;font-size:13.5px} th{background:#eef3f7;color:#23305a;font-weight:800;font-size:12px}
  tr:last-child td{border-bottom:0}
  .chip{display:inline-block;background:#e7f0f1;color:#23305a;border-radius:16px;padding:2px 9px;margin:2px;font-size:11.5px}
  .st{display:inline-block;border-radius:14px;padding:2px 10px;font-size:11.5px;font-weight:700}
  .m{color:#6b7a84} .pg{display:flex;gap:8px;justify-content:center;margin-top:16px;align-items:center}
  .pg a{padding:7px 14px;border:1px solid #e2ebec;border-radius:9px;background:#fff;font-weight:700;font-size:13px}
  .pg .cur{color:#6b7a84;font-size:13px}
  .mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
  .mcard{background:#fff;border:1px solid #e2ebec;border-radius:14px;overflow:hidden;display:flex}
  .mscore{color:#fff;font-weight:800;font-size:17px;display:flex;align-items:center;justify-content:center;min-width:60px}
  .mbody{padding:12px 14px;flex:1;min-width:0} .mtitle{font-weight:700;font-size:14px;margin-bottom:5px} .mmeta{font-size:12px;color:#5c5049;margin-bottom:3px}
  .rz{font-size:11px;background:#e7f0f1;border-radius:6px;padding:2px 7px;margin:2px;display:inline-block}
  .login{max-width:360px;margin:9vh auto;background:#fff;border:1px solid #e2ebec;border-radius:16px;padding:30px 28px;box-shadow:0 10px 40px -24px rgba(20,40,60,.4)}
  .login h2{margin:0 0 4px;color:#23305a} .login .s{color:#6b7a84;font-size:13px;margin-bottom:18px}
  .login input{width:100%;padding:11px;border-radius:10px;border:1px solid #d3e0e2;margin-bottom:12px;font-family:inherit;font-size:14px}
  .login button{width:100%;padding:12px;border:0;border-radius:10px;background:#23305a;color:#fff;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit}
  .err{background:#fbeef0;color:#b23a48;border:1px solid #f0c9cf;border-radius:9px;padding:9px 12px;font-size:13px;margin-bottom:14px}
`;

const shell = (title, body, user, extraHead = '') => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — طلبات ساعي</title>${extraHead}<style>${CSS}</style></head><body>
<header><div class="b"><img src="https://saaei.co/assets/img/main_logo.svg" alt="ساعي" onerror="this.style.display='none'"><h1>طلبات ساعي</h1></div><nav style="display:flex;gap:14px;font-size:13.5px;flex-wrap:wrap"><a href="/">الطلبات</a><a href="/market">دراسة السوق</a><a href="/compare">مقارنة</a><a href="/pricing">تسعير</a><a href="/sale-split">جاهز/خارطة</a><a href="/projects">المشاريع</a><a href="/demands">فجوات</a><a href="/map">الخريطة</a><a href="/nearby">قرب موقع</a><a href="/analytics">تحليلات</a>${user && (user.role === 'admin' || user.role === 'manager') ? '<a href="/health">الصحة</a><a href="/crawl-center">السحب</a><a href="/export/properties.csv">تصدير</a>' : ''}</nav>
${user ? `<div><span class="u">${esc(user.name || '')}</span> · <a class="out" href="/logout">خروج</a></div>` : ''}</header>
<div class="wrap">${body}</div></body></html>`;

// ---------- الدخول ----------
export function loginPage(req, res) {
  const err = req.query.e ? '<div class="err">الاسم أو كلمة المرور غير صحيحة</div>' : '';
  res.send(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>دخول — طلبات ساعي</title><style>${CSS}</style></head><body>
  <form class="login" method="POST" action="/login">
    <h2>طلبات ساعي</h2><div class="s">سجّل الدخول للمتابعة</div>${err}
    <input name="username" placeholder="اسم المستخدم" autofocus required>
    <input name="password" type="password" placeholder="كلمة المرور" required>
    <button>دخول</button>
  </form></body></html>`);
}

export async function doLogin(req, res) {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = await User.findOne({ username, isActive: true }).select('+passwordHash');
  if (!user || !(await verifyPassword(password, user.passwordHash))) return res.redirect('/login?e=1');
  user.lastLoginAt = new Date(); await user.save();
  res.cookie('token', signToken({ id: user._id, role: user.role, name: user.name }), cookieOpts);
  res.redirect('/');
}

export function doLogout(_req, res) { res.clearCookie('token', { ...cookieOpts, maxAge: undefined }); res.redirect('/login'); }

// ---------- لوحة الطلبات ----------
const TABS = [
  { k: 'all', label: 'الكل', f: {} },
  { k: 'unmatched', label: 'غير مطابَقة (فرصة)', f: { matched: 0 } },
  { k: 'matched', label: 'مطابَقة في ساعي', f: { matched: 1 } },
  { k: 'unknown', label: 'غير محدَّدة', f: { matched: null } },
];

export async function dashboard(req, res) {
  const tabDef = TABS.find((t) => t.k === req.query.tab) || TABS[0];
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 20;
  const [items, total, counts, ts] = await Promise.all([
    ClientRequest.find(tabDef.f).sort({ saaeiCreatedAt: -1, syncedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ClientRequest.countDocuments(tabDef.f),
    requestCounts(),
    tokenStatus(),
  ]);
  const isAdmin = req.user.role === 'admin' || req.user.role === 'manager';
  const cnt = { all: counts.all, unmatched: counts.unmatched, matched: counts.matched, unknown: counts.unknown };
  const tabs = TABS.map((t) => `<a class="tab${t.k === tabDef.k ? ' on' : ''}" href="/?tab=${t.k}">${t.label} <span class="tn">${(cnt[t.k] || 0).toLocaleString('en-US')}</span></a>`).join('');
  const rows = items.map((r) => {
    const chips = [r.category, r.beds ? r.beds + ' غرف' : '', r.district || r.city,
      (r.priceMin || r.priceMax) ? `${fmt(r.priceMin)}–${fmt(r.priceMax)} ر` : '']
      .filter(Boolean).map((c) => `<span class="chip">${esc(c)}</span>`).join('');
    const badge = r.matched === 1 ? '<span class="st" style="background:#eaf5ef;color:#2e8b57">مطابَق</span>'
      : r.matched === 0 ? '<span class="st" style="background:#fbf3e2;color:#a86e12">فرصة</span>'
      : '<span class="st" style="background:#eef2f3;color:#6b7a84">غير محدَّد</span>';
    return `<tr>
      <td><b>${esc(r.clientName || 'عميل')}</b>${r.phone ? `<div class="m" style="font-size:11px">${esc(r.phone)}</div>` : ''}</td>
      <td>${chips || '<span class="m">—</span>'}</td>
      <td>${r.status ? `<span class="st" style="background:#e7f0f1;color:#23305a">${esc(r.status)}</span> ` : ''}${badge}</td>
      <td class="m" style="font-size:12px">${esc((r.saaeiCreatedAt ? new Date(r.saaeiCreatedAt).toISOString().slice(0, 10) : '—'))}</td>
      <td><a class="btn" style="padding:6px 13px;font-size:12.5px" href="/r/${esc(r.saaeiId)}">العقارات المناسبة ←</a></td>
    </tr>`;
  }).join('');
  const pageCount = Math.ceil(total / limit) || 1;
  const pager = `<div class="pg">
    ${page > 1 ? `<a href="/?tab=${tabDef.k}&page=${page - 1}">→ السابق</a>` : ''}
    <span class="cur">صفحة ${page} من ${pageCount} · ${total} طلب</span>
    ${page < pageCount ? `<a href="/?tab=${tabDef.k}&page=${page + 1}">التالي ←</a>` : ''}</div>`;
  const body = `
    ${tabs ? `<div class="tabs">${tabs}</div>` : ''}
    <div class="bar">
      <div><b style="font-size:16px;color:#23305a">طلبات العملاء</b> <span class="m">${ts.set && ts.daysLeft != null ? '· التوكن صالح ' + ts.daysLeft + ' يوم' : ''}</span></div>
      ${isAdmin ? '<form method="POST" action="/sync"><button class="btn">↻ مزامنة الآن</button></form>' : ''}
    </div>
    <table><thead><tr><th>العميل</th><th>الطلب</th><th>الحالة</th><th>التاريخ</th><th>المطابقة</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="m" style="text-align:center;padding:26px">لا طلبات — شغّل المزامنة.</td></tr>'}</tbody></table>
    ${total > limit ? pager : ''}`;
  res.send(shell('طلبات ساعي', body, req.user));
}

export async function requestDetailPage(req, res) {
  let data;
  try { data = await matchesForRequest(String(req.params.id), { limit: 30 }); }
  catch { return res.status(404).send(shell('غير موجود', '<p class="m">الطلب غير موجود.</p>', req.user)); }
  const r = data.request;
  const chips = [r.category, r.beds ? r.beds + ' غرف' : '', r.district || r.city, r.purpose,
    (r.priceMin || r.priceMax) ? `${fmt(r.priceMin)}–${fmt(r.priceMax)} ر` : '']
    .filter(Boolean).map((c) => `<span class="chip">${esc(c)}</span>`).join('');
  const tone = (s) => (s >= 80 ? '#2e8b57' : s >= 55 ? '#23305a' : '#c0504d');
  const cards = data.results.map((u) => `
    <div class="mcard"><div class="mscore" style="background:${tone(u.score)}">${u.score}%</div>
      <div class="mbody"><div class="mtitle">${esc((u.title || u.category || 'وحدة').slice(0, 70))}</div>
        <div class="mmeta">${esc(u.category || '')} · ${u.beds != null ? u.beds + ' غرف · ' : ''}${fmt(u.area)}م² · <b>${fmt(u.price)}</b> ريال</div>
        <div class="mmeta">${esc(u.district || '—')}${u.projectName ? ' · ' + esc(u.projectName) : ''}</div>
        <div style="margin-top:7px">${(u.reasons || []).map((x) => `<span class="rz">${esc(x)}</span>`).join('')}</div>
        ${u.url ? `<div style="margin-top:6px;font-size:12px"><a href="${esc(u.url)}" target="_blank">المصدر ↗</a></div>` : ''}
      </div></div>`).join('');
  const body = `
    <div style="margin-bottom:8px"><a class="m" href="/">← كل الطلبات</a></div>
    <div style="background:#fff;border:1px solid #e2ebec;border-radius:14px;padding:18px;margin-bottom:16px">
      <div style="font-size:18px;font-weight:800;color:#23305a">${esc(r.clientName || 'عميل')}${r.phone ? ` <span class="m" style="font-size:13px">· ${esc(r.phone)}</span>` : ''}</div>
      <div style="margin-top:8px">${chips || '<span class="m">طلب عام</span>'}</div>
      ${r.employee ? `<div class="m" style="margin-top:6px;font-size:12.5px">الموظف: ${esc(r.employee)}</div>` : ''}
    </div>
    <div class="bar"><b style="font-size:15px;color:#23305a">العقارات المناسبة</b> <span class="m">من ${data.pool} وحدة مرشّحة</span></div>
    <div class="mgrid">${cards || '<div class="m" style="background:#fff;border:1px dashed #cdd8da;border-radius:12px;padding:22px;text-align:center">لا عقارات مطابقة في المخزون الحالي — عبّئ مخزون Property (راجع README).</div>'}</div>`;
  res.send(shell('طلب: ' + (r.clientName || r.saaeiId), body, req.user));
}

export async function doSync(_req, res) { await syncRequests({ force: true }); res.redirect('/'); }

// ---------- دراسة السوق ----------
export async function marketPage(req, res) {
  const cat = ['شقة', 'دور', 'فيلا', 'تاون هاوس', 'أرض'].includes(req.query.category) ? req.query.category : 'شقة';
  const district = req.query.district || '';
  const [dists, rep] = await Promise.all([
    districtsWithData(cat),
    district ? marketReport(district, cat) : null,
  ]);
  const stripHay = (x) => String(x || '').replace(/^حي\s+/, '');
  const catOpts = ['شقة', 'دور', 'فيلا', 'تاون هاوس', 'أرض'].map((x) => `<option ${x === cat ? 'selected' : ''}>${x}</option>`).join('');
  const dopts = dists.map((x) => `<div class="dopt" data-v="${esc(stripHay(x.district))}">${esc(stripHay(x.district))}${x.city && x.city !== 'الرياض' ? ' · ' + esc(x.city) : ''} <span class="dn">${x.count}</span></div>`).join('');
  const kpi = (v, l) => `<div class="mt"><b>${v == null ? '—' : fmt(v)}</b><span>${l}</span></div>`;
  const body = rep && rep.count ? `
    <div class="metrics">
      ${kpi(rep.ppmMedian, 'وسيط سعر المتر')}
      ${kpi(rep.count, 'عدد العيّنة')}
      ${kpi(rep.ppmMin, 'أدنى سعر متر')}
      ${kpi(rep.ppmMax, 'أعلى سعر متر')}
    </div>
    <div class="bar"><b style="color:#23305a">عيّنة من السوق</b> <span class="m">أعلى ${rep.sample.length}</span></div>
    <table><thead><tr><th>الحي</th><th>المساحة</th><th>السعر</th><th>ر/م²</th><th>المصدر</th><th></th></tr></thead><tbody>${
      rep.sample.map((u) => `<tr><td>${esc(stripHay(u.district))}</td><td class="num">${fmt(u.area)}م²</td><td class="num">${fmt(u.price)}</td><td class="num" style="color:#229799;font-weight:800">${fmt(u.pricePerM)}</td><td class="m">${esc(u.source)}</td><td>${u.url ? `<a href="${esc(u.url)}" target="_blank">المصدر ↗</a>` : ''}</td></tr>`).join('')
    }</tbody></table>` : (district ? '<div class="m" style="background:#fff;border:1px dashed #cdd8da;border-radius:12px;padding:22px;text-align:center">لا بيانات كافية لهذا الحي — شغّل سحب السوق أولًا.</div>' : '<div class="m" style="background:#fff;border:1px dashed #cdd8da;border-radius:12px;padding:22px;text-align:center">اختر التصنيف وابحث عن حي لعرض دراسته.</div>');
  res.send(shell('دراسة السوق', `
    <form class="mform" method="GET" action="/market" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:center">
      <select name="category" onchange="document.getElementById('mdval').value='';document.getElementById('mdq').value='';this.form.submit()" style="padding:12px;border-radius:11px;border:1px solid #d3e0e2;font-family:inherit">${catOpts}</select>
      <div class="combo" style="position:relative;flex:1;min-width:220px">
        <input type="text" id="mdq" autocomplete="off" placeholder="ابحث واختر الحي… (${dists.length})" value="${esc(stripHay(district))}" style="width:100%;padding:12px;border-radius:11px;border:1px solid #d3e0e2;font-family:inherit;box-sizing:border-box">
        <input type="hidden" name="district" id="mdval" value="${esc(stripHay(district))}">
        <div class="dopts" id="mdopts">${dopts}</div>
      </div>
    </form>
    <script>(function(){var q=document.getElementById('mdq'),box=document.getElementById('mdopts'),val=document.getElementById('mdval');if(!q)return;var items=[].slice.call(box.querySelectorAll('.dopt'));function fil(){var t=q.value.trim();box.style.display='block';items.forEach(function(it){it.style.display=(!t||it.textContent.indexOf(t)!==-1)?'':'none';});}q.addEventListener('focus',fil);q.addEventListener('input',function(){val.value='';fil();});items.forEach(function(it){it.addEventListener('mousedown',function(e){e.preventDefault();val.value=it.getAttribute('data-v');q.value=it.textContent.replace(/\s*\d+\s*$/,'').trim();box.style.display='none';q.form.submit();});});document.addEventListener('click',function(e){if(!e.target.closest('.combo'))box.style.display='none';});})();</script>
    <style>.dopts{display:none;position:absolute;top:calc(100% + 4px);right:0;left:0;max-height:300px;overflow:auto;background:#fff;border:1px solid #d3e0e2;border-radius:12px;box-shadow:0 8px 28px -12px rgba(20,40,60,.3);z-index:50}.dopt{padding:10px 14px;cursor:pointer;font-size:14px;display:flex;justify-content:space-between;border-bottom:1px solid #f0f4f5}.dopt:hover{background:#eef4f5}.dopt .dn{color:#6b7a84;font-size:12px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}.metrics .mt{background:#fff;border:1px solid #e2ebec;border-top:2px solid #229799;border-radius:0 0 10px 10px;padding:14px 16px}.metrics .mt b{display:block;font-size:26px;font-weight:800;color:#23305a}.metrics .mt span{font-size:11.5px;color:#5b6b76}.num{font-variant-numeric:tabular-nums}</style>
    ${body}`, req.user));
}

const catSel = (cat) => ['شقة','دور','فيلا','تاون هاوس','أرض'].map((x)=>`<option ${x===cat?'selected':''}>${x}</option>`).join('');

// مقارنة الأحياء
export async function comparePage(req, res) {
  const cat = ['شقة','دور','فيلا','تاون هاوس','أرض'].includes(req.query.category)?req.query.category:'شقة';
  const rows = await compareDistricts(cat);
  const max = rows.length ? rows[0].ppmMedian : 1;
  const body = `<form method="GET" action="/compare" style="margin-bottom:16px"><select name="category" onchange="this.form.submit()" style="padding:12px;border-radius:11px;border:1px solid #d3e0e2;font-family:inherit">${catSel(cat)}</select></form>
    <table><thead><tr><th>#</th><th>الحي</th><th>وسيط ر/م²</th><th>العيّنة</th><th></th></tr></thead><tbody>${
    rows.map((r,i)=>`<tr><td class="m">${i+1}</td><td><b>${esc(r.district)}</b></td><td class="num" style="color:#229799;font-weight:800">${fmt(r.ppmMedian)}</td><td class="num m">${r.count}</td><td style="width:40%"><div style="background:#eef4f5;border-radius:6px;height:10px"><div style="background:#229799;height:10px;border-radius:6px;width:${Math.round(r.ppmMedian/max*100)}%"></div></div></td></tr>`).join('')||'<tr><td colspan="5" class="m" style="text-align:center;padding:22px">لا بيانات — شغّل سحب السوق.</td></tr>'
    }</tbody></table>`;
  res.send(shell('مقارنة الأحياء', body, req.user));
}

// تسعير وحدة
export async function pricePage(req, res) {
  const cat = ['شقة','دور','فيلا','تاون هاوس','أرض'].includes(req.query.category)?req.query.category:'شقة';
  const district = req.query.district||''; const area = req.query.area||'';
  const dists = await districtsWithData(cat);
  const r = (district && area) ? await priceUnit(district, cat, area) : null;
  const dopts = dists.map((x)=>`<option value="${esc(String(x.district).replace(/^حي\s+/,''))}" ${String(x.district).replace(/^حي\s+/,'')===district?'selected':''}>${esc(String(x.district).replace(/^حي\s+/,''))} (${x.count})</option>`).join('');
  const out = r && r.estimate ? `<div class="metrics"><div class="mt"><b>${fmt(r.estimate)}</b><span>التقدير (ريال)</span></div><div class="mt"><b>${fmt(r.estimateLow)} – ${fmt(r.estimateHigh)}</b><span>المدى</span></div><div class="mt"><b>${fmt(r.ppmMedian)}</b><span>وسيط ر/م²</span></div><div class="mt"><b>${fmt(r.sample)}</b><span>العيّنة</span></div></div><style>.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metrics .mt{background:#fff;border:1px solid #e2ebec;border-top:2px solid #229799;border-radius:0 0 10px 10px;padding:14px}.metrics b{display:block;font-size:24px;font-weight:800;color:#23305a}.metrics span{font-size:11.5px;color:#5b6b76}.num{font-variant-numeric:tabular-nums}</style>` : (district&&area?'<div class="m" style="background:#fff;border:1px dashed #cdd8da;border-radius:12px;padding:22px;text-align:center">لا بيانات كافية.</div>':'<div class="m">اختر الحي والمساحة للتقدير.</div>');
  res.send(shell('تسعير وحدة', `<form method="GET" action="/pricing" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px"><select name="category" style="padding:12px;border-radius:11px;border:1px solid #d3e0e2;font-family:inherit">${catSel(cat)}</select><select name="district" style="padding:12px;border-radius:11px;border:1px solid #d3e0e2;font-family:inherit;min-width:180px"><option value="">— اختر الحي —</option>${dopts}</select><input name="area" type="number" placeholder="المساحة م²" value="${esc(area)}" style="padding:12px;border-radius:11px;border:1px solid #d3e0e2;font-family:inherit;width:130px"><button class="btn">قدّر</button></form>${out}`, req.user));
}

// فجوات الطلب
export async function demandsPage(req, res) {
  const rows = await demandGaps();
  const body = `<div class="m" style="margin-bottom:12px;font-size:13px">الفجوة = طلب العملاء ناقص المعروض. الموجب = فرصة (طلب أعلى من المعروض).</div>
    <table><thead><tr><th>الحي</th><th>التصنيف</th><th>الطلب</th><th>المعروض</th><th>الفجوة</th></tr></thead><tbody>${
    rows.map((r)=>`<tr><td><b>${esc(r.district)}</b></td><td>${esc(r.category)}</td><td class="num">${r.demand}</td><td class="num">${r.supply}</td><td class="num" style="font-weight:800;color:${r.gap>0?'#2e8b57':'#b23a48'}">${r.gap>0?'+':''}${r.gap}</td></tr>`).join('')||'<tr><td colspan="5" class="m" style="text-align:center;padding:22px">لا بيانات.</td></tr>'
    }</tbody></table>`;
  res.send(shell('فجوات الطلب', body, req.user));
}

// جاهز/خارطة
export async function saleSplitPage(req, res) {
  const cat = ['شقة','دور','فيلا','تاون هاوس','أرض'].includes(req.query.category)?req.query.category:'شقة';
  const district = req.query.district||'';
  const dists = await districtsWithData(cat);
  const r = district ? await saleSplit(district, cat) : null;
  const dopts = dists.map((x)=>`<option value="${esc(String(x.district).replace(/^حي\s+/,''))}" ${String(x.district).replace(/^حي\s+/,'')===district?'selected':''}>${esc(String(x.district).replace(/^حي\s+/,''))}</option>`).join('');
  const out = r ? `<div class="metrics"><div class="mt"><b>${fmt(r.ready.ppmMedian)}</b><span>جاهز — وسيط ر/م² (${r.ready.count})</span></div><div class="mt"><b>${fmt(r.offplan.ppmMedian)}</b><span>خارطة — وسيط ر/م² (${r.offplan.count})</span></div><div class="mt"><b>${r.offplanVsReadyPct==null?'—':(r.offplanVsReadyPct>0?'+':'')+r.offplanVsReadyPct+'%'}</b><span>فرق الخارطة عن الجاهز</span></div></div><style>.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.metrics .mt{background:#fff;border:1px solid #e2ebec;border-top:2px solid #229799;border-radius:0 0 10px 10px;padding:14px}.metrics b{display:block;font-size:24px;font-weight:800;color:#23305a}.metrics span{font-size:11.5px;color:#5b6b76}</style>${r.unknown.count?`<div class="m" style="margin-top:10px;font-size:12px">${r.unknown.count} وحدة بلا حالة بيع محدّدة (تظهر بعد إعادة السحب).</div>`:''}` : '<div class="m">اختر الحي.</div>';
  res.send(shell('جاهز / خارطة', `<form method="GET" action="/sale-split" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px"><select name="category" style="padding:12px;border-radius:11px;border:1px solid #d3e0e2;font-family:inherit">${catSel(cat)}</select><select name="district" onchange="this.form.submit()" style="padding:12px;border-radius:11px;border:1px solid #d3e0e2;font-family:inherit;min-width:180px"><option value="">— اختر الحي —</option>${dopts}</select><button class="btn">عرض</button></form>${out}`, req.user));
}

const LEAFLET = '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>';
const ppmColor = 'function(p){return p==null?"#6b7a84":p<3000?"#1a9850":p<6000?"#91cf60":p<9000?"#d6a313":p<13000?"#e07b39":"#d73027";}';

// الخريطة
export async function mapPage(req, res) {
  const cat = ['شقة','دور','فيلا','تاون هاوس','أرض'].includes(req.query.category)?req.query.category:'شقة';
  const district = req.query.district||'';
  const dists = await districtsWithData(cat);
  const pts = await mapProperties(district||null, cat);
  const dopts = dists.map((x)=>`<option value="${esc(String(x.district).replace(/^حي\s+/,''))}" ${String(x.district).replace(/^حي\s+/,'')===district?'selected':''}>${esc(String(x.district).replace(/^حي\s+/,''))} (${x.count})</option>`).join('');
  const body = `<form method="GET" action="/map" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px"><select name="category" style="padding:12px;border-radius:11px;border:1px solid #d3e0e2;font-family:inherit">${['شقة','دور','فيلا','تاون هاوس','أرض'].map(x=>`<option ${x===cat?'selected':''}>${x}</option>`).join('')}</select><select name="district" onchange="this.form.submit()" style="padding:12px;border-radius:11px;border:1px solid #d3e0e2;font-family:inherit;min-width:180px"><option value="">— كل الأحياء —</option>${dopts}</select><button class="btn">عرض</button></form>
    <div class="m" style="font-size:12px;margin-bottom:8px">${pts.length} عقار على الخريطة · اللون حسب سعر المتر (أخضر أرخص، أحمر أغلى)</div>
    <div id="map" style="height:520px;border-radius:14px;border:1px solid #e2ebec;overflow:hidden"></div>
    <script>var PTS=${JSON.stringify(pts)};var col=${ppmColor};
      var map=L.map('map',{scrollWheelZoom:false}).setView([24.71,46.67],11);map.on('focus',function(){map.scrollWheelZoom.enable()});map.on('blur',function(){map.scrollWheelZoom.disable()});
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:20,subdomains:'abcd'}).addTo(map);
      var b=[];PTS.forEach(function(p){if(p.lat&&p.lng){L.circleMarker([p.lat,p.lng],{radius:5,color:'#fff',weight:1,fillColor:col(p.ppm),fillOpacity:.85}).bindPopup((p.t||'')+'<br>'+(p.cat||'')+' · '+(p.ppm?Number(p.ppm).toLocaleString('en-US')+' ر/م²':'')+'<br>'+(p.d||'')).addTo(map);b.push([p.lat,p.lng]);}});
      if(b.length)try{map.fitBounds(b,{padding:[30,30],maxZoom:14});}catch(e){}
    </script>`;
  res.send(shell('الخريطة', body, req.user, LEAFLET));
}

// وحدات قرب موقع
export async function nearbyPage(req, res) {
  const cat = req.query.category && ['شقة','دور','فيلا','تاون هاوس','أرض'].includes(req.query.category)?req.query.category:'';
  const lat=req.query.lat, lng=req.query.lng, radius=+req.query.radius||3;
  const data = (lat&&lng)?await nearbyProperties(lat,lng,{radius,category:cat||null}):null;
  const list = data ? data.results.map(u=>`<tr><td>${esc(u.category||'')}</td><td>${esc(u.district||'')}</td><td class="num">${fmt(u.area)}م²</td><td class="num">${fmt(u.price)}</td><td class="num" style="color:#229799;font-weight:800">${fmt(u.pricePerM)}</td><td class="num m">${u.dist}كم</td><td>${u.url?`<a href="${esc(u.url)}" target="_blank">↗</a>`:''}</td></tr>`).join('') : '';
  const body = `<form method="GET" action="/nearby" id="nf" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;align-items:center">
      <select name="category" style="padding:12px;border-radius:11px;border:1px solid #d3e0e2;font-family:inherit"><option value="">كل الأنواع</option>${['شقة','دور','فيلا','تاون هاوس','أرض'].map(x=>`<option ${x===cat?'selected':''}>${x}</option>`).join('')}</select>
      <input name="lat" id="lat" placeholder="خط العرض" value="${esc(lat||'')}" style="padding:12px;border-radius:11px;border:1px solid #d3e0e2;width:130px">
      <input name="lng" id="lng" placeholder="خط الطول" value="${esc(lng||'')}" style="padding:12px;border-radius:11px;border:1px solid #d3e0e2;width:130px">
      <select name="radius" style="padding:12px;border-radius:11px;border:1px solid #d3e0e2"><option value="1" ${radius===1?'selected':''}>1كم</option><option value="3" ${radius===3?'selected':''}>3كم</option><option value="5" ${radius===5?'selected':''}>5كم</option></select>
      <button type="button" class="btn" style="background:#6b7a84" onclick="navigator.geolocation.getCurrentPosition(function(p){document.getElementById('lat').value=p.coords.latitude.toFixed(6);document.getElementById('lng').value=p.coords.longitude.toFixed(6);document.getElementById('nf').submit();})">📍 موقعي</button>
      <button class="btn">بحث</button></form>
    ${data?`<div class="m" style="font-size:12px;margin-bottom:8px">${data.results.length} وحدة ضمن ${radius}كم</div><table><thead><tr><th>النوع</th><th>الحي</th><th>المساحة</th><th>السعر</th><th>ر/م²</th><th>المسافة</th><th></th></tr></thead><tbody>${list||'<tr><td colspan="7" class="m" style="text-align:center;padding:20px">لا وحدات قريبة.</td></tr>'}</tbody></table>`:'<div class="m">أدخل إحداثيات أو اضغط «موقعي».</div>'}`;
  res.send(shell('وحدات قرب موقع', body, req.user));
}

// التحليلات
export async function analyticsPage(req, res) {
  const [ov, top] = await Promise.all([marketOverview(), compareDistricts('شقة', { limit: 12 })]);
  const maxCat = Math.max(1, ...ov.byCategory.map(c=>c.ppmMedian||0));
  const maxD = Math.max(1, ...top.map(d=>d.ppmMedian||0));
  const bar=(v,mx,lab,n)=>`<div style="margin:6px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${esc(lab)} <span class="m">${n?'('+n+')':''}</span></span><b style="color:#229799">${fmt(v)}</b></div><div style="background:#eef4f5;border-radius:6px;height:12px"><div style="background:#229799;height:12px;border-radius:6px;width:${Math.round((v||0)/mx*100)}%"></div></div></div>`;
  const body = `<div class="metrics" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px">
      <div class="mt"><b>${fmt(ov.total)}</b><span>إجمالي المخزون</span></div>
      ${ov.bySource.map(s=>`<div class="mt"><b>${fmt(s.count)}</b><span>${esc(s.source)}</span></div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div><b style="color:#23305a">وسيط سعر المتر حسب التصنيف</b>${ov.byCategory.map(c=>bar(c.ppmMedian,maxCat,c.category,c.count)).join('')}</div>
      <div><b style="color:#23305a">أغلى الأحياء (شقق)</b>${top.map(d=>bar(d.ppmMedian,maxD,d.district,d.count)).join('')}</div>
    </div>
    <style>.metrics .mt{background:#fff;border:1px solid #e2ebec;border-top:2px solid #229799;border-radius:0 0 10px 10px;padding:14px}.metrics b{display:block;font-size:24px;font-weight:800;color:#23305a}.metrics span{font-size:11.5px;color:#5b6b76}</style>`;
  res.send(shell('التحليلات', body, req.user));
}

const CATS = ['شقة','دور','فيلا','تاون هاوس','أرض'];
const catOpts = (sel) => ['<option value="">كل الأنواع</option>'].concat(CATS.map(c=>`<option ${c===sel?'selected':''}>${c}</option>`)).join('');

// المشاريع/المجمّعات
export async function projectsPage(req, res) {
  const cat = CATS.includes(req.query.category)?req.query.category:'';
  const st = ['ready','offplan'].includes(req.query.saleType)?req.query.saleType:'';
  const rows = await projectsList({ category:cat||null, saleType:st||null });
  const list = rows.map(p=>`<tr><td><b>${esc(p.project)}</b></td><td class="m">${esc(p.districts.slice(0,2).join('، '))}${p.districts.length>2?' +'+(p.districts.length-2):''}</td><td class="m">${esc(p.categories.join('، '))}</td><td class="num">${fmt(p.count)}</td><td class="num" style="color:#229799;font-weight:800">${fmt(p.ppmMedian)}</td><td class="num m">${p.ready?'جاهز '+p.ready:''}${p.ready&&p.offplan?' · ':''}${p.offplan?'خارطة '+p.offplan:''}</td></tr>`).join('');
  const body = `<form method="GET" action="/projects" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <select name="category" onchange="this.form.submit()" style="padding:12px;border-radius:11px;border:1px solid #d3e0e2;font-family:inherit">${catOpts(cat)}</select>
      <select name="saleType" onchange="this.form.submit()" style="padding:12px;border-radius:11px;border:1px solid #d3e0e2;font-family:inherit"><option value="">جاهز + خارطة</option><option value="ready" ${st==='ready'?'selected':''}>جاهز فقط</option><option value="offplan" ${st==='offplan'?'selected':''}>خارطة فقط</option></select></form>
    <div class="m" style="font-size:12px;margin-bottom:8px">${rows.length} مشروع/مجمّع بالمخزون</div>
    <table><thead><tr><th>المشروع</th><th>الأحياء</th><th>الأنواع</th><th>وحدات</th><th>وسيط ر/م²</th><th>النوع</th></tr></thead><tbody>${list||'<tr><td colspan="6" class="m" style="text-align:center;padding:20px">لا مشاريع مسمّاة بعد — تظهر بعد سحب فيه أسماء مشاريع.</td></tr>'}</tbody></table>`;
  res.send(shell('المشاريع', body, req.user));
}

// صحة البيانات (مدير)
export async function healthPage(req, res) {
  const h = await dataHealth();
  const when = h.lastCrawl?.at ? new Date(h.lastCrawl.at).toLocaleString('ar-SA') : '—';
  const body = `<div class="metrics" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">
      <div class="mt"><b>${fmt(h.active)}</b><span>عقارات فعّالة</span></div>
      <div class="mt"><b>${fmt(h.districts)}</b><span>أحياء مغطّاة</span></div>
      <div class="mt"><b>${fmt(h.missing.noGeo)}</b><span>بلا إحداثيات</span></div>
      <div class="mt"><b>${fmt(h.missing.noPrice)}</b><span>بلا سعر</span></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div><b style="color:#23305a">حسب المصدر</b><table style="margin-top:8px"><thead><tr><th>المصدر</th><th>عدد</th><th>آخر تحديث</th></tr></thead><tbody>${h.bySource.map(s=>`<tr><td>${esc(s.source)}</td><td class="num">${fmt(s.count)}</td><td class="m">${s.last?new Date(s.last).toLocaleDateString('ar-SA'):'—'}</td></tr>`).join('')||'<tr><td colspan="3" class="m">لا بيانات</td></tr>'}</tbody></table></div>
      <div><b style="color:#23305a">حسب التصنيف</b><table style="margin-top:8px"><thead><tr><th>التصنيف</th><th>عدد</th></tr></thead><tbody>${h.byCategory.map(c=>`<tr><td>${esc(c.category||'—')}</td><td class="num">${fmt(c.count)}</td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="m" style="margin-top:16px;font-size:12.5px">آخر سحب: <b>${esc(when)}</b>${h.lastCrawl?` — بيوت ${fmt(h.lastCrawl.bayut||0)} · عقار ${fmt(h.lastCrawl.aqar||0)}`:''}</div>
    <style>.metrics .mt{background:#fff;border:1px solid #e2ebec;border-top:2px solid #229799;border-radius:0 0 10px 10px;padding:14px}.metrics b{display:block;font-size:24px;font-weight:800;color:#23305a}.metrics span{font-size:11.5px;color:#5b6b76}</style>`;
  res.send(shell('صحة البيانات', body, req.user));
}

// مركز السحب (مدير) — يشغّل POST /api/requests/crawl
export async function crawlCenterPage(req, res) {
  const h = await dataHealth();
  const when = h.lastCrawl?.at ? new Date(h.lastCrawl.at).toLocaleString('ar-SA') : 'لم يُسحب بعد';
  const body = `<div class="card" style="background:#fff;border:1px solid #e2ebec;border-radius:14px;padding:20px;max-width:560px">
      <b style="color:#23305a;font-size:16px">سحب السوق</b>
      <p class="m" style="font-size:13px;margin:8px 0 16px">يجلب أحدث العروض من بيوت وعقار ويخزّنها للمطابقة والدراسة. آخر سحب: <b>${esc(when)}</b> · المخزون الآن <b>${fmt(h.active)}</b>.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="s_bayut" checked> بيوت</label>
        <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="s_aqar" checked> عقار</label>
      </div>
      <button class="btn" id="go" style="margin-top:16px" onclick="run()">▶ ابدأ السحب</button>
      <div id="out" class="m" style="margin-top:14px;font-size:13px"></div>
    </div>
    <script>
      async function run(){
        var b=document.getElementById('s_bayut').checked, a=document.getElementById('s_aqar').checked;
        var sources=[]; if(b)sources.push('bayut'); if(a)sources.push('aqar');
        if(!sources.length){document.getElementById('out').textContent='اختر مصدرًا واحدًا على الأقل.';return;}
        var btn=document.getElementById('go'); btn.disabled=true; btn.textContent='… يسحب';
        document.getElementById('out').textContent='جارٍ السحب، قد يستغرق دقائق…';
        try{
          var r=await fetch('/api/requests/crawl',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sources})});
          var j=await r.json();
          if(j.ok!==false){var d=j.data||j; document.getElementById('out').innerHTML='تم ✓ — بيوت '+(d.bayut||0)+' · عقار '+(d.aqar||0)+' · الإجمالي الفعّال '+(d.totalActive||0);}
          else document.getElementById('out').textContent='فشل: '+(j.error||'غير معروف');
        }catch(e){document.getElementById('out').textContent='خطأ اتصال: '+e.message;}
        btn.disabled=false; btn.textContent='▶ ابدأ السحب';
      }
    </script>`;
  res.send(shell('مركز السحب', body, req.user));
}

// تصدير CSV (مدير)
export async function exportProperties(req, res) {
  const csv = await exportPropertiesCsv({ city:req.query.city||null, category:req.query.category||null, district:req.query.district||null });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="properties.csv"');
  res.send(csv);
}
