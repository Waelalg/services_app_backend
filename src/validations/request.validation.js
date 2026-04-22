import { z } from 'zod';
import { OFFER_STATUSES, OPPORTUNITY_TABS, REQUEST_MODES, REQUEST_STATUSES } from '../constants/enums.js';
import { isStartBeforeEnd } from '../utils/date-time.js';
import {
  cuidSchema,
  paginationQuerySchema,
  requiredDateStringSchema,
  requiredTimeStringSchema
} from './common.validation.js';

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
}, z.number().positive().nullable().optional());

export const requestIdParamsSchema = z.object({
  requestId: cuidSchema
});

export const offerIdParamsSchema = z.object({
  offerId: cuidSchema
});

export const createClientRequestSchema = z.object({
  categoryId: cuidSchema,
  subcategoryId: z.preprocess(emptyStringToNull, cuidSchema.optional().nullable()),
  title: z.string().trim().min(1, 'Title is required').max(160),
  description: z.string().trim().min(1, 'Description is required').max(4000),
  wilaya: z.string().trim().min(1, 'Wilaya is required').max(120),
  commune: z.string().trim().min(1, 'Commune is required').max(120),
  addressLine: z.string().trim().max(500).optional().nullable(),
  preferredDate: requiredDateStringSchema.optional().nullable(),
  preferredTime: requiredTimeStringSchema.optional().nullable(),
  requestMode: z.enum(REQUEST_MODES).default('OPEN_REQUEST')
});

export const updateClientRequestSchema = createClientRequestSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required'
});

export const requestsListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(REQUEST_STATUSES).optional()
});

export const opportunitiesQuerySchema = paginationQuerySchema.extend({
  categoryId: cuidSchema.optional(),
  subcategoryId: cuidSchema.optional(),
  wilaya: z.string().trim().min(1).optional(),
  commune: z.string().trim().min(1).optional(),
  status: z.enum(REQUEST_STATUSES).optional(),
  tab: z.enum(OPPORTUNITY_TABS).default('explore')
});

export const createOfferSchema = z.object({
  message: z.string().trim().max(2000).optional().nullable(),
  proposedPrice: optionalNullablePositiveNumber,
  proposedDate: requiredDateStringSchema.optional().nullable(),
  proposedStartTime: requiredTimeStringSchema.optional().nullable(),
  proposedEndTime: requiredTimeStringSchema.optional().nullable()
}).refine(
  (value) =>
    (!value.proposedStartTime && !value.proposedEndTime) ||
    (value.proposedStartTime && value.proposedEndTime),
  {
    message: 'proposedStartTime and proposedEndTime must be provided together',
    path: ['proposedStartTime']
  }
).refine(
  (value) => (!value.proposedStartTime && !value.proposedEndTime) || Boolean(value.proposedDate),
  {
    message: 'proposedDate is required when proposing a time slot',
    path: ['proposedDate']
  }
).refine(
  (value) =>
    !value.proposedStartTime ||
    !value.proposedEndTime ||
    isStartBeforeEnd(value.proposedStartTime, value.proposedEndTime),
  {
    message: 'proposedStartTime must be earlier than proposedEndTime',
    path: ['proposedStartTime']
  }
);

export const listOffersQuerySchema = paginationQuerySchema.extend({
  status: z.enum(OFFER_STATUSES).optional()
});
