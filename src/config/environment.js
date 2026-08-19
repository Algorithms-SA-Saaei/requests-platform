// إعدادات التطبيق — كل قيمة حسّاسة من متغيّرات البيئة، لا شيء مكتوب في الكود (§21)
import dotenv from 'dotenv';
dotenv.config();

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
const list = (v, d = []) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : d);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  port: num(process.env.PORT, 3000),

  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/marhab',
  mongoPoolSize: num(process.env.MONGODB_POOL_SIZE, 20),

  jwtSecret: process.env.JWT_SECRET || '',
  jwtTtl: process.env.JWT_TTL || '12h',

  saaeiApiUrl: (process.env.SAAEI_API_URL || 'https://api.saaei.co/api/v1').replace(/\/+$/, ''),
  saaeiTimeoutMs: num(process.env.SAAEI_TIMEOUT_MS, 10000),
  saaeiRetries: num(process.env.SAAEI_RETRIES, 2),
  saaeiToken: process.env.SAAEI_API_TOKEN || '',
  lookupCacheTtlMs: num(process.env.LOOKUP_CACHE_TTL_MS, 10 * 60 * 1000),

  corsOrigins: list(process.env.CORS_ORIGINS, ['https://kiosk.webnan.io']),
  trustProxyHops: num(process.env.TRUST_PROXY_HOPS, 1),

  rateWindowMs: num(process.env.RATE_WINDOW_MS, 60000),
  rateMax: num(process.env.RATE_MAX, 120),
  rateMaxWrite: num(process.env.RATE_MAX_WRITE, 20),

  // إعداد Firebase (اختياري — الإشعارات معطَّلة إن غاب)
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
};

// أسرار إلزامية في الإنتاج — يتوقف التشغيل بدلًا من العمل بإعداد ناقص
export function assertProductionConfig() {
  if (!env.isProd) return [];
  const missing = [];
  if (!env.jwtSecret || env.jwtSecret.length < 32) missing.push('JWT_SECRET (32 حرفًا فأكثر)');
  if (!process.env.MONGODB_URI) missing.push('MONGODB_URI');
  if (!process.env.CORS_ORIGINS) missing.push('CORS_ORIGINS');
  return missing;
}
