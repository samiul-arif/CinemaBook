const getBasename = () => {
  const match = typeof window !== 'undefined' ? window.location.pathname.match(/^\/proxy\/\d+/) : null;
  return match ? match[0] : '';
};
const API_BASE = import.meta.env.VITE_API_BASE_URL || getBasename();

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem('cinemaseat_token');
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem('cinemaseat_token', token);
  } else {
    localStorage.removeItem('cinemaseat_token');
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // no body
  }

  if (!res.ok) {
    throw new ApiRequestError(res.status, body?.message ?? res.statusText, body?.error);
  }
  return body as T;
}

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

export interface UserBooking {
  id: string;
  booking_ref: string;
  status: string;
  amount: string;
  currency: string;
  hold_expires_at: string;
  ticket_generated: boolean;
  created_at: string;
  seat_label: string;
  seat_type: string;
  seat_row: string;
  seat_col: number;
  start_time: string;
  screen_name: string;
  movie_title: string;
  poster_url: string;
  duration_min: number;
  language: string;
  theatre_name: string;
  theatre_city: string;
}

export interface UserTicket extends UserBooking {
  qr_payload?: string;
  pdf_url?: string;
  genre?: string;
}

export interface Movie {
  id: string;
  title: string;
  description: string;
  poster_url: string;
  duration_min: number;
  language: string;
  genre: string;
}

export interface Showtime {
  id: string;
  movie_id: string;
  theatre_id: string;
  screen_name: string;
  start_time: string;
  base_price: string;
  theatre_name: string;
  theatre_city: string;
}

export interface Seat {
  id: string;
  showtime_id: string;
  seat_row: string;
  seat_col: number;
  seat_label: string;
  seat_type: string;
  price: string;
  status: 'AVAILABLE' | 'HELD' | 'BOOKED';
  hold_expires_at: string | null;
}

export interface HoldResponse {
  booking_ref: string;
  seat: { id: string; label: string; price: string };
  hold_ttl_seconds: number;
  hold_expires_at: string;
  otp_code?: string;
}

export interface Booking {
  id: string;
  booking_ref: string;
  showtime_id: string;
  seat_id: string;
  phone: string;
  amount: string;
  currency: string;
  status: string;
  otp_ref: string | null;
  otp_verified: boolean;
  hold_expires_at: string;
  ticket_generated?: boolean;
  qr_payload?: string;
  pdf_url?: string;
  otp_code?: string;
}

export interface DetailedTicket {
  booking_ref: string;
  movie: {
    title: string;
    genre: string;
    duration_min: number;
    language: string;
    poster_url: string;
  };
  theatre: {
    name: string;
    city: string;
    screen_name: string;
  };
  showtime: {
    start_time: string;
  };
  seat: {
    seat_label: string;
    seat_row: string;
    seat_col: number;
    seat_type: string;
    price: string;
  };
  user: {
    phone: string;
  };
  booking: {
    amount: string;
    currency: string;
    status: string;
    created_at: string;
    ticket_generated: boolean;
    qr_payload: string;
    pdf_url: string;
  };
}

export const api = {
  // Auth API
  register: (payload: { name: string; email: string; phone: string; password: string; confirmPassword?: string }) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { identifier?: string; email?: string; phone?: string; password: string }) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  me: () => request<{ user: User }>('/auth/me'),

  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),

  getMyBookings: () => request<UserBooking[]>('/auth/my-bookings'),

  getMyTickets: () => request<UserTicket[]>('/auth/my-tickets'),

  // Movies & Catalog API
  listMovies: () => request<Movie[]>('/api/movies'),
  getMovie: (id: string) => request<Movie>(`/api/movies/${id}`),
  listShowtimes: (movieId: string) => request<Showtime[]>(`/api/movies/${movieId}/showtimes`),
  getShowtime: (id: string) => request<Showtime & { movie_title: string }>(`/api/showtimes/${id}`),
  getSeatMap: (showtimeId: string) => request<Seat[]>(`/api/showtimes/${showtimeId}/seats`),

  holdSeat: (showtimeId: string, seatId: string) =>
    request<HoldResponse>(`/api/showtimes/${showtimeId}/seats/${seatId}/hold`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  getBooking: (ref: string) => request<Booking>(`/api/bookings/${ref}`),

  sendOtp: (ref: string) => request<{ otpRef: string; code?: string }>(`/api/bookings/${ref}/otp/send`, { method: 'POST' }),

  verifyOtp: (ref: string, code: string) =>
    request<{ verified: boolean; message?: string }>(`/api/bookings/${ref}/otp/verify`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  pay: (ref: string) =>
    request<{ paymentId: string; status: string }>(`/api/bookings/${ref}/pay`, { method: 'POST' }),

  generateTicket: (ref: string) =>
    request<DetailedTicket>(`/api/bookings/${ref}/ticket`, { method: 'POST' }),
};
