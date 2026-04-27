import { StatusCodes } from 'http-status-codes';
import { prisma } from '../config/prisma.js';
import { ACTIVE_BOOKING_STATUSES } from '../constants/enums.js';
import { AppError } from '../errors/app-error.js';

export async function getWorkerProfileByUserIdOrThrow(userId, tx = prisma) {
  const workerProfile = await tx.workerProfile.findUnique({
    where: { userId }
  });

  if (!workerProfile) {
    throw new AppError('Worker profile not found', StatusCodes.NOT_FOUND);
  }

  return workerProfile;
}

export async function assertCategorySubcategory(categoryId, subcategoryId, tx = prisma) {
  if (!subcategoryId) {
    return;
  }

  const subcategory = await tx.subcategory.findUnique({
    where: { id: subcategoryId },
    select: { id: true, categoryId: true }
  });

  if (!subcategory || subcategory.categoryId !== categoryId) {
    throw new AppError('Subcategory does not belong to the selected category', StatusCodes.BAD_REQUEST);
  }
}

export async function getOwnedListingOrThrow(listingId, userId, tx = prisma) {
  const listing = await tx.workerListing.findUnique({
    where: { id: listingId },
    include: {
      category: true,
      subcategory: true,
      workAreas: true,
      portfolioImages: { orderBy: { displayOrder: 'asc' } },
      availabilityRules: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
      timeOff: { orderBy: { startDateTime: 'asc' } },
      workerProfile: {
        select: {
          id: true,
          userId: true
        }
      }
    }
  });

  if (!listing) {
    throw new AppError('Listing not found', StatusCodes.NOT_FOUND);
  }

  if (listing.workerProfile.userId !== userId) {
    throw new AppError('You do not have access to this listing', StatusCodes.FORBIDDEN);
  }

  return listing;
}

export async function getClientRequestOrThrow(requestId, tx = prisma) {
  const request = await tx.clientRequest.findUnique({
    where: { id: requestId },
    include: {
      category: true,
      subcategory: true,
      client: true,
      offers: {
        include: {
          workerProfile: {
            include: {
              user: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      },
      images: {
        orderBy: { displayOrder: 'asc' }
      }
    }
  });

  if (!request) {
    throw new AppError('Request not found', StatusCodes.NOT_FOUND);
  }

  return request;
}

export async function getBookingOrThrow(bookingId, tx = prisma) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    include: {
      client: true,
      workerProfile: {
        include: {
          user: true
        }
      },
      listing: {
        include: {
          category: true,
          subcategory: true,
          workAreas: true,
          portfolioImages: { orderBy: { displayOrder: 'asc' } }
        }
      },
      clientRequest: {
        include: {
          category: true,
          subcategory: true,
          client: true,
          images: {
            orderBy: { displayOrder: 'asc' }
          }
        }
      },
      review: true
    }
  });

  if (!booking) {
    throw new AppError('Booking not found', StatusCodes.NOT_FOUND);
  }

  return booking;
}

export async function recalculateWorkerRating(workerProfileId, tx = prisma) {
  const aggregate = await tx.review.aggregate({
    where: { reviewedWorkerId: workerProfileId },
    _avg: { rating: true },
    _count: { id: true }
  });

  await tx.workerProfile.update({
    where: { id: workerProfileId },
    data: {
      ratingAvg: aggregate._avg.rating ?? null,
      ratingCount: aggregate._count.id
    }
  });
}

export async function hasActiveListingBookings(listingId, tx = prisma) {
  const count = await tx.booking.count({
    where: {
      listingId,
      status: {
        in: ACTIVE_BOOKING_STATUSES
      }
    }
  });

  return count > 0;
}
