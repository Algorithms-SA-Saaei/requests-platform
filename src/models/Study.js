// دراسة مشروع — المطوّر يُدخل وحداته وأسعارها، والنظام يقارنها بمخزون السوق (Property).
import mongoose from 'mongoose';

const unitSchema = new mongoose.Schema({
  type: { type: String, default: null },      // شقة/دور/فيلا/تاون هاوس
  floor: { type: String, default: null },      // أرضي/أول/ثاني/ملحق
  area: { type: Number, default: 0 },          // مسطحات البناء
  privateArea: { type: Number, default: 0 },   // الأجزاء الخاصة
  price: { type: Number, default: 0 },
  count: { type: Number, default: 1 },
}, { _id: false });

const studySchema = new mongoose.Schema({
  name: { type: String, required: true },
  developer: { type: String, default: null },
  district: { type: String, default: null, index: true },
  city: { type: String, default: 'الرياض' },
  units: { type: [unitSchema], default: [] },
  notes: { type: String, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

export const Study = mongoose.model('Study', studySchema);
