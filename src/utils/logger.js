// تسجيل مُهيكل (JSON) — بلا أسرار ولا بيانات شخصية كاملة (§49)
import { env } from '../config/environment.js';

const REDACT = /(password|token|secret|authorization|privateKey|apiKey)/i;

function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (REDACT.test(k)) out[k] = '[محجوب]';
    else if (v && typeof v === 'object') out[k] = redact(v);
    else out[k] = v;
  }
  return out;
}

function emit(level, message, meta = {}) {
  const line = { ts: new Date().toISOString(), level, message, ...redact(meta) };
  const text = env.isProd ? JSON.stringify(line) : `${line.ts} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(redact(meta)) : ''}`;
  (level === 'error' ? console.error : console.log)(text);
}

export const logger = {
  info: (m, meta) => emit('info', m, meta),
  warn: (m, meta) => emit('warn', m, meta),
  error: (m, meta) => emit('error', m, meta),
  debug: (m, meta) => { if (!env.isProd) emit('debug', m, meta); },
};
