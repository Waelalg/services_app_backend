import { StatusCodes } from 'http-status-codes';
import { prisma } from '../config/prisma.js';
import { AppError } from '../errors/app-error.js';
import { buildAvailableSlots } from '../utils/availability.js';
import { toUtcDateOnly } from '../utils/date-time.js';
import { buildPaginationMeta, getPagination } from '../utils/pagination.js';
import { serializeListing, serializeWorkerProfile } from '../utils/serializers.js';
import {
  destroyUploadedAssets,
  extractCloudinaryPublicId,
  uploadImageFiles
} from '../utils/uploads.js';
import {
  assertCategorySubcategory,
  getOwnedListingOrThrow,
  getWorkerProfileByUserIdOrThrow,
  hasActiveListingBookings
} from './shared.service.js';

const listingInclude = {
  category: true,
  subcategory: true,
  workAreas: {
    orderBy: [{ wilaya: 'asc' }, { commune: 'asc' }]
  },
  portfolioImages: {
    orderBy: { displayOrder: 'asc' }
  },
  availabilityRules: {
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }]
  },
  timeOff: {
    orderBy: { startDateTime: 'asc' }
  }
};

function mapServiceListingSort(sort) {
  switch (sort) {
    case 'topRated':
      return [
        { workerProfile: { ratingAvg: 'desc' } },
        { workerProfile: { ratingCount: 'desc' } },
        { createdAt: 'desc' }
      ];
    case 'mostCompleted':
      return [
        { workerProfile: { completedRequests: 'desc' } },
        { workerProfile: { ratingAvg: 'desc' } },
        { createdAt: 'desc' }
      ];
    case 'priceLow':
      return [{ priceFrom: 'asc' }, { createdAt: 'desc' }];
    case 'priceHigh':
      return [{ priceFrom: 'desc' }, { createdAt: 'desc' }];
    case 'newest':
    default:
      return [{ createdAt: 'desc' }];
  }
}

export async function browsePublishedServiceListings(currentUser, query) {
  if (query.categoryId) {
    await assertCategorySubcategory(query.categoryId, query.subcategoryId);
  }

  const pagination = getPagination(query);
  const where = {
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    subcategoryId: query.subcategoryId,
    isPublished: true,
    status: 'PUBLISHED',
    workerProfile: {
      user: {
        isActive: true
      },
      ...(query.minRating !== undefined
        ? {
            ratingAvg: {
              gte: query.minRating
            }
          }
        : {})
    },
    ...(query.wilaya || query.commune
      ? {
          workAreas: {
            some: {
              ...(query.wilaya ? { wilaya: query.wilaya } : {}),
              ...(query.commune ? { commune: query.commune } : {})
            }
          }
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } }
          ]
        }
      : {})
  };

  const [total, listings] = await prisma.$transaction([
    prisma.workerListing.count({ where }),
    prisma.workerListing.findMany({
      where,
      include: {
        ...listingInclude,
        workerProfile: {
          include: {
            user: true,
            favoritedBy:
              currentUser?.role === 'CLIENT'
                ? {
                    where: {
                      clientId: currentUser.id
                    },
                    select: { id: true }
                  }
                : false
          }
        }
      },
      orderBy: mapServiceListingSort(query.sort),
      skip: pagination.skip,
      take: pagination.take
    })
  ]);

  return {
    items: listings.map((listing) => ({
      ...serializeListing(listing),
      worker: serializeWorkerProfile(listing.workerProfile),
      isFavorite: Boolean(listing.workerProfile.favoritedBy?.length)
    })),
    meta: buildPaginationMeta({ ...pagination, total })
  };
}

export async function createListing(userId, payload, files = []) {
  const workerProfile = await getWorkerProfileByUserIdOrThrow(userId);
  await assertCategorySubcategory(payload.categoryId, payload.subcategoryId);

  const uploadedImages = files.length
    ? await uploadImageFiles(files, { folder: 'listings/gallery' })
    : [];

  try {
    const listing = await prisma.workerListing.create({
      data: {
        workerProfileId: workerProfile.id,
        categoryId: payload.categoryId,
        subcategoryId: payload.subcategoryId ?? null,
        title: payload.title,
        description: payload.description,
        pricingType: payload.pricingType,
        priceFrom: payload.priceFrom ?? null,
        currency: payload.currency.toUpperCase(),
        status: payload.isPublished ? 'PUBLISHED' : 'DRAFT',
        isPublished: payload.isPublished ?? false,
        workAreas: payload.workAreas?.length
          ? {
              create: payload.workAreas.map((area) => ({
                wilaya: area.wilaya,
                commune: area.commune
              }))
            }
          : undefined,
        availabilityRules: payload.availabilityRules?.length
          ? {
              create: payload.availabilityRules.map((rule) => ({
                dayOfWeek: rule.dayOfWeek,
                startTime: rule.startTime,
                endTime: rule.endTime,
                slotDurationMinutes: rule.slotDurationMinutes,
                isActive: rule.isActive
              }))
            }
          : undefined,
        portfolioImages: uploadedImages.length
          ? {
              create: uploadedImages.map((asset, index) => ({
                imageUrl: asset.imageUrl,
                displayOrder: index
              }))
            }
          : undefined
      },
      include: listingInclude
    });

    return serializeListing(listing, { includeAvailability: true, includeTimeOff: true });
  } catch (error) {
    await destroyUploadedAssets(uploadedImages.map((asset) => asset.publicId));
    throw error;
  }
}

export async function updateListing(userId, listingId, payload) {
  const listing = await getOwnedListingOrThrow(listingId, userId);
  const categoryId = payload.categoryId ?? listing.categoryId;
  const subcategoryId = Object.prototype.hasOwnProperty.call(payload, 'subcategoryId')
    ? payload.subcategoryId
    : listing.subcategoryId;

  await assertCategorySubcategory(categoryId, subcategoryId);

  const data = {
    ...(payload.categoryId ? { categoryId: payload.categoryId } : {}),
    ...(Object.prototype.hasOwnProperty.call(payload, 'subcategoryId') ? { subcategoryId } : {}),
    ...(payload.title ? { title: payload.title } : {}),
    ...(payload.description ? { description: payload.description } : {}),
    ...(payload.pricingType ? { pricingType: payload.pricingType } : {}),
    ...(Object.prototype.hasOwnProperty.call(payload, 'priceFrom') ? { priceFrom: payload.priceFrom } : {}),
    ...(payload.currency ? { currency: payload.currency.toUpperCase() } : {}),
    ...(payload.status ? { status: payload.status } : {}),
    ...(typeof payload.isPublished === 'boolean' ? { isPublished: payload.isPublished } : {})
  };

  if (data.isPublished === true) {
    data.status = 'PUBLISHED';
  }

  if (data.isPublished === false && listing.status === 'PUBLISHED' && !data.status) {
    data.status = 'PAUSED';
  }

  const updated = await prisma.workerListing.update({
    where: { id: listingId },
    data,
    include: listingInclude
  });

  return serializeListing(updated, { includeAvailability: true, includeTimeOff: true });
}

export async function publishListing(userId, listingId) {
  await getOwnedListingOrThrow(listingId, userId);

  const listing = await prisma.workerListing.update({
    where: { id: listingId },
    data: {
      status: 'PUBLISHED',
      isPublished: true
    },
    include: listingInclude
  });

  return serializeListing(listing, { includeAvailability: true, includeTimeOff: true });
}

export async function unpublishListing(userId, listingId) {
  await getOwnedListingOrThrow(listingId, userId);

  const listing = await prisma.workerListing.update({
    where: { id: listingId },
    data: {
      status: 'PAUSED',
      isPublished: false
    },
    include: listingInclude
  });

  return serializeListing(listing, { includeAvailability: true, includeTimeOff: true });
}

export async function getMyListings(userId, query) {
  const workerProfile = await getWorkerProfileByUserIdOrThrow(userId);
  const pagination = getPagination(query);
  const where = {
    workerProfileId: workerProfile.id,
    ...(query.status ? { status: query.status } : {}),
    ...(typeof query.isPublished === 'boolean' ? { isPublished: query.isPublished } : {})
  };

  const [total, listings, listingCounts] = await prisma.$transaction([
    prisma.workerListing.count({ where }),
    prisma.workerListing.findMany({
      where,
      include: listingInclude,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take
    }),
    prisma.workerListing.groupBy({
      by: ['isPublished'],
      where: { workerProfileId: workerProfile.id },
      _count: { id: true }
    })
  ]);

  const totalListings = listingCounts.reduce((sum, item) => sum + item._count.id, 0);
  const publishedListings = listingCounts.find((item) => item.isPublished)?._count.id ?? 0;

  return {
    hasListings: totalListings > 0,
    hasPublishedListings: publishedListings > 0,
    items: listings.map((listing) => serializeListing(listing, { includeAvailability: true, includeTimeOff: true })),
    meta: buildPaginationMeta({ ...pagination, total })
  };
}

export async function getListingById(listingId, user) {
  const listing = await prisma.workerListing.findUnique({
    where: { id: listingId },
    include: {
      ...listingInclude,
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

  const isOwner = user?.id && listing.workerProfile.userId === user.id;

  if (!listing.isPublished && !isOwner) {
    throw new AppError('Listing not found', StatusCodes.NOT_FOUND);
  }

  return {
    ...serializeListing(listing, { includeAvailability: true, includeTimeOff: isOwner }),
    worker: serializeWorkerProfile(listing.workerProfile)
  };
}

export async function deleteListing(userId, listingId) {
  const listing = await getOwnedListingOrThrow(listingId, userId);

  if (await hasActiveListingBookings(listingId)) {
    throw new AppError('Listing cannot be deleted while it has active bookings', StatusCodes.CONFLICT);
  }

  await prisma.workerListing.delete({
    where: { id: listingId }
  });

  await destroyUploadedAssets(
    (listing.portfolioImages || []).map((image) => extractCloudinaryPublicId(image.imageUrl))
  );
}

export async function addWorkArea(userId, listingId, payload) {
  await getOwnedListingOrThrow(listingId, userId);

  const workArea = await prisma.listingWorkArea.create({
    data: {
      listingId,
      wilaya: payload.wilaya,
      commune: payload.commune
    }
  });

  return {
    id: workArea.id,
    listingId: workArea.listingId,
    wilaya: workArea.wilaya,
    commune: workArea.commune
  };
}

export async function deleteWorkArea(userId, workAreaId) {
  const workArea = await prisma.listingWorkArea.findUnique({
    where: { id: workAreaId },
    include: {
      listing: {
        include: {
          workerProfile: true
        }
      }
    }
  });

  if (!workArea) {
    throw new AppError('Work area not found', StatusCodes.NOT_FOUND);
  }

  if (workArea.listing.workerProfile.userId !== userId) {
    throw new AppError('You do not have access to this work area', StatusCodes.FORBIDDEN);
  }

  await prisma.listingWorkArea.delete({
    where: { id: workAreaId }
  });
}

export async function addPortfolioImage(userId, listingId, payload) {
  await getOwnedListingOrThrow(listingId, userId);

  const image = await prisma.portfolioImage.create({
    data: {
      listingId,
      imageUrl: payload.imageUrl,
      caption: payload.caption ?? null,
      displayOrder: payload.displayOrder
    }
  });

  return {
    id: image.id,
    listingId: image.listingId,
    imageUrl: image.imageUrl,
    caption: image.caption,
    displayOrder: image.displayOrder
  };
}

export async function deletePortfolioImage(userId, portfolioImageId) {
  const image = await prisma.portfolioImage.findUnique({
    where: { id: portfolioImageId },
    include: {
      listing: {
        include: {
          workerProfile: true
        }
      }
    }
  });

  if (!image) {
    throw new AppError('Portfolio image not found', StatusCodes.NOT_FOUND);
  }

  if (image.listing.workerProfile.userId !== userId) {
    throw new AppError('You do not have access to this portfolio image', StatusCodes.FORBIDDEN);
  }

  await prisma.portfolioImage.delete({
    where: { id: portfolioImageId }
  });

  await destroyUploadedAssets([extractCloudinaryPublicId(image.imageUrl)]);
}

export async function addAvailabilityRule(userId, listingId, payload) {
  await getOwnedListingOrThrow(listingId, userId);

  const rule = await prisma.workerAvailabilityRule.create({
    data: {
      listingId,
      dayOfWeek: payload.dayOfWeek,
      startTime: payload.startTime,
      endTime: payload.endTime,
      slotDurationMinutes: payload.slotDurationMinutes,
      isActive: payload.isActive
    }
  });

  return rule;
}

export async function updateAvailabilityRule(userId, ruleId, payload) {
  const rule = await prisma.workerAvailabilityRule.findUnique({
    where: { id: ruleId },
    include: {
      listing: {
        include: {
          workerProfile: true
        }
      }
    }
  });

  if (!rule) {
    throw new AppError('Availability rule not found', StatusCodes.NOT_FOUND);
  }

  if (rule.listing.workerProfile.userId !== userId) {
    throw new AppError('You do not have access to this availability rule', StatusCodes.FORBIDDEN);
  }

  const nextStart = payload.startTime ?? rule.startTime;
  const nextEnd = payload.endTime ?? rule.endTime;

  if (nextStart >= nextEnd) {
    throw new AppError('startTime must be earlier than endTime', StatusCodes.BAD_REQUEST);
  }

  return prisma.workerAvailabilityRule.update({
    where: { id: ruleId },
    data: payload
  });
}

export async function deleteAvailabilityRule(userId, ruleId) {
  const rule = await prisma.workerAvailabilityRule.findUnique({
    where: { id: ruleId },
    include: {
      listing: {
        include: {
          workerProfile: true
        }
      }
    }
  });

  if (!rule) {
    throw new AppError('Availability rule not found', StatusCodes.NOT_FOUND);
  }

  if (rule.listing.workerProfile.userId !== userId) {
    throw new AppError('You do not have access to this availability rule', StatusCodes.FORBIDDEN);
  }

  await prisma.workerAvailabilityRule.delete({
    where: { id: ruleId }
  });
}

export async function addTimeOff(userId, listingId, payload) {
  await getOwnedListingOrThrow(listingId, userId);

  return prisma.workerTimeOff.create({
    data: {
      listingId,
      startDateTime: new Date(payload.startDateTime),
      endDateTime: new Date(payload.endDateTime),
      reason: payload.reason ?? null
    }
  });
}

export async function deleteTimeOff(userId, timeOffId) {
  const timeOff = await prisma.workerTimeOff.findUnique({
    where: { id: timeOffId },
    include: {
      listing: {
        include: {
          workerProfile: true
        }
      }
    }
  });

  if (!timeOff) {
    throw new AppError('Time off entry not found', StatusCodes.NOT_FOUND);
  }

  if (timeOff.listing.workerProfile.userId !== userId) {
    throw new AppError('You do not have access to this time off entry', StatusCodes.FORBIDDEN);
  }

  await prisma.workerTimeOff.delete({
    where: { id: timeOffId }
  });
}

export async function getAvailableSlots(listingId, dateString) {
  const listing = await prisma.workerListing.findUnique({
    where: { id: listingId },
    include: {
      availabilityRules: true,
      timeOff: true
    }
  });

  if (!listing || !listing.isPublished || listing.status !== 'PUBLISHED') {
    throw new AppError('Listing not found', StatusCodes.NOT_FOUND);
  }

  const confirmedBookings = await prisma.booking.findMany({
    where: {
      workerProfileId: listing.workerProfileId,
      status: 'CONFIRMED',
      scheduledDate: toUtcDateOnly(dateString),
      slotStart: { not: null },
      slotEnd: { not: null }
    },
    select: {
      slotStart: true,
      slotEnd: true
    }
  });

  return {
    listingId: listing.id,
    date: dateString,
    slots: buildAvailableSlots({
      dateString,
      rules: listing.availabilityRules,
      timeOff: listing.timeOff,
      confirmedBookings
    })
  };
}
