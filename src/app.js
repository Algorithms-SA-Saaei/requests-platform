// تركيب تطبيق Express — أمن، حدود، مسارات، فحص صحة، ومعالج أخطاء مركزي
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';

import { env } from './config/environment.js';
import { isDbConnected } from './config/database.js';
import apiRoutes from './routes/index.js';
import webRoutes from './routes/web.js';
import { requestId, accessLog } from './middleware/requestId.middleware.js';
import { generalLimiter } from './middleware/rateLimit.middleware.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

export function createApp() {
  const app = express();

  // خلف Cloudflare ثم Nginx — لقراءة IP العميل الحقيقي في الحدود والسجلات (§44)
  app.set('trust proxy', env.trustProxyHops);
  app.disable('x-powered-by');

  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://saaei.co", "https://images.bayut.sa", "https://images.aqar.fm", "https://unpkg.com", "https://*.basemaps.cartocdn.com", "https://*.tile.openstreetmap.org"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        formAction: ["'self'"],
      },
    },
  })); // ترويسات أمنية + CSP يسمح بموارد الواجهة (§46)
  app.use(cors({
    origin: (origin, cb) => (!origin || env.corsOrigins.includes(origin) ? cb(null, true) : cb(new Error('CORS'))),
    credentials: true,
  })); // أصول محدّدة لا '*' (§45)
  app.use(compression());
  app.use(express.json({ limit: '256kb' })); // حد حجم الطلب (§22)
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));
  app.use(cookieParser());
  app.use(requestId);
  app.use(accessLog);

  // فحص الصحة (§51) — خفيف وبلا حد معدّل ليعمل مع المراقبة
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', (_req, res) => {
    const db = isDbConnected();
    res.status(db ? 200 : 503).json({ status: db ? 'ready' : 'degraded', database: db ? 'up' : 'down', uptimeSec: Math.round(process.uptime()) });
  });

  app.use('/', webRoutes);            // واجهة الويب (HTML)
  app.use('/api', generalLimiter, apiRoutes); // واجهة البيانات (JSON)

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
