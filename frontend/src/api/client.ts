const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
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
}

export const api = {
  listMovies: () => request<Movie[]>('/api/movies'),
  getMovie: (id: string) => request<Movie>(`/api/movies/${id}`),
  listShowtimes: (movieId: string) => request<Showtime[]>(`/api/movies/${movieId}/showtimes`),
  getShowtime: (id: string) => request<Showtime & { movie_title: string }>(`/api/showtimes/${id}`),
  getSeatMap: (showtimeId: string) => request<Seat[]>(`/api/showtimes/${showtimeId}/seats`),

  holdSeat: (showtimeId: string, seatId: string, phone: string) =>
    request<HoldResponse>(`/api/showtimes/${showtimeId}/seats/${seatId}/hold`, {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  getBooking: (ref: string) => request<Booking>(`/api/bookings/${ref}`),

  sendOtp: (ref: string) => request<{ otpRef: string }>(`/api/bookings/${ref}/otp/send`, { method: 'POST' }),

  verifyOtp: (ref: string, code: string) =>
    request<{ verified: boolean; message?: string }>(`/api/bookings/${ref}/otp/verify`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  pay: (ref: string) =>
    request<{ paymentId: string; status: string }>(`/api/bookings/${ref}/pay`, { method: 'POST' }),
};
