import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../middlewares/async.middleware.js';
import {
  addAvailabilityRule,
  addPortfolioImage,
  addTimeOff,
  addWorkArea,
  createListing,
  deleteAvailabilityRule,
  deleteListing,
  deletePortfolioImage,
  deleteTimeOff,
  deleteWorkArea,
  getAvailableSlots,
  getListingById,
  getMyListings,
  publishListing,
  unpublishListing,
  updateAvailabilityRule,
  updateListing
} from '../services/listing.service.js';
import { sendSuccess } from '../utils/api-response.js';

export const createWorkerListing = asyncHandler(async (req, res) => {
  const listing = await createListing(req.user.id, req.body, req.files ?? []);
  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Listing created successfully',
    data: listing
  });
});

export const listMyListings = asyncHandler(async (req, res) => {
  const result = await getMyListings(req.user.id, req.query);
  return sendSuccess(res, {
    message: 'Listings fetched successfully',
    data: {
      hasListings: result.hasListings,
      hasPublishedListings: result.hasPublishedListings,
      items: result.items
    },
    meta: result.meta
  });
});

export const getListing = asyncHandler(async (req, res) => {
  const listing = await getListingById(req.params.listingId, req.user ?? null);
  return sendSuccess(res, {
    message: 'Listing fetched successfully',
    data: listing
  });
});

export const updateWorkerListing = asyncHandler(async (req, res) => {
  const listing = await updateListing(req.user.id, req.params.listingId, req.body);
  return sendSuccess(res, {
    message: 'Listing updated successfully',
    data: listing
  });
});

export const publishWorkerListing = asyncHandler(async (req, res) => {
  const listing = await publishListing(req.user.id, req.params.listingId);
  return sendSuccess(res, {
    message: 'Listing published successfully',
    data: listing
  });
});

export const unpublishWorkerListing = asyncHandler(async (req, res) => {
  const listing = await unpublishListing(req.user.id, req.params.listingId);
  return sendSuccess(res, {
    message: 'Listing unpublished successfully',
    data: listing
  });
});

export const removeListing = asyncHandler(async (req, res) => {
  await deleteListing(req.user.id, req.params.listingId);
  return sendSuccess(res, {
    message: 'Listing deleted successfully',
    data: null
  });
});

export const createWorkArea = asyncHandler(async (req, res) => {
  const workArea = await addWorkArea(req.user.id, req.params.listingId, req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Work area added successfully',
    data: workArea
  });
});

export const removeWorkArea = asyncHandler(async (req, res) => {
  await deleteWorkArea(req.user.id, req.params.workAreaId);
  return sendSuccess(res, {
    message: 'Work area deleted successfully',
    data: null
  });
});

export const createPortfolioImage = asyncHandler(async (req, res) => {
  const image = await addPortfolioImage(req.user.id, req.params.listingId, req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Portfolio image added successfully',
    data: image
  });
});

export const removePortfolioImage = asyncHandler(async (req, res) => {
  await deletePortfolioImage(req.user.id, req.params.portfolioImageId);
  return sendSuccess(res, {
    message: 'Portfolio image deleted successfully',
    data: null
  });
});

export const createAvailabilityRule = asyncHandler(async (req, res) => {
  const rule = await addAvailabilityRule(req.user.id, req.params.listingId, req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Availability rule added successfully',
    data: rule
  });
});

export const editAvailabilityRule = asyncHandler(async (req, res) => {
  const rule = await updateAvailabilityRule(req.user.id, req.params.ruleId, req.body);
  return sendSuccess(res, {
    message: 'Availability rule updated successfully',
    data: rule
  });
});

export const removeAvailabilityRule = asyncHandler(async (req, res) => {
  await deleteAvailabilityRule(req.user.id, req.params.ruleId);
  return sendSuccess(res, {
    message: 'Availability rule deleted successfully',
    data: null
  });
});

export const createTimeOff = asyncHandler(async (req, res) => {
  const timeOff = await addTimeOff(req.user.id, req.params.listingId, req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Time off added successfully',
    data: timeOff
  });
});

export const removeTimeOff = asyncHandler(async (req, res) => {
  await deleteTimeOff(req.user.id, req.params.timeOffId);
  return sendSuccess(res, {
    message: 'Time off deleted successfully',
    data: null
  });
});

export const listingAvailableSlots = asyncHandler(async (req, res) => {
  const data = await getAvailableSlots(req.params.listingId, req.query.date);
  return sendSuccess(res, {
    message: 'Available slots fetched successfully',
    data
  });
});
