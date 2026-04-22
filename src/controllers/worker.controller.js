import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../middlewares/async.middleware.js';
import {
  addFavorite,
  browseWorkers as browseWorkersService,
  getMyFavorites,
  getWorkerDashboard,
  getWorkerDetails as getWorkerDetailsService,
  getWorkerReviews as getWorkerReviewsService,
  removeFavorite
} from '../services/worker.service.js';
import { sendSuccess } from '../utils/api-response.js';

export const browseWorkers = asyncHandler(async (req, res) => {
  const result = await browseWorkersService(req.user ?? null, req.query);
  return sendSuccess(res, {
    message: 'Workers fetched successfully',
    data: result.items,
    meta: result.meta
  });
});

export const getWorkerDetails = asyncHandler(async (req, res) => {
  const worker = await getWorkerDetailsService(req.user ?? null, req.params.workerId);
  return sendSuccess(res, {
    message: 'Worker details fetched successfully',
    data: worker
  });
});

export const favoriteWorker = asyncHandler(async (req, res) => {
  await addFavorite(req.user.id, req.params.workerId);
  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Worker added to favorites',
    data: null
  });
});

export const unfavoriteWorker = asyncHandler(async (req, res) => {
  await removeFavorite(req.user.id, req.params.workerId);
  return sendSuccess(res, {
    message: 'Worker removed from favorites',
    data: null
  });
});

export const listMyFavorites = asyncHandler(async (req, res) => {
  const result = await getMyFavorites(req.user.id, req.query);
  return sendSuccess(res, {
    message: 'Favorites fetched successfully',
    data: result.items,
    meta: result.meta
  });
});

export const getWorkerReviews = asyncHandler(async (req, res) => {
  const result = await getWorkerReviewsService(req.params.workerId, req.query);
  return sendSuccess(res, {
    message: 'Reviews fetched successfully',
    data: result.items,
    meta: result.meta
  });
});

export const workerDashboard = asyncHandler(async (req, res) => {
  const data = await getWorkerDashboard(req.user.id);
  return sendSuccess(res, {
    message: 'Dashboard fetched successfully',
    data
  });
});
