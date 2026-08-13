// اتصال MongoDB واحد بمجمّع اتصالات (§16) — لا اتصال جديد لكل طلب، ولا سقوط للعملية عند انقطاع القاعدة (§64)
import mongoose from 'mongoose';
import { env } from '../config/environment.js';
import { logger } from '../utils/logger.js';

let connected = false;
export const isDbConnected = () => connected && mongoose.connection.readyState === 1;

export async function connectDatabase({ required = env.isProd } = {}) {
  mongoose.connection.on('connected', () => { connected = true; logger.info('mongo-connected'); });
  mongoose.connection.on('disconnected', () => { connected = false; logger.warn('mongo-disconnected'); });
  mongoose.connection.on('error', (e) => logger.error('mongo-error', { error: e?.message }));

  try {
    await mongoose.connect(env.mongoUri, {
      maxPoolSize: env.mongoPoolSize,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    return true;
  } catch (e) {
    logger.error('mongo-connect-failed', { error: e?.message });
    // في الإنتاج نتوقّف بدل العمل بقاعدة مفقودة؛ في التطوير يستمر الخادم ليُختبر باقي الطبقات
    if (required) throw e;
    logger.warn('mongo-optional-skip', { note: 'الخادم يعمل بلا قاعدة بيانات (بيئة تطوير)' });
    return false;
  }
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.connection.close(false);
}
