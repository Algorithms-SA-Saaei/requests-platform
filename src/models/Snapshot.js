// لقطة سوق دورية — وسيط سعر المتر وعدد الوحدات لكل (حي، تصنيف) في لحظة.
// تتراكم مع كل سحب لتُبنى منها سلاسل الاتجاه الزمني (لا تاريخ لدينا قبل أول لقطة).
import mongoose from 'mongoose';

const snapshotSchema = new mongoose.Schema(
  {
    day: { type: String, required: true, index: true }, // YYYY-MM-DD (تجميع باليوم يمنع تضخّم اللقطات)
    at: { type: Date, default: Date.now },
    district: { type: String, default: null, index: true },
    category: { type: String, default: null, index: true },
    city: { type: String, default: null },
    ppmMedian: { type: Number, default: null },
    priceMedian: { type: Number, default: null },
    count: { type: Number, default: 0 },
  },
  { timestamps: false }
);
// لقطة واحدة لكل (يوم، حي، تصنيف): إعادة السحب في اليوم نفسه تُحدّث لا تُكرّر.
snapshotSchema.index({ day: 1, district: 1, category: 1 }, { unique: true });

export const Snapshot = mongoose.model('Snapshot', snapshotSchema);
