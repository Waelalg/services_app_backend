import { StatusCodes } from 'http-status-codes';
import { prisma } from '../config/prisma.js';
import { AppError } from '../errors/app-error.js';
import { verifyToken } from '../utils/jwt.js';

async function authenticateToken(token) {
  const payload = verifyToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: {
      workerProfile: {
        select: { id: true }
      }
    }
  });

  if (!user || !user.isActive) {
    throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED);
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    workerProfileId: user.workerProfile?.id ?? null
  };
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

export async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);

    if (!token) {
      throw new AppError('Authentication required', StatusCodes.UNAUTHORIZED);
    }

    req.user = await authenticateToken(token);
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }

    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return next(new AppError('Invalid or expired token', StatusCodes.UNAUTHORIZED));
    }

    return next(error);
  }
}

export async function optionalAuth(req, res, next) {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return next();
    }

    req.user = await authenticateToken(token);
    return next();
  } catch (error) {
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return next();
    }

    return next(error);
  }
}
