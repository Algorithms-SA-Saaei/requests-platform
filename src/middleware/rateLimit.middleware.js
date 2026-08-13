// حدود المعدّل (§19) — تعتمد IP العميل الحقيقي خلف Cloudflare لا عنوان الوكيل (§44)
import rateLimit from 'express-rate-limit';
import { env } from '../config/environment.js';
import { fail } from '../utils/response.js';

const clientIp = (req) => req.get('CF-Connecting-IP') || req.ip;
const onLimit = (req, res) => fail(res, 429, 'طلبات كثيرة، حاول بعد قليل', 'RATE_LIMITED');

const base = {
  windowMs: env.rateWindowMs,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIp,
  handler: onLimit,
};

/** الحد العام لكل مسارات API */
export const generalLimiter = rateLimit({ ...base, max: env.rateMax });

/** حد أشد لعمليات الكتابة العامة (إنشاء عميل، تسجيل دخول، تسجيل جهاز إشعار) */
export const writeLimiter = rateLimit({ ...base, max: env.rateMaxWrite });
