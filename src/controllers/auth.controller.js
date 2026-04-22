import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../middlewares/async.middleware.js';
import { sendSuccess } from '../utils/api-response.js';
import {
  getCurrentUser,
  loginUser,
  registerUser,
  updateCurrentUser
} from '../services/auth.service.js';

export const register = asyncHandler(async (req, res) => {
  const result = await registerUser(req.body);
  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Account created successfully',
    data: result
  });
});

export const registerClient = asyncHandler(async (req, res) => {
  const result = await registerUser({
    ...req.body,
    role: 'CLIENT'
  });

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Client account created successfully',
    data: result
  });
});

export const registerWorker = asyncHandler(async (req, res) => {
  const result = await registerUser({
    ...req.body,
    role: 'WORKER'
  });

  return sendSuccess(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Worker account created successfully',
    data: result
  });
});

export const login = asyncHandler(async (req, res) => {
  const result = await loginUser(req.body);
  return sendSuccess(res, {
    message: 'Logged in successfully',
    data: result
  });
});

export const me = asyncHandler(async (req, res) => {
  const user = await getCurrentUser(req.user.id);
  return sendSuccess(res, {
    message: 'Current user fetched successfully',
    data: user
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await updateCurrentUser(req.user.id, req.body);
  return sendSuccess(res, {
    message: 'Profile updated successfully',
    data: user
  });
});
