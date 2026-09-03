// ربط اسم الحي برمزه في البورصة العقارية (وزارة العدل) — لِمعايرة أسعار العرض
// بصفقات فعلية. الرمز (areaSerial) لا يُسحب آليًا: يُلتقط بدخول النفاذ الوطني ثم يُدخل هنا.
import mongoose from 'mongoose';

const areaCodeSchema = new mongoose.Schema(
  {
    district: { type: String, required: true }, // اسم الحي بلا بادئة «حي»
    city: { type: String, default: 'الرياض' },
    areaSerial: { type: Number, required: true }, // الرمز في البورصة
    areaType: { type: String, default: 'R', enum: ['R', 'C', 'D'] }, // R سكني · C تجاري · D حي
    note: { type: String, default: null },
    addedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);
areaCodeSchema.index({ district: 1, city: 1 }, { unique: true });

export const AreaCode = mongoose.model('AreaCode', areaCodeSchema);
