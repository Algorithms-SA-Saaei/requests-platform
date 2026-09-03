// مسارات واجهة الويب (صفحات HTML) — منفصلة عن /api
import { Router } from 'express';
import * as web from '../controllers/web.controller.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { writeLimiter } from '../middleware/rateLimit.middleware.js';
import { requireAuthWeb, requireRole } from '../middleware/auth.middleware.js';

const router = Router();
router.get('/login', web.loginPage);
router.post('/login', writeLimiter, asyncHandler(web.doLogin));
router.get('/logout', web.doLogout);
router.get('/', requireAuthWeb, asyncHandler(web.dashboard));
router.get('/r/:id', requireAuthWeb, asyncHandler(web.requestDetailPage));
router.get('/market', requireAuthWeb, asyncHandler(web.marketPage));
router.post('/sync', requireAuthWeb, requireRole('admin', 'manager'), writeLimiter, asyncHandler(web.doSync));
export default router;
