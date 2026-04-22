import { z } from 'zod';
import { WORKER_SORT_OPTIONS } from '../constants/enums.js';
import { cuidSchema, paginationQuerySchema } from './common.validation.js';

export const workerIdParamsSchema = z.object({
  workerId: cuidSchema
});

export const browseWorkersQuerySchema = paginationQuerySchema.extend({
  categoryId: cuidSchema.optional(),
  subcategoryId: cuidSchema.optional(),
  wilaya: z.string().trim().min(1).optional(),
  commune: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(WORKER_SORT_OPTIONS).default('newest')
});

export const workerReviewsQuerySchema = paginationQuerySchema;
