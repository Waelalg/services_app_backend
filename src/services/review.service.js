import { StatusCodes } from 'http-status-codes';
import { prisma } from '../config/prisma.js';
import { AppError } from '../errors/app-error.js';
import { serializeReview } from '../utils/serializers.js';
import { getBookingOrThrow, recalculateWorkerRating } from './shared.service.js';

export async function createReview(clientId, payload) {
  const booking = await getBookingOrThrow(payload.bookingId);

  if (booking.clientId !== clientId) {
    throw new AppError('You do not have access to this booking', StatusCodes.FORBIDDEN);
  }

  if (booking.status !== 'COMPLETED') {
    throw new AppError('Only completed bookings can be reviewed', StatusCodes.BAD_REQUEST);
  }

  if (booking.review) {
    throw new AppError('This booking has already been reviewed', StatusCodes.CONFLICT);
  }

  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.review.create({
      data: {
        bookingId: booking.id,
        reviewerId: clientId,
        reviewedWorkerId: booking.workerProfileId,
        rating: payload.rating,
        comment: payload.comment ?? null
      },
      include: {
        reviewer: true
      }
    });

    await recalculateWorkerRating(booking.workerProfileId, tx);

    return created;
  });

  return serializeReview(review);
}
