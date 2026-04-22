import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';

function formatIssues(issues) {
  return issues.reduce((acc, issue) => {
    const key = issue.path.join('.') || 'root';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(issue.message);
    return acc;
  }, {});
}

export function validateRequest(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }

      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }

      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(new AppError('Validation failed', 400, formatIssues(error.issues)));
      }

      return next(error);
    }
  };
}
