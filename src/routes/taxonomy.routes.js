import { Router } from 'express';
import { z } from 'zod';
import { getCategories, getCategorySubcategories } from '../controllers/taxonomy.controller.js';
import { validateRequest } from '../middlewares/validation.middleware.js';

const router = Router();

router.get('/categories', getCategories);
router.get(
  '/categories/:categoryId/subcategories',
  validateRequest({ params: z.object({ categoryId: z.string().min(1) }) }),
  getCategorySubcategories
);

export default router;
