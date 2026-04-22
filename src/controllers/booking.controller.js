import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../middlewares/async.middleware.js';
import {
  acceptBooking,
  cancelBooking,
  completeBooking,
  createBooking,
  declineBooking,
  getBookingDetails,
  getIncomingBookings,
  getMyBookings
} from '../services/booking.service.js';
import { sendSuccess } from '../utils/api-response.js';

export const createDirectBooking = asyncHandler(async (req, res) => {
  const booking = await createBooking(req.user.id, req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Booking created successfully',
    data: booking
  });
});

export const listMyBookings = asyncHandler(async (req, res) => {
  const result = await getMyBookings(req.user.id, req.query);
  return sendSuccess(res, {
    message: 'Bookings fetched successfully',
    data: result.items,
    meta: result.meta
  });
});

export const listIncomingBookings = asyncHandler(async (req, res) => {
  const result = await getIncomingBookings(req.user.id, req.query);
  return sendSuccess(res, {
    message: 'Incoming bookings fetched successfully',
    data: result.items,
    meta: result.meta
  });
});

export const bookingDetails = asyncHandler(async (req, res) => {
  const booking = await getBookingDetails(req.user, req.params.bookingId);
  return sendSuccess(res, {
    message: 'Booking fetched successfully',
    data: booking
  });
});

export const acceptIncomingBooking = asyncHandler(async (req, res) => {
  const booking = await acceptBooking(req.user.id, req.params.bookingId);
  return sendSuccess(res, {
    message: 'Booking accepted successfully',
    data: booking
  });
});

export const declineIncomingBooking = asyncHandler(async (req, res) => {
  const booking = await declineBooking(req.user.id, req.params.bookingId);
  return sendSuccess(res, {
    message: 'Booking declined successfully',
    data: booking
  });
});

export const cancelOwnBooking = asyncHandler(async (req, res) => {
  const booking = await cancelBooking(req.user.id, req.params.bookingId);
  return sendSuccess(res, {
    message: 'Booking cancelled successfully',
    data: booking
  });
});

export const completeIncomingBooking = asyncHandler(async (req, res) => {
  const booking = await completeBooking(req.user.id, req.params.bookingId);
  return sendSuccess(res, {
    message: 'Booking completed successfully',
    data: booking
  });
});
