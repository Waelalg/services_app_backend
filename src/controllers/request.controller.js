import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../middlewares/async.middleware.js';
import {
  acceptOffer,
  cancelClientRequest,
  createClientRequest,
  getMyRequests,
  getOpportunities,
  getRequestDetails,
  listOffersForOwnRequest,
  makeOffer,
  rejectOffer,
  updateClientRequest,
  withdrawOffer
} from '../services/request.service.js';
import { sendSuccess } from '../utils/api-response.js';

export const createRequest = asyncHandler(async (req, res) => {
  const request = await createClientRequest(req.user.id, req.body, req.files ?? []);
  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Request created successfully',
    data: request
  });
});

export const editRequest = asyncHandler(async (req, res) => {
  const request = await updateClientRequest(req.user.id, req.params.requestId, req.body);
  return sendSuccess(res, {
    message: 'Request updated successfully',
    data: request
  });
});

export const cancelRequest = asyncHandler(async (req, res) => {
  const request = await cancelClientRequest(req.user.id, req.params.requestId);
  return sendSuccess(res, {
    message: 'Request cancelled successfully',
    data: request
  });
});

export const listMyRequests = asyncHandler(async (req, res) => {
  const result = await getMyRequests(req.user.id, req.query);
  return sendSuccess(res, {
    message: 'Requests fetched successfully',
    data: result.items,
    meta: result.meta
  });
});

export const requestDetails = asyncHandler(async (req, res) => {
  const request = await getRequestDetails(req.user, req.params.requestId);
  return sendSuccess(res, {
    message: 'Request details fetched successfully',
    data: request
  });
});

export const opportunitiesFeed = asyncHandler(async (req, res) => {
  const result = await getOpportunities(req.user.id, req.query);
  return sendSuccess(res, {
    message: 'Opportunities fetched successfully',
    data: result.items,
    meta: result.meta
  });
});

export const createOffer = asyncHandler(async (req, res) => {
  const offer = await makeOffer(req.user.id, req.params.requestId, req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Offer sent successfully',
    data: offer
  });
});

export const removeOffer = asyncHandler(async (req, res) => {
  const offer = await withdrawOffer(req.user.id, req.params.offerId);
  return sendSuccess(res, {
    message: 'Offer withdrawn successfully',
    data: offer
  });
});

export const requestOffers = asyncHandler(async (req, res) => {
  const result = await listOffersForOwnRequest(req.user.id, req.params.requestId, req.query);
  return sendSuccess(res, {
    message: 'Offers fetched successfully',
    data: result.items,
    meta: result.meta
  });
});

export const acceptRequestOffer = asyncHandler(async (req, res) => {
  const booking = await acceptOffer(req.user.id, req.params.offerId);
  return sendSuccess(res, {
    message: 'Offer accepted successfully',
    data: booking
  });
});

export const rejectRequestOffer = asyncHandler(async (req, res) => {
  const offer = await rejectOffer(req.user.id, req.params.offerId);
  return sendSuccess(res, {
    message: 'Offer rejected successfully',
    data: offer
  });
});
