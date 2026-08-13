// إدارة توكن ساعي الدوّار — JWT عمره 7 أيام يُخزَّن في القاعدة ويُجدَّد يوميًا عبر PUT /refreshToken.
// البذرة الأولى من SAAEI_API_TOKEN في البيئة؛ بعدها تُعتمد النسخة المخزّنة (المتجدّدة).
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

export async function getActiveToken() {
  const stored = await stateGet(TOKEN_KEY);
  return stored?.token || env.saaeiToken || null; // القاعدة أولًا ثم بذرة البيئة
}

export async function saveToken(token) {
  if (!token) return null;
  const exp = jwtExp(token);
  await stateSet(TOKEN_KEY, { token, exp: exp ? exp.toISOString() : null, updatedAt: new Date().toISOString() });
  return exp;
}

export async function tokenStatus() {
  const stored = await stateGet(TOKEN_KEY);
  const token = stored?.token || env.saaeiToken || null;
  const exp = stored?.exp ? new Date(stored.exp) : (token ? jwtExp(token) : null);
  const daysLeft = exp ? Math.round(((exp.getTime() - Date.now()) / 86400000) * 10) / 10 : null;
  return { set: Boolean(token), exp, daysLeft };
}

// تجديد التوكن: PUT /refreshToken بالتوكن الحالي → يرجّع {success, user, token} جديدًا صالحًا 7 أيام.
export async function refreshToken() {
  const current = await getActiveToken();
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
    if (!res.ok) { logger.warn('saaei-refresh-fail', { status: res.status }); return { ok: false, reason: `http_${res.status}` }; }
    const body = await res.json().catch(() => null);
    if (!body?.token) return { ok: false, reason: 'no_token_in_response' };
    const exp = await saveToken(body.token);
    logger.info('saaei-refresh-ok', { exp: exp?.toISOString() });
    return { ok: true, exp };
  } catch (e) {
    logger.error('saaei-refresh-error', { error: e?.message });
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
  }
}
