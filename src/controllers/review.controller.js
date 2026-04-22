import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../middlewares/async.middleware.js';
import { createReview } from '../services/review.service.js';
import { sendSuccess } from '../utils/api-response.js';

export const createWorkerReview = asyncHandler(async (req, res) => {
  const review = await createReview(req.user.id, req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Review created successfully',
    data: review
  });
});
