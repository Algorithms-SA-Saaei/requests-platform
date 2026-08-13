// معالج أخطاء مركزي (§48) — لا تسريب لآثار المكدّس أو تفاصيل داخلية في الإنتاج (§47)
import { env } from '../config/environment.js';
import { logger } from '../utils/logger.js';
import { fail } from '../utils/response.js';

export function notFoundHandler(req, res) {
  return fail(res, 404, 'المسار غير موجود', 'ROUTE_NOT_FOUND');
}

export function errorHandler(error, req, res, _next) {
  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_ERROR';

  if (statusCode >= 500) {
    logger.error('unhandled', { requestId: req.id, code, message: error.message, stack: env.isProd ? undefined : error.stack });
  } else {
    logger.warn('handled', { requestId: req.id, code, message: error.message });
  }

  // الرسائل المتوقّعة (4xx) تُعرض للمستخدم؛ أخطاء الخادم تُخفى خلف رسالة عامة
  const message = statusCode < 500 ? error.message : 'حدث خطأ في الخادم، حاول لاحقًا';
  return fail(res, statusCode, message, code, error.details || undefined);
}

/** يلتقط رفض الوعود في المعالجات غير المتزامنة ويحوّله للمعالج المركزي */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
