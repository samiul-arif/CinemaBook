import { pool } from '../db/pool';
import { ApiError } from '../middleware/errorHandler';

export async function listMovies() {
  const { rows } = await pool.query(
    `SELECT id, title, description, poster_url, duration_min, language, genre FROM movies ORDER BY title`
  );
  return rows;
}

export async function getMovie(id: string) {
  const { rows } = await pool.query(`SELECT * FROM movies WHERE id = $1`, [id]);
  if (rows.length === 0) throw new ApiError(404, 'MOVIE_NOT_FOUND', 'Movie not found');
  return rows[0];
}

export async function listShowtimesForMovie(movieId: string) {
  const { rows } = await pool.query(
    `SELECT s.id, s.movie_id, s.theatre_id, s.screen_name, s.start_time, s.base_price,
            t.name AS theatre_name, t.city AS theatre_city
     FROM showtimes s
     JOIN theatres t ON t.id = s.theatre_id
     WHERE s.movie_id = $1
     ORDER BY s.start_time`,
    [movieId]
  );
  return rows;
}

export async function getShowtime(id: string) {
  const { rows } = await pool.query(
    `SELECT s.*, m.title AS movie_title, t.name AS theatre_name, t.city AS theatre_city
     FROM showtimes s
     JOIN movies m ON m.id = s.movie_id
     JOIN theatres t ON t.id = s.theatre_id
     WHERE s.id = $1`,
    [id]
  );
  if (rows.length === 0) throw new ApiError(404, 'SHOWTIME_NOT_FOUND', 'Showtime not found');
  return rows[0];
}

export async function listTheatres() {
  const { rows } = await pool.query(`SELECT * FROM theatres ORDER BY city, name`);
  return rows;
}
