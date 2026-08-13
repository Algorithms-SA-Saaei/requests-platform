// الموظفون والمديرون — كلمات المرور بـPBKDF2 مثل النظام الحالي (§22 تجزئة كلمات المرور)
import mongoose from 'mongoose';
import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2Async = promisify(pbkdf2);
const ITERATIONS = 100000;

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true, select: false }, // لا يُجلب افتراضيًا
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, enum: ['admin', 'manager', 'agent'], default: 'agent', index: true },
    photoUrl: { type: String, default: null },
    isActive: { type: Boolean, default: true, index: true },
    mustChangePassword: { type: Boolean, default: false },
    projects: { type: [Number], default: [] }, // معرّفات مشاريع ساعي المصرّح بها (فارغ = الكل)
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/** تجزئة كلمة المرور — نفس صيغة النظام الحالي: pbkdf2$iterations$salt$hash */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await pbkdf2Async(password, salt, ITERATIONS, 32, 'sha256');
  return `pbkdf2$${ITERATIONS}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

/** مقارنة بزمن ثابت — تمنع تسريب المعلومة عبر فروق التوقيت */
export async function verifyPassword(password, stored) {
  try {
    const [scheme, iterations, saltB64, hashB64] = String(stored).split('$');
    if (scheme !== 'pbkdf2') return false;
    const derived = await pbkdf2Async(password, Buffer.from(saltB64, 'base64'), Number(iterations), 32, 'sha256');
    const expected = Buffer.from(hashB64, 'base64');
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export const User = mongoose.model('User', userSchema);
