import { z } from 'zod';
import { cuidSchema } from './common.validation.js';

export const createReviewSchema = z.object({
  bookingId: cuidSchema,
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional().nullable()
});
