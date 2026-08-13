// طلبات العملاء المسحوبة من ساعي — تُخزَّن محليًا لربطها بالعقارات المناسبة (منصة الطلبات)
// المصدر: GET /requests في ساعي. الحقل matched ثلاثي الحالة كما في ساعي:
//   1 = مطابَق (ساعي اقترح إعلانات) · 0 = غير مطابَق (فرصة) · null = غير محدَّد
import mongoose from 'mongoose';

const clientRequestSchema = new mongoose.Schema(
  {
    saaeiId: { type: String, required: true, unique: true, index: true }, // معرّف الطلب في ساعي
    clientName: { type: String, default: null },
    phone: { type: String, default: null },
    category: { type: String, default: null, index: true }, // شقة/دور/فيلا/تاون هاوس (مطبَّع للعربية)
    city: { type: String, default: null },
    district: { type: String, default: null, index: true }, // اسم الحي مطبَّع للعربية
    purpose: { type: String, default: null }, // بيع/إيجار
    beds: { type: Number, default: null },
    priceMin: { type: Number, default: null },
    priceMax: { type: Number, default: null },
    areaMin: { type: Number, default: null },
    areaMax: { type: Number, default: null },
    status: { type: String, default: null }, // NEW / CONTACT-PHASE ...
    matched: { type: Number, enum: [0, 1, null], default: null, index: true },
    employee: { type: String, default: null }, // الموظف المسؤول (user.fullname)
    note: { type: String, default: null },
    raw: { type: mongoose.Schema.Types.Mixed, default: null }, // نسخة خام للمعايرة
    saaeiCreatedAt: { type: Date, default: null },
    syncedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

clientRequestSchema.index({ matched: 1, saaeiCreatedAt: -1 });

export const ClientRequest = mongoose.model('ClientRequest', clientRequestSchema);
