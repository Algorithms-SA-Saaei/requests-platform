// طبقة الإشعارات (Firebase Cloud Messaging) — اختيارية ومعطَّلة افتراضيًا.
// تعمل فقط إذا ضُبطت أسرار Firebase الثلاثة في البيئة؛ وإلا لا تمنع الإقلاع (§الإشعارات).
// مكتفية بذاتها (لا تعتمد نماذج) — تُستخدم لاحقًا لتنبيه المندوب بطلب/مطابقة جديدة.
import admin from 'firebase-admin';
import { env } from '../config/environment.js';
import { logger } from '../utils/logger.js';

let ready = false;

export function initFirebase() {
  const { projectId, clientEmail, privateKey } = env.firebase || {};
  if (!projectId || !clientEmail || !privateKey) {
    logger.warn('firebase-disabled', { reason: 'إعداد Firebase غير مضبوط — الإشعارات معطَّلة' });
    return;
  }
  try {
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.cert({ projectId, clientEmail, privateKey }) });
    }
    ready = true;
    logger.info('firebase-ready', { projectId });
  } catch (e) {
    logger.error('firebase-init-failed', { error: e?.message });
  }
}

export const isFirebaseReady = () => ready;

/** إرسال إشعار دفع لأجهزة محددة (رمز واحد أو قائمة). آمن: لا يرمي إن كان معطَّلاً. */
export async function sendPush(tokens, { title, body, data = {} } = {}) {
  if (!ready) return { sent: 0, disabled: true };
  const list = (Array.isArray(tokens) ? tokens : [tokens]).filter(Boolean);
  if (!list.length) return { sent: 0 };
  try {
    const res = await admin.messaging().sendEachForMulticast({
      tokens: list,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    });
    return { sent: res.successCount, failed: res.failureCount };
  } catch (e) {
    logger.error('firebase-send-failed', { error: e?.message });
    return { sent: 0, error: true };
  }
}
