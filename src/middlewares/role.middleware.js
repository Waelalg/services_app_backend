import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/app-error.js';

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('Forbidden for this role', StatusCodes.FORBIDDEN));
    }
    next();
  };
}
