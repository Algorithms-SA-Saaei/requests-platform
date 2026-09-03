// مخزون العقارات المرشّحة للمطابقة — مصدره الافتراضي مشاريع/إعلانات ساعي (theAds).
// مصمَّم محايد المصدر: أي مغذٍّ آخر (ترحيل بيانات سوق) يكتب بنفس الشكل فتعمل المطابقة عليه.
import mongoose from 'mongoose';

const propertySchema = new mongoose.Schema(
  {
    source: { type: String, default: 'saaei', index: true }, // saaei / market / ...
    sourceId: { type: String, required: true, index: true }, // معرّف الوحدة في المصدر
    title: { type: String, default: '' },
    category: { type: String, default: null, index: true },
    district: { type: String, default: null, index: true },
    city: { type: String, default: null },
    beds: { type: Number, default: null },
    area: { type: Number, default: null },
    price: { type: Number, default: null },
    pricePerM: { type: Number, default: null },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    saleType: { type: String, default: null, index: true }, // ready / offplan
    projectId: { type: String, default: null },
    projectName: { type: String, default: null },
    url: { type: String, default: null },
    active: { type: Boolean, default: true, index: true },
    syncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

propertySchema.index({ source: 1, sourceId: 1 }, { unique: true });
propertySchema.index({ active: 1, category: 1, district: 1 });

export const Property = mongoose.model('Property', propertySchema);
