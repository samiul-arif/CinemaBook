import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { registerUser, loginUser, getUserById, getUserBookings, getUserTickets } from '../services/authService';
import { requireAuth } from '../middleware/auth';

export const authRouter = Router();

/**
 * POST /auth/register
 * Body: { name, email, phone, password, confirmPassword }
 */
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, phone, password, confirmPassword } = req.body ?? {};
    const result = await registerUser({ name, email, phone, password, confirmPassword });
    res.status(201).json(result);
  })
);

/**
 * POST /auth/login
 * Body: { identifier (or email/phone), password }
 */
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, phone, identifier, password } = req.body ?? {};
    const userIdentifier = identifier || email || phone;
    const result = await loginUser({ identifier: userIdentifier, password });
    res.json(result);
  })
);

/**
 * GET /auth/me
 * Requires Authorization Bearer header
 */
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const user = await getUserById(userId);
    res.json({ user });
  })
);

/**
 * POST /auth/logout
 */
authRouter.post(
  '/logout',
  asyncHandler(async (_req, res) => {
    res.json({ message: 'Logged out successfully' });
  })
);

/**
 * GET /auth/my-bookings
 * Requires Authorization Bearer header
 */
authRouter.get(
  '/my-bookings',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const bookings = await getUserBookings(userId);
    res.json(bookings);
  })
);

/**
 * GET /auth/my-tickets
 * Requires Authorization Bearer header
 */
authRouter.get(
  '/my-tickets',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const tickets = await getUserTickets(userId);
    res.json(tickets);
  })
);
