// أخطاء التطبيق — رمز ثابت + حالة HTTP، والرسالة الداخلية لا تصل للعميل في الإنتاج (§47)
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.expected = statusCode < 500; // خطأ متوقّع (لا يُسجَّل كخلل خادم)
  }
}

export const badRequest = (m, code = 'VALIDATION_FAILED', details = null) => new AppError(m, 400, code, details);
export const unauthorized = (m = 'يلزم تسجيل الدخول', code = 'UNAUTHORIZED') => new AppError(m, 401, code);
export const forbidden = (m = 'غير مصرّح بهذه العملية', code = 'FORBIDDEN') => new AppError(m, 403, code);
export const notFound = (m = 'غير موجود', code = 'NOT_FOUND') => new AppError(m, 404, code);
export const upstream = (m = 'تعذّر الوصول لخدمة ساعي', code = 'UPSTREAM_UNAVAILABLE') => new AppError(m, 502, code);
export const timeout = (m = 'انتهت مهلة الخدمة الخارجية', code = 'UPSTREAM_TIMEOUT') => new AppError(m, 504, code);
