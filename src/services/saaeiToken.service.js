// إدارة توكن ساعي الدوّار — JWT عمره 7 أيام يُخزَّن في القاعدة ويُجدَّد يوميًا عبر PUT /refreshToken.
// البذرة الأولى من SAAEI_API_TOKEN في البيئة؛ بعدها تُعتمد النسخة المخزّنة (المتجدّدة) وتُحدَّث في .env.
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/environment.js';
import { logger } from '../utils/logger.js';
import { stateGet, stateSet } from '../models/AppState.js';

const TOKEN_KEY = 'saaei_token';

function jwtExp(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
    return payload.exp ? new Date(payload.exp * 1000) : null;
  } catch { return null; }
}

/**
 * تحديث متغيّر SAAEI_API_TOKEN في ملف .env على القرص وفي الذاكرة
 */
export function updateEnvFile(token) {
  if (!token) return;
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      const regex = /^SAAEI_API_TOKEN=.*$/m;
      if (regex.test(content)) {
        content = content.replace(regex, `SAAEI_API_TOKEN=${token}`);
      } else {
        content += `\nSAAEI_API_TOKEN=${token}\n`;
      }
      fs.writeFileSync(envPath, content, 'utf8');
    }
    process.env.SAAEI_API_TOKEN = token;
    env.saaeiToken = token;
    logger.info('env-token-updated');
  } catch (e) {
    logger.error('env-token-update-failed', { error: e?.message });
  }
}

export async function getActiveToken() {
  const stored = await stateGet(TOKEN_KEY);
  let token = stored?.token;

  // إذا كان التوكن المخزّن في القاعدة منتهي الصلاحية، نسقط إلى توكن .env
  if (token) {
    const exp = jwtExp(token);
    if (exp && exp.getTime() <= Date.now()) {
      token = null;
    }
  }

  if (!token) {
    token = env.saaeiToken || process.env.SAAEI_API_TOKEN || null;
  }

  return token;
}

export async function saveToken(token) {
  if (!token) return null;
  const exp = jwtExp(token);
  await stateSet(TOKEN_KEY, { token, exp: exp ? exp.toISOString() : null, updatedAt: new Date().toISOString() });
  updateEnvFile(token);
  return exp;
}

export async function tokenStatus() {
  const token = await getActiveToken();
  const exp = token ? jwtExp(token) : null;
  const daysLeft = exp ? Math.round(((exp.getTime() - Date.now()) / 86400000) * 10) / 10 : null;
  return { set: Boolean(token), exp, daysLeft };
}

// تجديد التوكن: PUT /refreshToken بالتوكن الحالي → يرجّع {success, user, token} جديدًا صالحًا 7 أيام.
export async function refreshToken() {
  let current = await getActiveToken();
  if (!current) current = env.saaeiToken || process.env.SAAEI_API_TOKEN;
  if (!current) return { ok: false, reason: 'no_token' };

  const url = `${env.saaeiApiUrl}/refreshToken`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.saaeiTimeoutMs);
  try {
    const res = await fetch(url, {
      method: 'PUT',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${current}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      logger.warn('saaei-refresh-fail', { status: res.status });
      return { ok: false, reason: `http_${res.status}` };
    }
    const body = await res.json().catch(() => null);
    if (!body?.token) return { ok: false, reason: 'no_token_in_response' };

    const exp = await saveToken(body.token);
    logger.info('saaei-refresh-ok', { exp: exp?.toISOString() });
    return { ok: true, exp, token: body.token };
  } catch (e) {
    logger.error('saaei-refresh-error', { error: e?.message });
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
  }
}
