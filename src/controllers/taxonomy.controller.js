import { asyncHandler } from '../middlewares/async.middleware.js';
import {
  adminCreateCategory,
  adminCreateSubcategory,
  adminDeleteCategory,
  adminDeleteSubcategory,
  adminListCategories,
  adminUpdateCategory,
  adminUpdateSubcategory,
  getAllCategories,
  getSubcategoriesByCategory
} from '../services/taxonomy.service.js';
import { sendSuccess } from '../utils/api-response.js';
import { StatusCodes } from 'http-status-codes';

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

export const adminGetCategories = asyncHandler(async (req, res) => {
  const result = await adminListCategories(req.query);
  return sendSuccess(res, {
    message: 'Admin categories fetched successfully',
    data: result.items,
    meta: result.meta
  });
});

export const adminAddCategory = asyncHandler(async (req, res) => {
  const category = await adminCreateCategory(req.body, req.file);
  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Category created successfully',
    data: category
  });
});

export const adminEditCategory = asyncHandler(async (req, res) => {
  const category = await adminUpdateCategory(req.params.categoryId, req.body, req.file);
  return sendSuccess(res, {
    message: 'Category updated successfully',
    data: category
  });
});

export const adminRemoveCategory = asyncHandler(async (req, res) => {
  await adminDeleteCategory(req.params.categoryId);
  return sendSuccess(res, {
    message: 'Category deleted successfully',
    data: null
  });
});

export const adminAddSubcategory = asyncHandler(async (req, res) => {
  const subcategory = await adminCreateSubcategory(req.params.categoryId, req.body, req.file);
  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Subcategory created successfully',
    data: subcategory
  });
});

export const adminEditSubcategory = asyncHandler(async (req, res) => {
  const subcategory = await adminUpdateSubcategory(req.params.subcategoryId, req.body, req.file);
  return sendSuccess(res, {
    message: 'Subcategory updated successfully',
    data: subcategory
  });
});

export const adminRemoveSubcategory = asyncHandler(async (req, res) => {
  await adminDeleteSubcategory(req.params.subcategoryId);
  return sendSuccess(res, {
    message: 'Subcategory deleted successfully',
    data: null
  });
});
