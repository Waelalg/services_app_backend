import { Router } from 'express';
import {
  browseWorkers,
  favoriteWorker,
  getWorkerDetails,
  getWorkerReviews,
  listMyFavorites,
  unfavoriteWorker,
  workerDashboard
} from '../controllers/worker.controller.js';
import { optionalAuth, requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import {
  browseWorkersQuerySchema,
  workerIdParamsSchema,
  workerReviewsQuerySchema
} from '../validations/worker.validation.js';
import { paginationQuerySchema } from '../validations/common.validation.js';

const router = Router();

router.get('/', optionalAuth, validateRequest({ query: browseWorkersQuerySchema }), browseWorkers);
router.get('/favorites/me', requireAuth, requireRole('CLIENT'), validateRequest({ query: paginationQuerySchema }), listMyFavorites);
router.get('/dashboard/me', requireAuth, requireRole('WORKER'), workerDashboard);
router.get('/:workerId/reviews', validateRequest({ params: workerIdParamsSchema, query: workerReviewsQuerySchema }), getWorkerReviews);
router.post('/:workerId/favorite', requireAuth, requireRole('CLIENT'), validateRequest({ params: workerIdParamsSchema }), favoriteWorker);
router.delete('/:workerId/favorite', requireAuth, requireRole('CLIENT'), validateRequest({ params: workerIdParamsSchema }), unfavoriteWorker);
router.get('/:workerId', optionalAuth, validateRequest({ params: workerIdParamsSchema }), getWorkerDetails);

export default router;
