import { z } from 'zod';
import { REGISTERABLE_USER_ROLES } from '../constants/enums.js';
import { requiredDateStringSchema } from './common.validation.js';

const optionalNullableNumber = (schema) =>
  z.preprocess((value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    return Number(value);
  }, schema.nullable().optional());

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const baseRegisterSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().min(1, 'Last name is required').max(80),
  email: z.string().trim().email('Invalid email'),
  password: passwordSchema,
  phone: z.string().trim().min(6).max(30).optional().nullable(),
  gender: z.string().trim().min(1, 'Gender is required').max(30),
  dateOfBirth: requiredDateStringSchema
});

export const clientRegisterSchema = baseRegisterSchema;

export const registerSchema = baseRegisterSchema.extend({
  role: z.enum(REGISTERABLE_USER_ROLES)
});

export const workerRegisterSchema = baseRegisterSchema;

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email'),
  password: z.string().min(1, 'Password is required')
});

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().min(6).max(30).nullable().optional(),
  avatarUrl: z.string().trim().url('Invalid avatar URL').nullable().optional(),
  dateOfBirth: requiredDateStringSchema.nullable().optional(),
  gender: z.string().trim().max(30).nullable().optional(),
  headline: z.string().trim().max(160).nullable().optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  yearsExperience: optionalNullableNumber(z.number().int().min(0).max(80)),
  avgResponseMinutes: optionalNullableNumber(z.number().int().min(1).max(10080))
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required'
});
