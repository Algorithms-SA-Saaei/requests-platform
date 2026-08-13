// معرّف فريد لكل طلب — يُتتبَّع عبر Cloudflare ثم Nginx ثم Node ثم ساعي (§50)
import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger.js';

export function requestId(req, res, next) {
  req.id = req.get('CF-Ray') || req.get('X-Request-Id') || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

/** سجل وصول مُهيكل: المسار والحالة والمدة — بلا أجسام الطلبات */
export function accessLog(req, res, next) {
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info('http', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      ip: req.ip,
    });
  });
  next();
}
