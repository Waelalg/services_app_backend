import { z } from 'zod';
import { BOOKING_STATUSES } from '../constants/enums.js';
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

export const bookingIdParamsSchema = z.object({
  bookingId: cuidSchema
});

export const createBookingSchema = z.object({
  listingId: cuidSchema,
  scheduledDate: z.preprocess(emptyStringToNull, requiredDateStringSchema.optional().nullable()),
  slotStart: z.preprocess(emptyStringToNull, requiredTimeStringSchema.optional().nullable()),
  slotEnd: z.preprocess(emptyStringToNull, requiredTimeStringSchema.optional().nullable()),
  note: z.preprocess(emptyStringToNull, z.string().trim().max(2000).optional().nullable()),
  contactPhone: z.preprocess(emptyStringToNull, z.string().trim().min(6).max(30).optional().nullable()),
  wilaya: z.preprocess(emptyStringToNull, z.string().trim().min(1).max(120).optional().nullable()),
  commune: z.preprocess(emptyStringToNull, z.string().trim().min(1).max(120).optional().nullable()),
  addressLine: z.preprocess(emptyStringToNull, z.string().trim().max(500).optional().nullable())
}).refine(
  (value) => {
    const scheduleFields = [value.scheduledDate, value.slotStart, value.slotEnd].filter(Boolean).length;
    return scheduleFields === 0 || scheduleFields === 3;
  },
  {
    message: 'scheduledDate, slotStart, and slotEnd must either all be provided or all be omitted',
    path: ['scheduledDate']
  }
).refine(
  (value) => !value.slotStart || !value.slotEnd || isStartBeforeEnd(value.slotStart, value.slotEnd),
  {
    message: 'slotStart must be earlier than slotEnd',
    path: ['slotStart']
  }
);

export const bookingsListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(BOOKING_STATUSES).optional()
});
