// تجميع المسارات الداخلية — منصة الطلبات (مصادقة + طلبات العملاء + العقارات المناسبة)
import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import * as requests from '../controllers/requests.controller.js';
import * as studies from '../controllers/study.controller.js';
import * as market from '../controllers/market.controller.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { writeLimiter } from '../middleware/rateLimit.middleware.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// --- المصادقة ---
router.post('/auth/login', writeLimiter, asyncHandler(auth.login));
router.get('/auth/me', requireAuth, asyncHandler(auth.me));
router.post('/auth/logout', requireAuth, asyncHandler(auth.logout));

// --- منصة الطلبات: طلبات العملاء + العقارات المناسبة ---
router.get('/requests', requireAuth, asyncHandler(requests.list));
router.get('/requests/:id/matches', requireAuth, asyncHandler(requests.matches));
router.post('/requests/sync', requireAuth, requireRole('admin', 'manager'), writeLimiter, asyncHandler(requests.sync));
router.post('/requests/crawl', requireAuth, requireRole('admin', 'manager'), writeLimiter, asyncHandler(requests.crawl));
router.get('/inventory', requireAuth, asyncHandler(requests.inventory));

// --- دراسات المشاريع ---
router.get('/studies', requireAuth, asyncHandler(studies.list));
router.post('/studies', requireAuth, writeLimiter, asyncHandler(studies.create));
router.get('/studies/:id', requireAuth, asyncHandler(studies.analyze));
router.delete('/studies/:id', requireAuth, requireRole('admin', 'manager'), asyncHandler(studies.remove));

// --- دراسة السوق ---
router.get('/market/report', requireAuth, asyncHandler(market.report));
router.get('/market/overview', requireAuth, asyncHandler(market.overview));
router.get('/market/districts', requireAuth, asyncHandler(market.districts));
router.get('/market/compare', requireAuth, asyncHandler(market.compare));
router.get('/market/price', requireAuth, asyncHandler(market.price));
router.get('/market/sale-split', requireAuth, asyncHandler(market.split));
router.get('/market/demand-gaps', requireAuth, asyncHandler(market.gaps));
router.get('/market/nearby', requireAuth, asyncHandler(market.nearby));
router.get('/market/map', requireAuth, asyncHandler(market.mapData));
router.get('/market/projects', requireAuth, asyncHandler(market.projects));
router.get('/market/health', requireAuth, requireRole('admin', 'manager'), asyncHandler(market.health));

export default router;
