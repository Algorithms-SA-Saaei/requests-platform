// مصادقة عديمة الحالة بـJWT (§12، §23، §24) — لا حالة مستخدم في متغيّرات عامة
import jwt from 'jsonwebtoken';
import { env } from '../config/environment.js';
import { unauthorized, forbidden } from '../utils/errors.js';

function readToken(req) {
  const header = req.get('Authorization') || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return req.cookies?.token || null; // كوكي HttpOnly للوحات المتصفح
}

/** يضع هوية الموظف في req.user فقط — سياق الطلب وحده، لا مشاركة بين الطلبات (§13، §14) */
export function requireAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) return next(unauthorized());
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    req.user = { id: payload.sub, role: payload.role, name: payload.name };
    return next();
  } catch {
    return next(unauthorized('انتهت الجلسة أو الرمز غير صالح', 'INVALID_TOKEN'));
  }
}

/** تفويض حسب الدور — يُفرض في الخادم دائمًا، لا بإخفاء أزرار الواجهة (§24) */
export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(forbidden());

export const signToken = (user) =>
  jwt.sign({ sub: String(user.id), role: user.role, name: user.name }, env.jwtSecret, { algorithm: 'HS256', expiresIn: env.jwtTtl });

/** حارس للصفحات (HTML): يحوّل لصفحة الدخول بدل إرجاع JSON عند غياب الجلسة */
export function requireAuthWeb(req, res, next) {
  const token = readToken(req);
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    req.user = { id: payload.sub, role: payload.role, name: payload.name };
    return next();
  } catch {
    return res.redirect('/login');
  }
}
/** يقرأ الجلسة إن وُجدت دون إلزام (لتوجيه الجذر) */
export function optionalAuthWeb(req, _res, next) {
  const token = readToken(req);
  try {
    const p = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    req.user = { id: p.sub, role: p.role, name: p.name };
  } catch { req.user = null; }
  return next();
}
