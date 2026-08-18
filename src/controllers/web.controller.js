// واجهة الويب (صفحات HTML مُخدَّمة من الخادم) — دخول + لوحة الطلبات (تبويبات) + العقارات المناسبة.
// تستهلك نفس الخدمات والنماذج. المصادقة بكوكي JWT (نفس رمز الـAPI).
import { ClientRequest } from '../models/ClientRequest.js';
import { requestCounts, requestSummary, syncRequests } from '../services/saaeiRequests.service.js';
import { matchesForRequest } from '../services/matching.service.js';
import { tokenStatus } from '../services/saaeiToken.service.js';
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

const shell = (title, body, user) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — طلبات ساعي</title><style>${CSS}</style></head><body>
<header><div class="b"><img src="https://saaei.co/assets/img/main_logo.svg" alt="ساعي" onerror="this.style.display='none'"><h1>طلبات ساعي</h1></div>
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
