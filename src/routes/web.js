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
router.get('/compare', requireAuthWeb, asyncHandler(web.comparePage));
router.get('/pricing', requireAuthWeb, asyncHandler(web.pricePage));
router.get('/sale-split', requireAuthWeb, asyncHandler(web.saleSplitPage));
router.get('/demands', requireAuthWeb, asyncHandler(web.demandsPage));
router.get('/map', requireAuthWeb, asyncHandler(web.mapPage));
router.get('/nearby', requireAuthWeb, asyncHandler(web.nearbyPage));
router.get('/analytics', requireAuthWeb, asyncHandler(web.analyticsPage));
router.get('/projects', requireAuthWeb, asyncHandler(web.projectsPage));
router.get('/health', requireAuthWeb, requireRole('admin', 'manager'), asyncHandler(web.healthPage));
router.get('/crawl-center', requireAuthWeb, requireRole('admin', 'manager'), asyncHandler(web.crawlCenterPage));
router.get('/export/properties.csv', requireAuthWeb, requireRole('admin', 'manager'), asyncHandler(web.exportProperties));
router.post('/sync', requireAuthWeb, requireRole('admin', 'manager'), writeLimiter, asyncHandler(web.doSync));
export default router;
