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
    ('The Dark Knight', 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.', 'https://picsum.photos/seed/darkknight/400/600', 152, 'English', 'Action/Drama/DC/Nolan'),
    ('Inception', 'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.', 'https://picsum.photos/seed/inception/400/600', 148, 'English', 'Sci-Fi/Action/Nolan'),
    ('Interstellar', 'When Earth becomes uninhabitable, a team of explorers travels through a wormhole in space in an attempt to ensure humanity''s survival.', 'https://picsum.photos/seed/interstellar/400/600', 169, 'English', 'Sci-Fi/Drama/Nolan'),
    ('Oppenheimer', 'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.', 'https://picsum.photos/seed/oppenheimer/400/600', 180, 'English', 'Biography/Drama/Nolan'),
    ('The Batman', 'When a sadistic serial killer begins murdering key political figures in Gotham, Batman is forced to investigate the city''s hidden corruption.', 'https://picsum.photos/seed/thebatman/400/600', 176, 'English', 'Action/Crime/DC'),
    ('Joker: Folie à Deux', 'Failed comedian Arthur Fleck meets the love of his life, Harley Quinn, while incarcerated at Arkham State Hospital.', 'https://picsum.photos/seed/joker2/400/600', 138, 'English', 'Drama/Crime/DC'),
    ('Avengers: Doomsday', 'The Avengers confront the threat of Doctor Doom in a multiversal clash.', 'https://picsum.photos/seed/avengersdoomsday/400/600', 150, 'English', 'Action/Sci-Fi/Marvel'),
    ('Spider-Man: Brand New Day', 'The midnight premiere everyone is fighting for.', 'https://picsum.photos/seed/spiderman/400/600', 148, 'English', 'Action/Sci-Fi/Marvel'),
    ('Iron Man 3', 'When Tony Stark''s world is torn apart by a formidable terrorist called the Mandarin, he starts an odyssey of rebuild and retribution.', 'https://picsum.photos/seed/ironman3/400/600', 130, 'English', 'Action/Sci-Fi/Marvel'),
    ('Dune: Part Three', 'The Bene Gesserit conspiracy reaches Arrakis.', 'https://picsum.photos/seed/dune3/400/600', 165, 'English', 'Sci-Fi')
    RETURNING id, title
  `);

  console.log('[seed] inserting theatres...');
  const theatres = await pool.query(`
    INSERT INTO theatres (name, city, address) VALUES
    ('Star Cineplex (Bashundhara City)', 'Dhaka', 'Bashundhara City, Dhaka'),
    ('Star Cineplex (Shimanto Square)', 'Dhaka', 'Dhanmondi, Dhaka'),
    ('Silver Screen Cineplex', 'Chattogram', 'GEC Circle, Chattogram'),
    ('Grand Sylhet Cineplex', 'Sylhet', 'Airport Road, Sylhet'),
    ('Liberty Plaza Cinema', 'Khulna', 'Jail Road, Khulna'),
    ('Moyurakshi Cineplex', 'Rajshahi', 'Rajshahi Sadar, Rajshahi')
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
