import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from './errorHandler';

const JWT_SECRET = process.env.JWT_SECRET || 'cinemaseat_jwt_secret_key_2026';

export interface JwtUserPayload {
  id: string;
  email: string;
  phone: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtUserPayload;
    }
  }
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return authHeader.trim();
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Authentication token required'));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtUserPayload;
    req.user = payload;
    next();
  } catch (err) {
    next(new ApiError(401, 'INVALID_TOKEN', 'Authentication token is invalid or expired'));
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtUserPayload;
    req.user = payload;
  } catch (err) {
    // Ignore invalid token in optional auth
  }
  next();
}

export const requireAuth = authenticateToken;
