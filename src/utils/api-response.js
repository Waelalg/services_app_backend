export function sendSuccess(res, { statusCode = 200, message, data = null, meta } = {}) {
  const payload = {
    success: true,
    message: message ?? 'Request completed successfully'
  };

  if (data !== undefined) {
    payload.data = data;
  }

  if (meta !== undefined) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
}

export function sendError(res, { statusCode = 500, message, errors = null } = {}) {
  const payload = {
    success: false,
    message: message ?? 'Internal server error'
  };

  if (errors) {
    payload.errors = errors;
  }

  return res.status(statusCode).json(payload);
}
