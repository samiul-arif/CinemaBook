import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool';
import { ApiError } from '../middleware/errorHandler';

const JWT_SECRET = process.env.JWT_SECRET || 'cinemaseat_jwt_secret_key_2026';
const JWT_EXPIRES_IN = '7d';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export function generateToken(user: { id: string; email: string; phone: string; name: string }): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export async function registerUser(params: {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword?: string;
}): Promise<AuthResponse> {
  const { name, email, phone, password, confirmPassword } = params;

  if (!name || !name.trim()) {
    throw new ApiError(400, 'NAME_REQUIRED', 'Full name is required');
  }
  if (!email || !email.includes('@')) {
    throw new ApiError(400, 'INVALID_EMAIL', 'Valid email address is required');
  }
  if (!phone || !phone.trim()) {
    throw new ApiError(400, 'PHONE_REQUIRED', 'Phone number is required');
  }
  if (!password || password.length < 8) {
    throw new ApiError(400, 'INVALID_PASSWORD_LENGTH', 'Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    throw new ApiError(400, 'PASSWORD_UPPERCASE_REQUIRED', 'Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    throw new ApiError(400, 'PASSWORD_LOWERCASE_REQUIRED', 'Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    throw new ApiError(400, 'PASSWORD_NUMBER_REQUIRED', 'Password must contain at least one number');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    throw new ApiError(400, 'PASSWORD_SPECIAL_REQUIRED', 'Password must contain at least one special character');
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw new ApiError(400, 'PASSWORD_MISMATCH', 'Confirm password does not match');
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone.trim();

  // Check unique email
  const emailCheck = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
  if (emailCheck.rows.length > 0) {
    throw new ApiError(409, 'EMAIL_EXISTS', 'An account with this email address already exists');
  }

  // Check unique phone
  const phoneCheck = await pool.query('SELECT id FROM users WHERE phone = $1', [cleanPhone]);
  if (phoneCheck.rows.length > 0) {
    throw new ApiError(409, 'PHONE_EXISTS', 'An account with this phone number already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const insertRes = await pool.query<User>(
    `INSERT INTO users (name, email, phone, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, phone, created_at, updated_at`,
    [name.trim(), cleanEmail, cleanPhone, passwordHash]
  );

  const user = insertRes.rows[0];
  const token = generateToken(user);

  return { token, user };
}

export async function loginUser(params: {
  identifier: string; // email or phone
  password: string;
}): Promise<AuthResponse> {
  const { identifier, password } = params;

  if (!identifier || !identifier.trim()) {
    throw new ApiError(400, 'IDENTIFIER_REQUIRED', 'Email or phone number is required');
  }
  if (!password) {
    throw new ApiError(400, 'PASSWORD_REQUIRED', 'Password is required');
  }

  const cleanId = identifier.trim().toLowerCase();

  const userRes = await pool.query<User & { password_hash: string }>(
    `SELECT id, name, email, phone, password_hash, created_at, updated_at
     FROM users
     WHERE LOWER(email) = $1 OR phone = $2`,
    [cleanId, identifier.trim()]
  );

  if (userRes.rows.length === 0) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email/phone or password');
  }

  const userRecord = userRes.rows[0];
  const valid = await bcrypt.compare(password, userRecord.password_hash);

  if (!valid) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email/phone or password');
  }

  const user: User = {
    id: userRecord.id,
    name: userRecord.name,
    email: userRecord.email,
    phone: userRecord.phone,
    created_at: userRecord.created_at,
    updated_at: userRecord.updated_at,
  };

  const token = generateToken(user);

  return { token, user };
}

export async function getUserById(id: string): Promise<User> {
  const res = await pool.query<User>(
    `SELECT id, name, email, phone, created_at, updated_at FROM users WHERE id = $1`,
    [id]
  );
  if (res.rows.length === 0) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User profile not found');
  }
  return res.rows[0];
}

export async function getUserBookings(userId: string) {
  const res = await pool.query(
    `SELECT b.id, b.booking_ref, b.status, b.amount, b.currency, b.hold_expires_at, b.ticket_generated, b.created_at,
            s.seat_label, s.seat_type, s.seat_row, s.seat_col,
            st.start_time, st.screen_name,
            m.title as movie_title, m.poster_url, m.duration_min, m.language,
            t.name as theatre_name, t.city as theatre_city
     FROM bookings b
     JOIN showtimes st ON b.showtime_id = st.id
     JOIN movies m ON st.movie_id = m.id
     JOIN theatres t ON st.theatre_id = t.id
     JOIN seats s ON b.seat_id = s.id
     WHERE b.user_id = $1
     ORDER BY b.created_at DESC`,
    [userId]
  );
  return res.rows;
}

export async function getUserTickets(userId: string) {
  const res = await pool.query(
    `SELECT b.id, b.booking_ref, b.status, b.amount, b.currency, b.hold_expires_at, b.ticket_generated, b.qr_payload, b.pdf_url, b.created_at,
            s.seat_label, s.seat_type, s.seat_row, s.seat_col,
            st.start_time, st.screen_name,
            m.title as movie_title, m.poster_url, m.duration_min, m.language, m.genre,
            t.name as theatre_name, t.city as theatre_city
     FROM bookings b
     JOIN showtimes st ON b.showtime_id = st.id
     JOIN movies m ON st.movie_id = m.id
     JOIN theatres t ON st.theatre_id = t.id
     JOIN seats s ON b.seat_id = s.id
     WHERE b.user_id = $1 AND (b.status = 'CONFIRMED' OR b.ticket_generated = true)
     ORDER BY b.created_at DESC`,
    [userId]
  );
  return res.rows;
}
