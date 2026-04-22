import { Router } from 'express';
import {
  acceptIncomingBooking,
  bookingDetails,
  cancelOwnBooking,
  completeIncomingBooking,
  createDirectBooking,
  declineIncomingBooking,
  listIncomingBookings,
  listMyBookings
} from '../controllers/booking.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import { bookingIdParamsSchema, bookingsListQuerySchema, createBookingSchema } from '../validations/booking.validation.js';

const router = Router();

router.post('/', requireAuth, requireRole('CLIENT'), validateRequest({ body: createBookingSchema }), createDirectBooking);
router.get('/my', requireAuth, requireRole('CLIENT'), validateRequest({ query: bookingsListQuerySchema }), listMyBookings);
router.get('/incoming', requireAuth, requireRole('WORKER'), validateRequest({ query: bookingsListQuerySchema }), listIncomingBookings);
router.get('/:bookingId', requireAuth, validateRequest({ params: bookingIdParamsSchema }), bookingDetails);
router.patch('/:bookingId/accept', requireAuth, requireRole('WORKER'), validateRequest({ params: bookingIdParamsSchema }), acceptIncomingBooking);
router.patch('/:bookingId/decline', requireAuth, requireRole('WORKER'), validateRequest({ params: bookingIdParamsSchema }), declineIncomingBooking);
router.patch('/:bookingId/complete', requireAuth, requireRole('WORKER'), validateRequest({ params: bookingIdParamsSchema }), completeIncomingBooking);
router.patch('/:bookingId/cancel', requireAuth, requireRole('CLIENT'), validateRequest({ params: bookingIdParamsSchema }), cancelOwnBooking);

export default router;
