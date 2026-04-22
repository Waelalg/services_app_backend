import { asyncHandler } from '../middlewares/async.middleware.js';
import { getAllCategories, getSubcategoriesByCategory } from '../services/taxonomy.service.js';
import { sendSuccess } from '../utils/api-response.js';

export const getCategories = asyncHandler(async (req, res) => {
  const categories = await getAllCategories();
  return sendSuccess(res, {
    message: 'Categories fetched successfully',
    data: categories
  });
});

export const getCategorySubcategories = asyncHandler(async (req, res) => {
  const subcategories = await getSubcategoriesByCategory(req.params.categoryId);
  return sendSuccess(res, {
    message: 'Subcategories fetched successfully',
    data: subcategories
  });
});
