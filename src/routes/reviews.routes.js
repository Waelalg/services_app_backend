import { Router } from 'express';
import { createWorkerReview } from '../controllers/review.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import { createReviewSchema } from '../validations/review.validation.js';

const router = Router();

router.post('/', requireAuth, requireRole('CLIENT'), validateRequest({ body: createReviewSchema }), createWorkerReview);

export default router;
