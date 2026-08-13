// سجل التدقيق للعمليات الحسّاسة (§22) — من فعل ماذا ومتى ومن أي عنوان
import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: String, default: 'system', index: true },
    action: { type: String, required: true, index: true },
    detail: { type: String, default: '' },
    ip: { type: String, default: '' },
    requestId: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export async function audit({ actor, action, detail, ip, requestId }) {
  try {
    await AuditLog.create({ actor: actor || 'system', action, detail: detail || '', ip: ip || '', requestId: requestId || '' });
  } catch {
    // التدقيق لا يُفشل العملية الأساسية أبدًا
  }
}
