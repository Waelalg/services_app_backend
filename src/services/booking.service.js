import { StatusCodes } from 'http-status-codes';
import { prisma } from '../config/prisma.js';
import { AppError } from '../errors/app-error.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';
import { serializeBooking } from '../utils/serializers.js';
import { toUtcDateOnly } from '../utils/date-time.js';
import { buildAvailableSlots } from '../utils/availability.js';
import { getBookingOrThrow, getWorkerProfileByUserIdOrThrow } from './shared.service.js';

const bookingInclude = {
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
  clientRequest: true
};

async function getListingScheduleContext(listingId, tx = prisma) {
  const listing = await tx.workerListing.findUnique({
    where: { id: listingId },
    include: {
      availabilityRules: true,
      timeOff: true,
      workerProfile: {
        include: {
          user: true
        }
      }
    }
  });

  if (!listing) {
    throw new AppError('Listing not found', StatusCodes.NOT_FOUND);
  }

  return listing;
}

export async function assertWorkerHasNoConfirmedOverlap({
  workerProfileId,
  scheduledDate,
  slotStart,
  slotEnd,
  excludeBookingId,
  tx = prisma
}) {
  const conflicts = await tx.booking.findMany({
    where: {
      workerProfileId,
      status: 'CONFIRMED',
      scheduledDate,
      slotStart: { not: null },
      slotEnd: { not: null },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {})
    }
  });

  if (!conflicts.length) {
    return;
  }

  const overlapping = conflicts.some(
    (booking) => booking.slotStart < slotEnd && slotStart < booking.slotEnd
  );

  if (overlapping) {
    throw new AppError('The selected time slot is no longer available', StatusCodes.CONFLICT);
  }
}

export async function assertListingScheduledSlotAvailable({
  listingId,
  workerProfileId,
  scheduledDateString,
  slotStart,
  slotEnd,
  excludeBookingId,
  tx = prisma
}) {
  const listing = await getListingScheduleContext(listingId, tx);

  const scheduledDate = toUtcDateOnly(scheduledDateString);
  const confirmedBookings = await tx.booking.findMany({
    where: {
      workerProfileId: workerProfileId ?? listing.workerProfileId,
      status: 'CONFIRMED',
      scheduledDate,
      slotStart: { not: null },
      slotEnd: { not: null },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {})
    },
    select: {
      slotStart: true,
      slotEnd: true
    }
  });

  const availableSlots = buildAvailableSlots({
    dateString: scheduledDateString,
    rules: listing.availabilityRules,
    timeOff: listing.timeOff,
    confirmedBookings
  });

  const slotExists = availableSlots.some((slot) => slot.slotStart === slotStart && slot.slotEnd === slotEnd);

  if (!slotExists) {
    throw new AppError('The selected slot is invalid or unavailable', StatusCodes.CONFLICT);
  }
}

export async function createBooking(clientId, payload) {
  const listing = await prisma.workerListing.findUnique({
    where: { id: payload.listingId },
    include: {
      workerProfile: {
        include: {
          user: true
        }
      }
    }
  });

  if (!listing || !listing.isPublished || listing.status !== 'PUBLISHED') {
    throw new AppError('Listing is not available for booking', StatusCodes.BAD_REQUEST);
  }

  if (listing.workerProfile.userId === clientId) {
    throw new AppError('Workers cannot book themselves', StatusCodes.BAD_REQUEST);
  }

  const isScheduled = Boolean(payload.scheduledDate && payload.slotStart && payload.slotEnd);
  const scheduledDate = payload.scheduledDate ? toUtcDateOnly(payload.scheduledDate) : null;

  if (isScheduled) {
    await assertListingScheduledSlotAvailable({
      listingId: listing.id,
      workerProfileId: listing.workerProfileId,
      scheduledDateString: payload.scheduledDate,
      slotStart: payload.slotStart,
      slotEnd: payload.slotEnd
    });
  }

  const booking = await prisma.booking.create({
    data: {
      clientId,
      workerProfileId: listing.workerProfileId,
      listingId: listing.id,
      source: 'DIRECT_LISTING',
      bookingType: isScheduled ? 'SCHEDULED' : 'DIRECT',
      scheduledDate,
      slotStart: isScheduled ? payload.slotStart : null,
      slotEnd: isScheduled ? payload.slotEnd : null,
      note: payload.note ?? null,
      contactPhone: payload.contactPhone ?? null,
      status: 'PENDING'
    },
    include: bookingInclude
  });

  return serializeBooking(booking);
}

export async function getMyBookings(clientId, query) {
  const pagination = getPagination(query);
  const where = {
    clientId,
    ...(query.status ? { status: query.status } : {})
  };

  const [total, bookings] = await prisma.$transaction([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take
    })
  ]);

  return {
    items: bookings.map(serializeBooking),
    meta: buildPaginationMeta({ ...pagination, total })
  };
}

export async function getIncomingBookings(userId, query) {
  const workerProfile = await getWorkerProfileByUserIdOrThrow(userId);
  const pagination = getPagination(query);
  const where = {
    workerProfileId: workerProfile.id,
    ...(query.status ? { status: query.status } : {})
  };

  const [total, bookings] = await prisma.$transaction([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take
    })
  ]);

  return {
    items: bookings.map(serializeBooking),
    meta: buildPaginationMeta({ ...pagination, total })
  };
}

export async function getBookingDetails(user, bookingId) {
  const booking = await getBookingOrThrow(bookingId);
  const isClientOwner = booking.clientId === user.id;
  const isWorkerOwner = booking.workerProfile.userId === user.id;

  if (!isClientOwner && !isWorkerOwner) {
    throw new AppError('You do not have access to this booking', StatusCodes.FORBIDDEN);
  }

  return serializeBooking(booking);
}

async function updateBookingStatusForWorker(userId, bookingId, nextStatus) {
  const workerProfile = await getWorkerProfileByUserIdOrThrow(userId);
  const booking = await getBookingOrThrow(bookingId);

  if (booking.workerProfileId !== workerProfile.id) {
    throw new AppError('You do not have access to this booking', StatusCodes.FORBIDDEN);
  }

  if (booking.status !== 'PENDING') {
    throw new AppError('Only pending bookings can be updated', StatusCodes.BAD_REQUEST);
  }

  if (nextStatus === 'CONFIRMED' && booking.bookingType === 'SCHEDULED') {
    await assertListingScheduledSlotAvailable({
      listingId: booking.listingId,
      workerProfileId: booking.workerProfileId,
      scheduledDateString: booking.scheduledDate.toISOString().slice(0, 10),
      slotStart: booking.slotStart,
      slotEnd: booking.slotEnd,
      excludeBookingId: booking.id
    });
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: nextStatus },
    include: bookingInclude
  });

  return serializeBooking(updated);
}

export async function acceptBooking(userId, bookingId) {
  return updateBookingStatusForWorker(userId, bookingId, 'CONFIRMED');
}

export async function declineBooking(userId, bookingId) {
  return updateBookingStatusForWorker(userId, bookingId, 'DECLINED');
}

export async function cancelBooking(userId, bookingId) {
  const booking = await getBookingOrThrow(bookingId);

  if (booking.clientId !== userId) {
    throw new AppError('You do not have access to this booking', StatusCodes.FORBIDDEN);
  }

  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
    throw new AppError('This booking can no longer be cancelled', StatusCodes.BAD_REQUEST);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
      include: bookingInclude
    });

    if (cancelled.source === 'REQUEST_OFFER' && cancelled.clientRequestId) {
      await tx.clientRequest.update({
        where: { id: cancelled.clientRequestId },
        data: { status: 'CLOSED' }
      });
    }

    return cancelled;
  });

  return serializeBooking(updated);
}

export async function completeBooking(userId, bookingId) {
  const workerProfile = await getWorkerProfileByUserIdOrThrow(userId);
  const booking = await getBookingOrThrow(bookingId);

  if (booking.workerProfileId !== workerProfile.id) {
    throw new AppError('You do not have access to this booking', StatusCodes.FORBIDDEN);
  }

  if (booking.status !== 'CONFIRMED') {
    throw new AppError('Only confirmed bookings can be completed', StatusCodes.BAD_REQUEST);
  }

  const completed = await prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'COMPLETED' },
      include: bookingInclude
    });

    await tx.workerProfile.update({
      where: { id: workerProfile.id },
      data: {
        completedRequests: {
          increment: 1
        }
      }
    });

    if (updated.source === 'REQUEST_OFFER' && updated.clientRequestId) {
      await tx.clientRequest.update({
        where: { id: updated.clientRequestId },
        data: { status: 'CLOSED' }
      });
    }

    return updated;
  });

  return serializeBooking(completed);
}
