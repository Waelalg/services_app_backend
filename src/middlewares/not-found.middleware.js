import { sendError } from '../utils/api-response.js';

export function notFoundHandler(req, res) {
  return sendError(res, {
    statusCode: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}
