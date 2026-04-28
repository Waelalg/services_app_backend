import { StatusCodes } from 'http-status-codes';
import { prisma } from '../config/prisma.js';
import { REQUEST_VISIBLE_STATUSES } from '../constants/enums.js';
import { AppError } from '../errors/app-error.js';
import { buildPaginationMeta, getPagination } from '../utils/pagination.js';
import { serializeBooking, serializeClientRequest, serializeOffer } from '../utils/serializers.js';
import { toUtcDateOnly } from '../utils/date-time.js';
import { destroyUploadedAssets, uploadImageFiles } from '../utils/uploads.js';
import { assertWorkerHasNoConfirmedOverlap } from './booking.service.js';
import { assertCategorySubcategory, getWorkerProfileByUserIdOrThrow } from './shared.service.js';

const requestBaseInclude = {
  category: true,
  subcategory: true,
  client: true,
  images: {
    orderBy: { displayOrder: 'asc' }
  }
};

async function getOwnedRequest(requestId, clientId, tx = prisma) {
  const request = await tx.clientRequest.findUnique({
    where: { id: requestId }
  });

  if (!request) {
    throw new AppError('Request not found', StatusCodes.NOT_FOUND);
  }

  if (request.clientId !== clientId) {
    throw new AppError('You do not have access to this request', StatusCodes.FORBIDDEN);
  }

  return request;
}

async function syncRequestStatusFromOffers(requestId, tx = prisma) {
  const request = await tx.clientRequest.findUnique({
    where: { id: requestId },
    select: { status: true }
  });

  if (!request || ['BOOKED', 'CLOSED', 'CANCELLED'].includes(request.status)) {
    return;
  }

  const activeOffersCount = await tx.clientRequestOffer.count({
    where: {
      requestId,
      status: 'SENT'
    }
  });

  await tx.clientRequest.update({
    where: { id: requestId },
    data: {
      status: activeOffersCount > 0 ? 'OFFERED' : 'OPEN'
    }
  });
}

export async function createClientRequest(clientId, payload, files = []) {
  if (payload.requestMode !== 'OPEN_REQUEST') {
    throw new AppError('Public requests must use OPEN_REQUEST mode', StatusCodes.BAD_REQUEST);
  }

  await assertCategorySubcategory(payload.categoryId, payload.subcategoryId);
  const uploadedImages = files.length
    ? await uploadImageFiles(files, { folder: 'requests/images' })
    : [];

  try {
    const request = await prisma.clientRequest.create({
      data: {
        clientId,
        categoryId: payload.categoryId,
        subcategoryId: payload.subcategoryId ?? null,
        title: payload.title,
        description: payload.description,
        wilaya: payload.wilaya,
        commune: payload.commune,
        addressLine: payload.addressLine ?? null,
        preferredDate: payload.preferredDate ? toUtcDateOnly(payload.preferredDate) : null,
        preferredTime: payload.preferredTime ?? null,
        requestMode: 'OPEN_REQUEST',
        status: 'OPEN',
        images: uploadedImages.length
          ? {
              create: uploadedImages.map((asset, index) => ({
                imageUrl: asset.imageUrl,
                displayOrder: index
              }))
            }
          : undefined
      },
      include: requestBaseInclude
    });

    return serializeClientRequest(request);
  } catch (error) {
    await destroyUploadedAssets(uploadedImages.map((asset) => asset.publicId));
    throw error;
  }
}

export async function updateClientRequest(clientId, requestId, payload) {
  const request = await getOwnedRequest(requestId, clientId);

  if (request.status !== 'OPEN') {
    throw new AppError('Only open requests can be updated', StatusCodes.BAD_REQUEST);
  }

  const categoryId = payload.categoryId ?? request.categoryId;
  const subcategoryId = Object.prototype.hasOwnProperty.call(payload, 'subcategoryId')
    ? payload.subcategoryId
    : request.subcategoryId;

  await assertCategorySubcategory(categoryId, subcategoryId);

  const updated = await prisma.clientRequest.update({
    where: { id: requestId },
    data: {
      ...(payload.categoryId ? { categoryId: payload.categoryId } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'subcategoryId') ? { subcategoryId } : {}),
      ...(payload.title ? { title: payload.title } : {}),
      ...(payload.description ? { description: payload.description } : {}),
      ...(payload.wilaya ? { wilaya: payload.wilaya } : {}),
      ...(payload.commune ? { commune: payload.commune } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'addressLine') ? { addressLine: payload.addressLine } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'preferredDate')
        ? { preferredDate: payload.preferredDate ? toUtcDateOnly(payload.preferredDate) : null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'preferredTime') ? { preferredTime: payload.preferredTime } : {})
    },
    include: requestBaseInclude
  });

  return serializeClientRequest(updated);
}

export async function cancelClientRequest(clientId, requestId) {
  const request = await getOwnedRequest(requestId, clientId);

  if (!['OPEN', 'OFFERED'].includes(request.status)) {
    throw new AppError('This request can no longer be cancelled', StatusCodes.BAD_REQUEST);
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    await tx.clientRequestOffer.updateMany({
      where: {
        requestId,
        status: 'SENT'
      },
      data: {
        status: 'REJECTED'
      }
    });

    return tx.clientRequest.update({
      where: { id: requestId },
      data: {
        status: 'CANCELLED'
      },
      include: requestBaseInclude
    });
  });

  return serializeClientRequest(cancelled);
}

export async function getMyRequests(clientId, query) {
  const pagination = getPagination(query);
  const where = {
    clientId,
    ...(query.status ? { status: query.status } : {})
  };

  const [total, requests] = await prisma.$transaction([
    prisma.clientRequest.count({ where }),
    prisma.clientRequest.findMany({
      where,
      include: {
        ...requestBaseInclude,
        offers: {
          select: {
            id: true,
            status: true
          }
        },
        bookings: {
          select: {
            id: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take
    })
  ]);

  return {
    items: requests.map((request) => ({
      ...serializeClientRequest(request),
      offersCount: request.offers.length,
      bookingIds: request.bookings.map((booking) => booking.id)
    })),
    meta: buildPaginationMeta({ ...pagination, total })
  };
}

export async function getRequestDetails(user, requestId) {
  const request = await prisma.clientRequest.findUnique({
    where: { id: requestId },
    include: {
      ...requestBaseInclude,
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
      bookings: true
    }
  });

  if (!request) {
    throw new AppError('Request not found', StatusCodes.NOT_FOUND);
  }

  if (user.role === 'CLIENT') {
    if (request.clientId !== user.id) {
      throw new AppError('You do not have access to this request', StatusCodes.FORBIDDEN);
    }

    return {
      ...serializeClientRequest(request, { includeOffers: true }),
      bookingIds: request.bookings.map((booking) => booking.id)
    };
  }

  const workerProfile = await getWorkerProfileByUserIdOrThrow(user.id);
  const ownOffer = request.offers.find((offer) => offer.workerProfileId === workerProfile.id);
  const isVisible = REQUEST_VISIBLE_STATUSES.includes(request.status) || Boolean(ownOffer);

  if (!isVisible) {
    throw new AppError('You do not have access to this request', StatusCodes.FORBIDDEN);
  }

  return {
    ...serializeClientRequest(request),
    myOffer: ownOffer ? serializeOffer(ownOffer) : null
  };
}

export async function getOpportunities(userId, query) {
  const workerProfile = await getWorkerProfileByUserIdOrThrow(userId);
  const pagination = getPagination(query);

  if (query.tab === 'offers') {
    const where = {
      workerProfileId: workerProfile.id,
      status: {
        in: ['SENT', 'REJECTED']
      }
    };

    const [total, offers] = await prisma.$transaction([
      prisma.clientRequestOffer.count({ where }),
      prisma.clientRequestOffer.findMany({
        where,
        include: {
          request: {
            include: requestBaseInclude
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take
      })
    ]);

    return {
      tab: 'offers',
      items: offers.map((offer) => ({
        offer: serializeOffer(offer),
        request: serializeClientRequest(offer.request)
      })),
      meta: buildPaginationMeta({ ...pagination, total })
    };
  }

  if (query.tab === 'confirmed') {
    const where = {
      workerProfileId: workerProfile.id,
      source: 'REQUEST_OFFER'
    };

    const [total, bookings] = await prisma.$transaction([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
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
              portfolioImages: true
            }
          },
          clientRequest: {
            include: requestBaseInclude
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take
      })
    ]);

    return {
      tab: 'confirmed',
      items: bookings.map(serializeBooking),
      meta: buildPaginationMeta({ ...pagination, total })
    };
  }

  const where = {
    clientId: { not: userId },
    status: query.status ?? { in: REQUEST_VISIBLE_STATUSES },
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.subcategoryId ? { subcategoryId: query.subcategoryId } : {}),
    ...(query.wilaya ? { wilaya: query.wilaya } : {}),
    ...(query.commune ? { commune: query.commune } : {}),
    offers: {
      none: {
        workerProfileId: workerProfile.id
      }
    }
  };

  const [total, requests] = await prisma.$transaction([
    prisma.clientRequest.count({ where }),
    prisma.clientRequest.findMany({
      where,
      include: {
        ...requestBaseInclude,
        _count: {
          select: { offers: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take
    })
  ]);

  return {
    tab: 'explore',
    items: requests.map((request) => ({
      ...serializeClientRequest(request),
      offersCount: request._count.offers
    })),
    meta: buildPaginationMeta({ ...pagination, total })
  };
}

export async function makeOffer(userId, requestId, payload) {
  if ((payload.proposedStartTime || payload.proposedEndTime) && !payload.proposedDate) {
    throw new AppError('proposedDate is required when proposing a time slot', StatusCodes.BAD_REQUEST);
  }

  const workerProfile = await getWorkerProfileByUserIdOrThrow(userId);
  const request = await prisma.clientRequest.findUnique({
    where: { id: requestId }
  });

  if (!request) {
    throw new AppError('Request not found', StatusCodes.NOT_FOUND);
  }

  if (!REQUEST_VISIBLE_STATUSES.includes(request.status)) {
    throw new AppError('This request is no longer accepting offers', StatusCodes.BAD_REQUEST);
  }

  if (request.clientId === userId) {
    throw new AppError('You cannot offer on your own request', StatusCodes.BAD_REQUEST);
  }

  const existingOffer = await prisma.clientRequestOffer.findUnique({
    where: {
      requestId_workerProfileId: {
        requestId,
        workerProfileId: workerProfile.id
      }
    }
  });

  if (existingOffer) {
    throw new AppError('You have already offered on this request', StatusCodes.CONFLICT);
  }

  const offer = await prisma.$transaction(async (tx) => {
    const created = await tx.clientRequestOffer.create({
      data: {
        requestId,
        workerProfileId: workerProfile.id,
        message: payload.message ?? null,
        proposedPrice: payload.proposedPrice ?? null,
        proposedDate: payload.proposedDate ? toUtcDateOnly(payload.proposedDate) : null,
        proposedStartTime: payload.proposedStartTime ?? null,
        proposedEndTime: payload.proposedEndTime ?? null,
        status: 'SENT'
      },
      include: {
        workerProfile: {
          include: {
            user: true
          }
        }
      }
    });

    await tx.clientRequest.update({
      where: { id: requestId },
      data: { status: 'OFFERED' }
    });

    return created;
  });

  return serializeOffer(offer);
}

export async function withdrawOffer(userId, offerId) {
  const workerProfile = await getWorkerProfileByUserIdOrThrow(userId);
  const offer = await prisma.clientRequestOffer.findUnique({
    where: { id: offerId }
  });

  if (!offer) {
    throw new AppError('Offer not found', StatusCodes.NOT_FOUND);
  }

  if (offer.workerProfileId !== workerProfile.id) {
    throw new AppError('You do not have access to this offer', StatusCodes.FORBIDDEN);
  }

  if (offer.status !== 'SENT') {
    throw new AppError('Only sent offers can be withdrawn', StatusCodes.BAD_REQUEST);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const withdrawn = await tx.clientRequestOffer.update({
      where: { id: offerId },
      data: { status: 'WITHDRAWN' },
      include: {
        workerProfile: {
          include: {
            user: true
          }
        }
      }
    });

    await syncRequestStatusFromOffers(withdrawn.requestId, tx);

    return withdrawn;
  });

  return serializeOffer(updated);
}

export async function listOffersForOwnRequest(clientId, requestId, query) {
  await getOwnedRequest(requestId, clientId);
  const pagination = getPagination(query);
  const where = {
    requestId,
    ...(query.status ? { status: query.status } : {})
  };

  const [total, offers] = await prisma.$transaction([
    prisma.clientRequestOffer.count({ where }),
    prisma.clientRequestOffer.findMany({
      where,
      include: {
        workerProfile: {
          include: {
            user: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take
    })
  ]);

  return {
    items: offers.map(serializeOffer),
    meta: buildPaginationMeta({ ...pagination, total })
  };
}

export async function acceptOffer(clientId, offerId) {
  const result = await prisma.$transaction(async (tx) => {
    const offer = await tx.clientRequestOffer.findUnique({
      where: { id: offerId },
      include: {
        request: {
          include: {
            client: true
          }
        }
      }
    });

    if (!offer) {
      throw new AppError('Offer not found', StatusCodes.NOT_FOUND);
    }

    if (offer.request.clientId !== clientId) {
      throw new AppError('You do not have access to this offer', StatusCodes.FORBIDDEN);
    }

    if (offer.status !== 'SENT') {
      throw new AppError('Only sent offers can be accepted', StatusCodes.BAD_REQUEST);
    }

    if (!REQUEST_VISIBLE_STATUSES.includes(offer.request.status)) {
      throw new AppError('This request is no longer accepting offers', StatusCodes.BAD_REQUEST);
    }

    const bookingType =
      offer.proposedDate && offer.proposedStartTime && offer.proposedEndTime ? 'SCHEDULED' : 'DIRECT';

    if (bookingType === 'SCHEDULED') {
      await assertWorkerHasNoConfirmedOverlap({
        workerProfileId: offer.workerProfileId,
        scheduledDate: offer.proposedDate,
        slotStart: offer.proposedStartTime,
        slotEnd: offer.proposedEndTime,
        tx
      });
    }

    const booking = await tx.booking.create({
      data: {
        clientId,
        workerProfileId: offer.workerProfileId,
        clientRequestId: offer.requestId,
        offerId: offer.id,
        source: 'REQUEST_OFFER',
        bookingType,
        scheduledDate: bookingType === 'SCHEDULED' ? offer.proposedDate : null,
        slotStart: bookingType === 'SCHEDULED' ? offer.proposedStartTime : null,
        slotEnd: bookingType === 'SCHEDULED' ? offer.proposedEndTime : null,
        note: offer.message ?? null,
        contactPhone: offer.request.client.phone ?? null,
        wilaya: offer.request.wilaya,
        commune: offer.request.commune,
        addressLine: offer.request.addressLine ?? null,
        status: 'CONFIRMED'
      },
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
            portfolioImages: true
          }
        },
        clientRequest: {
          include: requestBaseInclude
        }
      }
    });

    await tx.clientRequestOffer.update({
      where: { id: offer.id },
      data: { status: 'ACCEPTED' }
    });

    await tx.clientRequestOffer.updateMany({
      where: {
        requestId: offer.requestId,
        id: { not: offer.id },
        status: 'SENT'
      },
      data: { status: 'REJECTED' }
    });

    await tx.clientRequest.update({
      where: { id: offer.requestId },
      data: { status: 'BOOKED' }
    });

    return booking;
  });

  return serializeBooking(result);
}

export async function rejectOffer(clientId, offerId) {
  const updated = await prisma.$transaction(async (tx) => {
    const offer = await tx.clientRequestOffer.findUnique({
      where: { id: offerId }
    });

    if (!offer) {
      throw new AppError('Offer not found', StatusCodes.NOT_FOUND);
    }

    const request = await getOwnedRequest(offer.requestId, clientId, tx);

    if (offer.status !== 'SENT') {
      throw new AppError('Only sent offers can be rejected', StatusCodes.BAD_REQUEST);
    }

    if (!REQUEST_VISIBLE_STATUSES.includes(request.status)) {
      throw new AppError('This request is no longer accepting offers', StatusCodes.BAD_REQUEST);
    }

    const rejected = await tx.clientRequestOffer.update({
      where: { id: offerId },
      data: { status: 'REJECTED' },
      include: {
        workerProfile: {
          include: {
            user: true
          }
        }
      }
    });

    await syncRequestStatusFromOffers(rejected.requestId, tx);

    return rejected;
  });

  return serializeOffer(updated);
}
