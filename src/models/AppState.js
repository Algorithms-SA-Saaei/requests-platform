// حالة تشغيلية بسيطة (key/value) — لتخزين توكن ساعي الدوّار وطوابع الجدولة (تجديد/وسم يومي).
// لماذا في القاعدة لا في متغيّر البيئة: التوكن يتجدّد دوريًا، والعملية لا تعدّل بيئتها بنفسها.
import mongoose from 'mongoose';

const appStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const AppState = mongoose.model('AppState', appStateSchema);

export async function stateGet(key) {
  const row = await AppState.findOne({ key }).lean();
  return row ? row.value : null;
}
export async function stateSet(key, value) {
  await AppState.findOneAndUpdate({ key }, { value, updatedAt: new Date() }, { upsert: true });
  return value;
}
// بوابة زمنية: تُرجع true مرة كل `hours` ساعة لكل مفتاح (لجدولة التجديد/الوسم اليومي)
export async function stateDue(key, hours) {
  const row = await AppState.findOne({ key }).lean();
  if (row?.updatedAt && Date.now() - new Date(row.updatedAt).getTime() < hours * 3600000) return false;
  await AppState.findOneAndUpdate({ key }, { updatedAt: new Date() }, { upsert: true });
  return true;
}
