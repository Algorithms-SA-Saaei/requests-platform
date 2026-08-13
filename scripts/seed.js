// تهيئة مستخدمين للتطوير/الاختبار — لا يعمل في الإنتاج
import mongoose from 'mongoose';
import { env } from '../src/config/environment.js';
import { User, hashPassword } from '../src/models/User.js';

if (env.isProd) {
  console.error('ممنوع تشغيل بيانات التهيئة في الإنتاج');
  process.exit(1);
}

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || 'ChangeMe_Dev_123';

const users = [
  { username: 'admin', name: 'مدير النظام', role: 'admin' },
  { username: 'manager', name: 'مدير المبيعات', role: 'manager' },
  { username: 'agent1', name: 'موظف المبيعات الأول', role: 'agent' },
  { username: 'agent2', name: 'موظف المبيعات الثاني', role: 'agent' },
];

await mongoose.connect(env.mongoUri, { maxPoolSize: 5 });

for (const u of users) {
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  await User.findOneAndUpdate(
    { username: u.username },
    { ...u, passwordHash, isActive: true },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

console.log(JSON.stringify({ seeded: users.map((u) => u.username), count: await User.countDocuments() }, null, 2));
await mongoose.connection.close();
process.exit(0);
