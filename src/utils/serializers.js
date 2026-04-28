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

export function serializeSubcategory(subcategory) {
  if (!subcategory) {
    return null;
  }

  return {
    id: subcategory.id,
    categoryId: subcategory.categoryId,
    name: subcategory.name,
    slug: subcategory.slug,
    imageUrl: subcategory.imageUrl ?? null,
    displayOrder: subcategory.displayOrder
  };
}

export function serializeCategory(category, options = {}) {
  if (!category) {
    return null;
  }

  const includeSubcategories = options.includeSubcategories ?? false;

  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    imageUrl: category.imageUrl ?? null,
    displayOrder: category.displayOrder,
    subcategories: includeSubcategories
      ? (category.subcategories || []).map(serializeSubcategory)
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
    category: serializeCategory(listing.category),
    subcategory: serializeSubcategory(listing.subcategory),
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

  const address = {
    wilaya: booking.wilaya ?? booking.clientRequest?.wilaya ?? null,
    commune: booking.commune ?? booking.clientRequest?.commune ?? null,
    addressLine: booking.addressLine ?? booking.clientRequest?.addressLine ?? null
  };

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
    address,
    status: booking.status,
    createdAt: formatDateTime(booking.createdAt),
    updatedAt: formatDateTime(booking.updatedAt),
    client: booking.client ? serializeUser(booking.client) : null,
    worker: booking.workerProfile ? serializeWorkerProfile(booking.workerProfile) : null,
    listing: booking.listing ? serializeListing(booking.listing) : null,
    request: booking.clientRequest ? serializeClientRequest(booking.clientRequest) : null
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
    category: serializeCategory(request.category),
    subcategory: serializeSubcategory(request.subcategory),
    client: request.client ? serializeUser(request.client) : null,
    images: (request.images || []).map((image) => ({
      id: image.id,
      imageUrl: image.imageUrl,
      displayOrder: image.displayOrder
    })),
    offers: includeOffers ? (request.offers || []).map(serializeOffer) : undefined
  };
}
