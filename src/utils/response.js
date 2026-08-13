// شكل استجابة موحّد لكل المسارات (§47) — الواجهة لا ترتبط بشكل استجابة ساعي
export const ok = (res, data, meta) => res.json({ success: true, data, ...(meta ? { meta } : {}) });

export const created = (res, data) => res.status(201).json({ success: true, data });

export const fail = (res, statusCode, message, code, details) =>
  res.status(statusCode).json({ success: false, message, code, ...(details ? { details } : {}) });
