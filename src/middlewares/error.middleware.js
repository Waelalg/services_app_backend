import fs from 'fs';
import { Prisma } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';
import { sendError } from '../utils/api-response.js';

function formatZodErrors(issues) {
  return issues.reduce((acc, issue) => {
    const key = issue.path.join('.') || 'root';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(issue.message);
    return acc;
  }, {});
}

function cleanupUploadedFiles(req) {
  const files = Array.isArray(req.files)
    ? req.files
    : Object.values(req.files || {}).flat();

  for (const file of files) {
    if (file?.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch {}
    }
  }
}

export function errorHandler(error, req, res, next) {
  cleanupUploadedFiles(req);

  if (error instanceof AppError) {
    return sendError(res, {
      statusCode: error.statusCode,
      message: error.message,
      errors: error.errors
    });
  }

  if (error instanceof ZodError) {
    return sendError(res, {
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'Validation failed',
      errors: formatZodErrors(error.issues)
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(', ') : 'resource';
      return sendError(res, {
        statusCode: StatusCodes.CONFLICT,
        message: 'Unique constraint violation',
        errors: {
          [target]: ['A record with this value already exists']
        }
      });
    }

    if (error.code === 'P2025') {
      return sendError(res, {
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Resource not found'
      });
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return sendError(res, {
      statusCode: StatusCodes.SERVICE_UNAVAILABLE,
      message: 'Database connection is currently unavailable. Please try again.'
    });
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'One or more uploaded images exceed the 8 MB limit'
        : 'File upload failed';

    return sendError(res, {
      statusCode: StatusCodes.BAD_REQUEST,
      message
    });
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return sendError(res, {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      message: 'Database engine encountered an unexpected error'
    });
  }

  console.error(error);

  return sendError(res, {
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    message: 'Internal server error'
  });
}
