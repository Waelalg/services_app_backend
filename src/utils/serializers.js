import { formatDateOnly, formatDateTime } from './date-time.js';

export function decimalToNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return Number(value);
  }

  if (typeof value.toNumber === 'function') {
    return value.toNumber();
  }

  return Number(value);
}

export function serializeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl,
    dateOfBirth: formatDateOnly(user.dateOfBirth),
    gender: user.gender,
    isActive: user.isActive,
    createdAt: formatDateTime(user.createdAt),
    updatedAt: formatDateTime(user.updatedAt)
  };
}

export function serializePublicUserBasic(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    avatarUrl: user.avatarUrl ?? null
  };
}

export function serializeWorkerProfile(workerProfile, options = {}) {
  if (!workerProfile) {
    return null;
  }

  const includeUser = options.includeUser ?? true;
  const includeOptionalProfile = options.includeOptionalProfile ?? true;

  return {
    id: workerProfile.id,
    user: includeUser ? serializePublicUserBasic(workerProfile.user) : undefined,
    completedRequests: workerProfile.completedRequests,
    avgResponseMinutes: workerProfile.avgResponseMinutes ?? null,
    isTrusted: workerProfile.isTrusted,
    ratingAvg: decimalToNumber(workerProfile.ratingAvg),
    ratingCount: workerProfile.ratingCount,
    optionalProfile: includeOptionalProfile
      ? {
          headline: workerProfile.headline ?? null,
          bio: workerProfile.bio ?? null,
          yearsExperience: workerProfile.yearsExperience ?? null
        }
      : undefined
  };
}

export function serializeListing(listing, options = {}) {
  if (!listing) {
    return null;
  }

  const includeAvailability = options.includeAvailability ?? false;
  const includeTimeOff = options.includeTimeOff ?? false;

  return {
    id: listing.id,
    workerProfileId: listing.workerProfileId,
    title: listing.title,
    description: listing.description,
    pricingType: listing.pricingType,
    priceFrom: decimalToNumber(listing.priceFrom),
    currency: listing.currency,
    status: listing.status,
    isPublished: listing.isPublished,
    createdAt: formatDateTime(listing.createdAt),
    updatedAt: formatDateTime(listing.updatedAt),
    category: listing.category
      ? {
          id: listing.category.id,
          name: listing.category.name,
          slug: listing.category.slug,
          icon: listing.category.icon
        }
      : null,
    subcategory: listing.subcategory
      ? {
          id: listing.subcategory.id,
          name: listing.subcategory.name,
          slug: listing.subcategory.slug
        }
      : null,
    workAreas: (listing.workAreas || []).map((area) => ({
      id: area.id,
      wilaya: area.wilaya,
      commune: area.commune
    })),
    portfolio: (listing.portfolioImages || []).map((image) => ({
      id: image.id,
      imageUrl: image.imageUrl,
      caption: image.caption,
      displayOrder: image.displayOrder
    })),
    availabilityRules: includeAvailability
      ? (listing.availabilityRules || []).map((rule) => ({
          id: rule.id,
          dayOfWeek: rule.dayOfWeek,
          startTime: rule.startTime,
          endTime: rule.endTime,
          slotDurationMinutes: rule.slotDurationMinutes,
          isActive: rule.isActive
        }))
      : undefined,
    timeOff: includeTimeOff
      ? (listing.timeOff || []).map((item) => ({
          id: item.id,
          startDateTime: formatDateTime(item.startDateTime),
          endDateTime: formatDateTime(item.endDateTime),
          reason: item.reason
        }))
      : undefined
  };
}

export function serializeReview(review) {
  if (!review) {
    return null;
  }

  return {
    id: review.id,
    bookingId: review.bookingId,
    rating: review.rating,
    comment: review.comment,
    createdAt: formatDateTime(review.createdAt),
    reviewer: review.reviewer
      ? {
          id: review.reviewer.id,
          firstName: review.reviewer.firstName,
          lastName: review.reviewer.lastName,
          fullName: `${review.reviewer.firstName} ${review.reviewer.lastName}`.trim(),
          avatarUrl: review.reviewer.avatarUrl
        }
      : null
  };
}

export function serializeOffer(offer) {
  if (!offer) {
    return null;
  }

  return {
    id: offer.id,
    requestId: offer.requestId,
    workerProfileId: offer.workerProfileId,
    status: offer.status,
    message: offer.message,
    proposedPrice: decimalToNumber(offer.proposedPrice),
    proposedDate: formatDateOnly(offer.proposedDate),
    proposedStartTime: offer.proposedStartTime,
    proposedEndTime: offer.proposedEndTime,
    createdAt: formatDateTime(offer.createdAt),
    updatedAt: formatDateTime(offer.updatedAt),
    worker: offer.workerProfile ? serializeWorkerProfile(offer.workerProfile) : null
  };
}

export function serializeBooking(booking) {
  if (!booking) {
    return null;
  }

  return {
    id: booking.id,
    clientId: booking.clientId,
    workerProfileId: booking.workerProfileId,
    listingId: booking.listingId,
    clientRequestId: booking.clientRequestId,
    offerId: booking.offerId,
    source: booking.source,
    bookingType: booking.bookingType,
    scheduledDate: formatDateOnly(booking.scheduledDate),
    slotStart: booking.slotStart,
    slotEnd: booking.slotEnd,
    note: booking.note,
    contactPhone: booking.contactPhone,
    status: booking.status,
    createdAt: formatDateTime(booking.createdAt),
    updatedAt: formatDateTime(booking.updatedAt),
    client: booking.client ? serializeUser(booking.client) : null,
    worker: booking.workerProfile ? serializeWorkerProfile(booking.workerProfile) : null,
    listing: booking.listing ? serializeListing(booking.listing) : null,
    request: booking.clientRequest
      ? {
          id: booking.clientRequest.id,
          title: booking.clientRequest.title,
          status: booking.clientRequest.status,
          wilaya: booking.clientRequest.wilaya,
          commune: booking.clientRequest.commune
        }
      : null
  };
}

export function serializeClientRequest(request, options = {}) {
  if (!request) {
    return null;
  }

  const includeOffers = options.includeOffers ?? false;

  return {
    id: request.id,
    clientId: request.clientId,
    categoryId: request.categoryId,
    subcategoryId: request.subcategoryId,
    title: request.title,
    description: request.description,
    wilaya: request.wilaya,
    commune: request.commune,
    addressLine: request.addressLine,
    preferredDate: formatDateOnly(request.preferredDate),
    preferredTime: request.preferredTime,
    requestMode: request.requestMode,
    status: request.status,
    createdAt: formatDateTime(request.createdAt),
    updatedAt: formatDateTime(request.updatedAt),
    category: request.category
      ? {
          id: request.category.id,
          name: request.category.name,
          slug: request.category.slug,
          icon: request.category.icon
        }
      : null,
    subcategory: request.subcategory
      ? {
          id: request.subcategory.id,
          name: request.subcategory.name,
          slug: request.subcategory.slug
        }
      : null,
    client: request.client ? serializeUser(request.client) : null,
    images: (request.images || []).map((image) => ({
      id: image.id,
      imageUrl: image.imageUrl,
      displayOrder: image.displayOrder
    })),
    offers: includeOffers ? (request.offers || []).map(serializeOffer) : undefined
  };
}
