// المصادقة (§24) — دخول، هوية، خروج. الرمز عديم الحالة، ولا حالة مستخدم في متغيّرات عامة (§13)
import { User, verifyPassword } from '../models/User.js';
import { audit } from '../models/AuditLog.js';
import { signToken } from '../middleware/auth.middleware.js';
import { env } from '../config/environment.js';
import { ok } from '../utils/response.js';
import { unauthorized, badRequest } from '../utils/errors.js';

const cookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'lax',
  maxAge: 12 * 60 * 60 * 1000,
  path: '/',
};

export const login = async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!username || !password) throw badRequest('اسم المستخدم وكلمة المرور مطلوبان', 'MISSING_CREDENTIALS');

  const user = await User.findOne({ username, isActive: true }).select('+passwordHash');
  // رسالة واحدة للحالتين — لا نكشف أي الحسابات موجود
  const valid = user && (await verifyPassword(password, user.passwordHash));
  if (!valid) {
    await audit({ actor: username, action: 'login_failed', ip: req.get('CF-Connecting-IP') || req.ip, requestId: req.id });
    throw unauthorized('بيانات الدخول غير صحيحة', 'INVALID_CREDENTIALS');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken({ id: user._id, role: user.role, name: user.name });
  await audit({ actor: user.username, action: 'login', ip: req.get('CF-Connecting-IP') || req.ip, requestId: req.id });

  res.cookie('token', token, cookieOptions);
  return ok(res, {
    token, // للعملاء غير المتصفّحية
    user: { id: user._id, username: user.username, name: user.name, role: user.role, photoUrl: user.photoUrl, mustChangePassword: user.mustChangePassword },
  });
};

export const me = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user || !user.isActive) throw unauthorized();
  return ok(res, { id: user._id, username: user.username, name: user.name, role: user.role, photoUrl: user.photoUrl, projects: user.projects });
};

export const logout = async (req, res) => {
  await audit({ actor: req.user.name, action: 'logout', ip: req.get('CF-Connecting-IP') || req.ip, requestId: req.id });
  res.clearCookie('token', { ...cookieOptions, maxAge: undefined });
  return ok(res, { loggedOut: true });
};
