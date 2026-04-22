import { z } from 'zod';
import { DATE_FORMAT, TIME_FORMAT, isValidDateString, isValidTimeString } from '../utils/date-time.js';

export const cuidSchema = z.string().min(1, 'Invalid identifier');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10)
});

export const optionalDateStringSchema = z
  .string()
  .trim()
  .refine((value) => isValidDateString(value), `Date must be in ${DATE_FORMAT} format`)
  .optional()
  .nullable();

export const optionalTimeStringSchema = z
  .string()
  .trim()
  .refine((value) => isValidTimeString(value), `Time must be in ${TIME_FORMAT} format`)
  .optional()
  .nullable();

export const requiredDateStringSchema = z
  .string()
  .trim()
  .refine((value) => isValidDateString(value), `Date must be in ${DATE_FORMAT} format`);

export const requiredTimeStringSchema = z
  .string()
  .trim()
  .refine((value) => isValidTimeString(value), `Time must be in ${TIME_FORMAT} format`);
