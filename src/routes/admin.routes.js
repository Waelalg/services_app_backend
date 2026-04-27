import { Router } from 'express';
import {
  adminAddCategory,
  adminAddSubcategory,
  adminEditCategory,
  adminEditSubcategory,
  adminGetCategories,
  adminRemoveCategory,
  adminRemoveSubcategory
} from '../controllers/taxonomy.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { taxonomyImageUpload } from '../middlewares/upload.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import {
  adminTaxonomyListQuerySchema,
  categoryIdParamsSchema,
  createCategorySchema,
  createSubcategorySchema,
  subcategoryIdParamsSchema,
  updateCategorySchema,
  updateSubcategorySchema
} from '../validations/taxonomy.validation.js';

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

router.get('/categories', validateRequest({ query: adminTaxonomyListQuerySchema }), adminGetCategories);
router.post('/categories', taxonomyImageUpload, validateRequest({ body: createCategorySchema }), adminAddCategory);
router.patch(
  '/categories/:categoryId',
  taxonomyImageUpload,
  validateRequest({ params: categoryIdParamsSchema, body: updateCategorySchema }),
  adminEditCategory
);
router.delete('/categories/:categoryId', validateRequest({ params: categoryIdParamsSchema }), adminRemoveCategory);
router.post(
  '/categories/:categoryId/subcategories',
  taxonomyImageUpload,
  validateRequest({ params: categoryIdParamsSchema, body: createSubcategorySchema }),
  adminAddSubcategory
);
router.patch(
  '/subcategories/:subcategoryId',
  taxonomyImageUpload,
  validateRequest({ params: subcategoryIdParamsSchema, body: updateSubcategorySchema }),
  adminEditSubcategory
);
router.delete(
  '/subcategories/:subcategoryId',
  validateRequest({ params: subcategoryIdParamsSchema }),
  adminRemoveSubcategory
);

export default router;
