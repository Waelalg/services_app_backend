import { z } from 'zod';
import { LISTING_STATUSES, PRICING_TYPES } from '../constants/enums.js';
import { isStartBeforeEnd } from '../utils/date-time.js';
import {
  cuidSchema,
  paginationQuerySchema,
  requiredDateStringSchema,
  requiredTimeStringSchema
} from './common.validation.js';

const parseJsonField = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const parseBooleanField = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return value;
};

const emptyStringToNull = (value) => {
  if (value === '') {
    return null;
  }

  return value;
};

const optionalNullablePositiveNumber = z.preprocess((value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return Number(value);
}, z.number().positive('priceFrom must be greater than 0').nullable().optional());

export const listingIdParamsSchema = z.object({
  listingId: cuidSchema
});

export const workAreaIdParamsSchema = z.object({
  workAreaId: cuidSchema
});

export const portfolioImageIdParamsSchema = z.object({
  portfolioImageId: cuidSchema
});

export const availabilityRuleIdParamsSchema = z.object({
  ruleId: cuidSchema
});

export const timeOffIdParamsSchema = z.object({
  timeOffId: cuidSchema
});

export const workAreaSchema = z.object({
  wilaya: z.string().trim().min(1, 'Wilaya is required').max(120),
  commune: z.string().trim().min(1, 'Commune is required').max(120)
});

const baseAvailabilityRuleSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: requiredTimeStringSchema,
  endTime: requiredTimeStringSchema,
  slotDurationMinutes: z.coerce.number().int().min(15).max(720).default(60),
  isActive: z.preprocess(parseBooleanField, z.boolean().default(true))
});

export const availabilityRuleSchema = baseAvailabilityRuleSchema.refine((value) => isStartBeforeEnd(value.startTime, value.endTime), {
  message: 'startTime must be earlier than endTime',
  path: ['startTime']
});

export const createListingSchema = z.object({
  categoryId: cuidSchema,
  subcategoryId: z.preprocess(emptyStringToNull, cuidSchema.optional().nullable()),
  title: z.string().trim().min(1, 'Title is required').max(160),
  description: z.string().trim().min(1, 'Description is required').max(4000),
  pricingType: z.enum(PRICING_TYPES).default('QUOTE'),
  priceFrom: optionalNullablePositiveNumber,
  currency: z.string().trim().length(3).default('DZD'),
  isPublished: z.preprocess(parseBooleanField, z.boolean().optional()),
  workAreas: z.preprocess(parseJsonField, z.array(workAreaSchema).default([])).optional(),
  availabilityRules: z.preprocess(parseJsonField, z.array(availabilityRuleSchema).default([])).optional()
});

export const updateListingSchema = createListingSchema.partial().extend({
  status: z.enum(LISTING_STATUSES).optional(),
  isPublished: z.boolean().optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required'
});

export const portfolioImageSchema = z.object({
  imageUrl: z.string().trim().min(1, 'imageUrl is required'),
  caption: z.string().trim().max(500).optional().nullable(),
  displayOrder: z.coerce.number().int().min(0).default(0)
});

export const updateAvailabilityRuleSchema = baseAvailabilityRuleSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required'
});

export const timeOffSchema = z.object({
  startDateTime: z.string().datetime('startDateTime must be a valid ISO datetime'),
  endDateTime: z.string().datetime('endDateTime must be a valid ISO datetime'),
  reason: z.string().trim().max(300).optional().nullable()
}).refine((value) => new Date(value.startDateTime).getTime() < new Date(value.endDateTime).getTime(), {
  message: 'startDateTime must be earlier than endDateTime',
  path: ['startDateTime']
});

export const availableSlotsQuerySchema = z.object({
  date: requiredDateStringSchema
});

export const myListingsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(LISTING_STATUSES).optional(),
  isPublished: z
    .union([z.boolean(), z.string().transform((value) => value === 'true')])
    .optional()
});
