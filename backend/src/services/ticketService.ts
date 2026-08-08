import { pool } from '../db/pool';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

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

export async function generateTicket(bookingRef: string): Promise<DetailedTicket> {
  const { rows } = await pool.query(
    `SELECT
       b.id AS booking_id,
       b.booking_ref,
       b.phone,
       b.amount,
       b.currency,
       b.status,
       b.created_at AS booking_created_at,
       b.ticket_generated,
       b.qr_payload,
       b.pdf_url,
       s.start_time,
       s.screen_name,
       m.title AS movie_title,
       m.genre AS movie_genre,
       m.duration_min AS movie_duration_min,
       m.language AS movie_language,
       m.poster_url AS movie_poster_url,
       t.name AS theatre_name,
       t.city AS theatre_city,
       st.seat_label,
       st.seat_row,
       st.seat_col,
       st.seat_type,
       st.price AS seat_price
     FROM bookings b
     JOIN showtimes s ON b.showtime_id = s.id
     JOIN movies m ON s.movie_id = m.id
     JOIN theatres t ON s.theatre_id = t.id
     JOIN seats st ON b.seat_id = st.id
     WHERE b.booking_ref = $1`,
    [bookingRef]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
  }

  const row = rows[0];

  if (row.status !== 'CONFIRMED') {
    throw new ApiError(400, 'PAYMENT_REQUIRED', 'Ticket can only be generated for confirmed bookings');
  }

  // QR Code contains booking_ref, seat, and phone
  const qrPayload = JSON.stringify({
    ref: row.booking_ref,
    seat: row.seat_label,
    phone: row.phone
  });
  const pdfUrl = `/tickets/${row.booking_ref}.pdf`;

  await pool.query(
    `UPDATE bookings
     SET ticket_generated = TRUE,
         qr_payload = $1,
         pdf_url = $2,
         updated_at = now()
     WHERE booking_ref = $3`,
    [qrPayload, pdfUrl, bookingRef]
  );

  logger.info('e-ticket generated', { bookingRef });

  return {
    booking_ref: row.booking_ref,
    movie: {
      title: row.movie_title,
      genre: row.movie_genre || 'Action / Sci-Fi',
      duration_min: row.movie_duration_min || 148,
      language: row.movie_language || 'English',
      poster_url: row.movie_poster_url || '',
    },
    theatre: {
      name: row.theatre_name,
      city: row.theatre_city,
      screen_name: row.screen_name,
    },
    showtime: {
      start_time: row.start_time,
    },
    seat: {
      seat_label: row.seat_label,
      seat_row: row.seat_row,
      seat_col: row.seat_col,
      seat_type: row.seat_type,
      price: row.seat_price,
    },
    user: {
      phone: row.phone,
    },
    booking: {
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      created_at: row.booking_created_at,
      ticket_generated: true,
      qr_payload: qrPayload,
      pdf_url: pdfUrl,
    },
  };
}
