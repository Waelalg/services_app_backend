import { z } from 'zod';
import { cuidSchema, paginationQuerySchema } from './common.validation.js';

const emptyStringToNull = (value) => (value === '' ? null : value);

const imageUrlSchema = z.preprocess(
  emptyStringToNull,
  z.string().trim().min(1).max(1000).nullable().optional()
);

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must use lowercase letters, numbers, and hyphens')
  .max(120)
  .optional();

export const categoryIdParamsSchema = z.object({
  categoryId: cuidSchema
});

export const subcategoryIdParamsSchema = z.object({
  subcategoryId: cuidSchema
});

export const adminTaxonomyListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(120).optional()
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  slug: slugSchema,
  imageUrl: imageUrlSchema,
  displayOrder: z.coerce.number().int().min(0).default(0)
});

export const updateCategorySchema = createCategorySchema.partial();

export const createSubcategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  slug: slugSchema,
  imageUrl: imageUrlSchema,
  displayOrder: z.coerce.number().int().min(0).default(0)
});

export const updateSubcategorySchema = createSubcategorySchema.partial();
