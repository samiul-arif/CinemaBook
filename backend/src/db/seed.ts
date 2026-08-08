import { pool } from './pool';

const SEAT_ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const SEATS_PER_ROW = 12;

function seatType(row: string): { type: string; multiplier: number } {
  if (row === 'A' || row === 'B') return { type: 'RECLINER', multiplier: 1.8 };
  if (row === 'G' || row === 'H') return { type: 'PREMIUM', multiplier: 1.3 };
  return { type: 'STANDARD', multiplier: 1 };
}

async function seed() {
  console.log('[seed] clearing existing data...');
  await pool.query('TRUNCATE payment_events, payments, bookings, seats, showtimes, theatres, movies CASCADE');

  console.log('[seed] inserting movies...');
  const movies = await pool.query(`
    INSERT INTO movies (title, description, poster_url, duration_min, language, genre) VALUES
    ('Spider-Man: Brand New Day', 'The midnight premiere everyone is fighting for.', 'https://picsum.photos/seed/spiderman/400/600', 148, 'English', 'Action/Sci-Fi'),
    ('Priyo Bondhu', 'A Dhallywood romantic drama about friendship and distance.', 'https://picsum.photos/seed/priyobondhu/400/600', 132, 'Bangla', 'Drama'),
    ('Hawa 2', 'Sequel to the acclaimed maritime thriller.', 'https://picsum.photos/seed/hawa2/400/600', 141, 'Bangla', 'Thriller'),
    ('Dune: Part Three', 'The Bene Gesserit conspiracy reaches Arrakis.', 'https://picsum.photos/seed/dune3/400/600', 165, 'English', 'Sci-Fi')
    RETURNING id, title
  `);

  console.log('[seed] inserting theatres...');
  const theatres = await pool.query(`
    INSERT INTO theatres (name, city, address) VALUES
    ('Silver Screen Cineplex', 'Chattogram', 'GEC Circle, Chattogram'),
    ('Star Cineplex', 'Dhaka', 'Bashundhara City, Dhaka'),
    ('Blockbuster Cinemas', 'Chattogram', 'Agrabad, Chattogram')
    RETURNING id, name
  `);

  const movieIds = movies.rows.map((r) => r.id);
  const theatreIds = theatres.rows.map((r) => r.id);

  console.log('[seed] inserting showtimes + seats...');
  const now = Date.now();
  const showtimeSlots = [0, 3, 6, 26]; // hours offset from now

  for (const movieId of movieIds) {
    for (const theatreId of theatreIds) {
      for (const [i, offsetHours] of showtimeSlots.entries()) {
        const startTime = new Date(now + offsetHours * 3600 * 1000);
        const basePrice = 350 + i * 50;

        const st = await pool.query(
          `INSERT INTO showtimes (movie_id, theatre_id, screen_name, start_time, base_price)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [movieId, theatreId, `Screen ${(i % 3) + 1}`, startTime, basePrice]
        );
        const showtimeId = st.rows[0].id;

        const seatRows: any[] = [];
        for (const row of SEAT_ROWS) {
          const { type, multiplier } = seatType(row);
          for (let col = 1; col <= SEATS_PER_ROW; col++) {
            seatRows.push([
              showtimeId,
              row,
              col,
              `${row}${col}`,
              type,
              Math.round(basePrice * multiplier),
            ]);
          }
        }

        const values: string[] = [];
        const params: any[] = [];
        seatRows.forEach((r, idx) => {
          const base = idx * 6;
          values.push(
            `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`
          );
          params.push(...r);
        });

        await pool.query(
          `INSERT INTO seats (showtime_id, seat_row, seat_col, seat_label, seat_type, price)
           VALUES ${values.join(',')}`,
          params
        );
      }
    }
  }

  console.log(`[seed] done: ${movieIds.length} movies, ${theatreIds.length} theatres, ` +
    `${movieIds.length * theatreIds.length * showtimeSlots.length} showtimes seeded.`);

  await pool.end();
}

seed().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
