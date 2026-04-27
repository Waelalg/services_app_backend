import { prisma } from '../config/prisma.js';
import { AppError } from '../errors/app-error.js';
import { StatusCodes } from 'http-status-codes';
import { buildPaginationMeta, getPagination } from '../utils/pagination.js';
import {
  decimalToNumber,
  serializeClientRequest,
  serializeListing,
  serializeReview,
  serializeWorkerProfile
} from '../utils/serializers.js';
import { getWorkerProfileByUserIdOrThrow } from './shared.service.js';

function mapWorkerSort(sort) {
  switch (sort) {
    case 'topRated':
      return [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }, { createdAt: 'desc' }];
    case 'mostCompleted':
      return [{ completedRequests: 'desc' }, { ratingAvg: 'desc' }, { createdAt: 'desc' }];
    case 'newest':
    default:
      return [{ createdAt: 'desc' }];
  }
}

function getPublicWorkerSummary(worker, isFavorite = false) {
  const publishedListings = (worker.listings || []).filter((listing) => listing.isPublished);
  const workAreas = Array.from(
    new Map(
      publishedListings
        .flatMap((listing) => listing.workAreas || [])
        .map((area) => [`${area.wilaya}:${area.commune}`, area])
    ).values()
  ).map((area) => ({
    id: area.id,
    wilaya: area.wilaya,
    commune: area.commune
  }));

  return {
    ...serializeWorkerProfile(worker),
    isFavorite,
    createdAt: worker.createdAt.toISOString(),
    workAreas,
    listings: publishedListings.map((listing) => serializeListing(listing))
  };
}

export async function browseWorkers(currentUser, query) {
  const pagination = getPagination(query);

  const publishedListingCriteria = {
    isPublished: true,
    status: 'PUBLISHED',
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.subcategoryId ? { subcategoryId: query.subcategoryId } : {}),
    ...(query.wilaya || query.commune
      ? {
          workAreas: {
            some: {
              ...(query.wilaya ? { wilaya: query.wilaya } : {}),
              ...(query.commune ? { commune: query.commune } : {})
            }
          }
        }
      : {})
  };

  const where = {
    user: { isActive: true },
    listings: {
      some: publishedListingCriteria
    },
    ...(query.minRating !== undefined
      ? {
          ratingAvg: {
            gte: query.minRating
          }
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { user: { firstName: { contains: query.search, mode: 'insensitive' } } },
            { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
            { headline: { contains: query.search, mode: 'insensitive' } },
            { bio: { contains: query.search, mode: 'insensitive' } },
            {
              listings: {
                some: {
                  ...publishedListingCriteria,
                  OR: [
                    { title: { contains: query.search, mode: 'insensitive' } },
                    { description: { contains: query.search, mode: 'insensitive' } }
                  ]
                }
              }
            }
          ]
        }
      : {})
  };

  const include = {
    user: true,
    listings: {
      where: {
        isPublished: true,
        status: 'PUBLISHED'
      },
      include: {
        category: true,
        subcategory: true,
        workAreas: true,
        portfolioImages: { orderBy: { displayOrder: 'asc' } }
      },
      orderBy: { createdAt: 'desc' }
    },
    favoritedBy:
      currentUser?.role === 'CLIENT'
        ? {
            where: {
              clientId: currentUser.id
            },
            select: { id: true }
          }
        : false
  };

  const [total, workers] = await prisma.$transaction([
    prisma.workerProfile.count({ where }),
    prisma.workerProfile.findMany({
      where,
      include,
      orderBy: mapWorkerSort(query.sort),
      skip: pagination.skip,
      take: pagination.take
    })
  ]);

  return {
    items: workers.map((worker) =>
      getPublicWorkerSummary(worker, Boolean(worker.favoritedBy?.length))
    ),
    meta: buildPaginationMeta({ ...pagination, total })
  };
}

export async function getWorkerDetails(currentUser, workerId) {
  const worker = await prisma.workerProfile.findUnique({
    where: { id: workerId },
    include: {
      user: true,
      listings: {
        where: {
          isPublished: true,
          status: 'PUBLISHED'
        },
        include: {
          category: true,
          subcategory: true,
          workAreas: true,
          portfolioImages: { orderBy: { displayOrder: 'asc' } },
          availabilityRules: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] }
        },
        orderBy: { createdAt: 'desc' }
      },
      reviewsReceived: {
        include: {
          reviewer: true
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      },
      favoritedBy:
        currentUser?.role === 'CLIENT'
          ? {
              where: { clientId: currentUser.id },
              select: { id: true }
            }
          : false
    }
  });

  if (!worker || !worker.user.isActive) {
    throw new AppError('Worker not found', StatusCodes.NOT_FOUND);
  }

  const workAreas = Array.from(
    new Map(
      worker.listings
        .flatMap((listing) => listing.workAreas || [])
        .map((area) => [`${area.wilaya}:${area.commune}`, area])
    ).values()
  ).map((area) => ({
    id: area.id,
    wilaya: area.wilaya,
    commune: area.commune
  }));

  const portfolio = worker.listings.flatMap((listing) =>
    (listing.portfolioImages || []).map((image) => ({
      id: image.id,
      listingId: listing.id,
      imageUrl: image.imageUrl,
      caption: image.caption,
      displayOrder: image.displayOrder
    }))
  );

  return {
    ...serializeWorkerProfile(worker),
    isFavorite: Boolean(worker.favoritedBy?.length),
    stats: {
      completedRequests: worker.completedRequests,
      avgResponseMinutes: worker.avgResponseMinutes,
      ratingAvg: decimalToNumber(worker.ratingAvg),
      ratingCount: worker.ratingCount
    },
    workAreas,
    listings: worker.listings.map((listing) => serializeListing(listing, { includeAvailability: true })),
    portfolio,
    recentReviews: worker.reviewsReceived.map(serializeReview)
  };
}

export async function addFavorite(clientId, workerId) {
  const worker = await prisma.workerProfile.findUnique({
    where: { id: workerId },
    select: { id: true }
  });

  if (!worker) {
    throw new AppError('Worker not found', StatusCodes.NOT_FOUND);
  }

  await prisma.favorite.create({
    data: {
      clientId,
      workerProfileId: workerId
    }
  });
}

export async function removeFavorite(clientId, workerId) {
  const favorite = await prisma.favorite.findUnique({
    where: {
      clientId_workerProfileId: {
        clientId,
        workerProfileId: workerId
      }
    }
  });

  if (!favorite) {
    return;
  }

  await prisma.favorite.delete({
    where: {
      clientId_workerProfileId: {
        clientId,
        workerProfileId: workerId
      }
    }
  });
}

export async function getMyFavorites(clientId, query) {
  const pagination = getPagination(query);
  const where = { clientId };

  const [total, favorites] = await prisma.$transaction([
    prisma.favorite.count({ where }),
    prisma.favorite.findMany({
      where,
      include: {
        workerProfile: {
          include: {
            user: true,
            listings: {
              where: {
                isPublished: true,
                status: 'PUBLISHED'
              },
              include: {
                category: true,
                subcategory: true,
                workAreas: true,
                portfolioImages: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take
    })
  ]);

  return {
    items: favorites.map((favorite) => getPublicWorkerSummary(favorite.workerProfile, true)),
    meta: buildPaginationMeta({ ...pagination, total })
  };
}

export async function getWorkerReviews(workerId, query) {
  const worker = await prisma.workerProfile.findUnique({
    where: { id: workerId },
    select: { id: true }
  });

  if (!worker) {
    throw new AppError('Worker not found', StatusCodes.NOT_FOUND);
  }

  const pagination = getPagination(query);
  const where = { reviewedWorkerId: workerId };

  const [total, reviews] = await prisma.$transaction([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      include: {
        reviewer: true
      },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take
    })
  ]);

  return {
    items: reviews.map(serializeReview),
    meta: buildPaginationMeta({ ...pagination, total })
  };
}

export async function getWorkerDashboard(userId) {
  const workerProfile = await getWorkerProfileByUserIdOrThrow(userId);

  const [counts, recentIncomingBookings, upcomingJobs, listings] = await Promise.all([
    prisma.booking.groupBy({
      by: ['status'],
      where: {
        workerProfileId: workerProfile.id
      },
      _count: { id: true }
    }),
    prisma.booking.findMany({
      where: {
        workerProfileId: workerProfile.id
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
          include: {
            category: true,
            subcategory: true,
            client: true,
            images: {
              orderBy: { displayOrder: 'asc' }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    }),
    prisma.booking.findMany({
      where: {
        workerProfileId: workerProfile.id,
        status: 'CONFIRMED',
        scheduledDate: {
          gte: new Date(new Date().toISOString().slice(0, 10))
        }
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
          include: {
            category: true,
            subcategory: true,
            client: true,
            images: {
              orderBy: { displayOrder: 'asc' }
            }
          }
        }
      },
      orderBy: [{ scheduledDate: 'asc' }, { slotStart: 'asc' }],
      take: 5
    }),
    prisma.workerListing.findMany({
      where: {
        workerProfileId: workerProfile.id
      },
      include: {
        workAreas: true
      }
    })
  ]);

  const categoryIds = [...new Set(listings.map((listing) => listing.categoryId))];
  const locationPairs = Array.from(
    new Set(listings.flatMap((listing) => listing.workAreas.map((area) => `${area.wilaya}:${area.commune}`)))
  ).map((pair) => {
    const [wilaya, commune] = pair.split(':');
    return { wilaya, commune };
  });

  const recentOpportunities =
    categoryIds.length || locationPairs.length
      ? await prisma.clientRequest.findMany({
          where: {
            status: {
              in: ['OPEN', 'OFFERED']
            },
            clientId: {
              not: userId
            },
            offers: {
              none: {
                workerProfileId: workerProfile.id
              }
            },
            OR: [
              ...(categoryIds.length ? [{ categoryId: { in: categoryIds } }] : []),
              ...locationPairs.map((area) => ({
                wilaya: area.wilaya,
                commune: area.commune
              }))
            ]
          },
          include: {
            category: true,
            subcategory: true,
            client: true,
            images: {
              orderBy: { displayOrder: 'asc' }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        })
      : [];

  const stats = {
    pending: 0,
    confirmed: 0,
    done: 0,
    cancelled: 0
  };

  for (const item of counts) {
    if (item.status === 'PENDING') stats.pending = item._count.id;
    if (item.status === 'CONFIRMED') stats.confirmed = item._count.id;
    if (item.status === 'COMPLETED') stats.done = item._count.id;
    if (item.status === 'CANCELLED') stats.cancelled = item._count.id;
  }

  return {
    stats,
    recentIncomingBookings: recentIncomingBookings.map((booking) => ({
      id: booking.id,
      status: booking.status,
      createdAt: booking.createdAt.toISOString(),
      scheduledDate: booking.scheduledDate ? booking.scheduledDate.toISOString().slice(0, 10) : null,
      slotStart: booking.slotStart,
      slotEnd: booking.slotEnd,
      client: {
        id: booking.client.id,
        firstName: booking.client.firstName,
        lastName: booking.client.lastName,
        fullName: `${booking.client.firstName} ${booking.client.lastName}`.trim()
      },
      listing: booking.listing ? serializeListing(booking.listing) : null,
      request: booking.clientRequest ? serializeClientRequest(booking.clientRequest) : null
    })),
    recentOpportunities: recentOpportunities.map(serializeClientRequest),
    upcomingJobs: upcomingJobs.map((booking) => ({
      id: booking.id,
      status: booking.status,
      scheduledDate: booking.scheduledDate ? booking.scheduledDate.toISOString().slice(0, 10) : null,
      slotStart: booking.slotStart,
      slotEnd: booking.slotEnd,
      client: {
        id: booking.client.id,
        firstName: booking.client.firstName,
        lastName: booking.client.lastName,
        fullName: `${booking.client.firstName} ${booking.client.lastName}`.trim()
      },
      listing: booking.listing ? serializeListing(booking.listing) : null,
      request: booking.clientRequest ? serializeClientRequest(booking.clientRequest) : null
    }))
  };
}
