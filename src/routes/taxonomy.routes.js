import { Router } from 'express';
import { getCategories, getCategorySubcategories } from '../controllers/taxonomy.controller.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import { categoryIdParamsSchema } from '../validations/taxonomy.validation.js';

const router = Router();

router.get('/categories', getCategories);
router.get(
  '/categories/:categoryId/subcategories',
  validateRequest({ params: categoryIdParamsSchema }),
  getCategorySubcategories
);

export default router;
