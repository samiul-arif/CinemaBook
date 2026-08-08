import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  if (err instanceof ApiError) {
    logger.warn('handled error', { requestId: req.requestId, code: err.code, message: err.message });
    return res.status(err.status).json({ error: err.code, message: err.message });
  }

  logger.error('unhandled error', {
    requestId: req.requestId,
    message: err?.message,
    stack: err?.stack,
  });
  return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong' });
}
