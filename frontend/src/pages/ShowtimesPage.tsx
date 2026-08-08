import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, Movie, Showtime } from '../api/client';

export function ShowtimesPage() {
  const { movieId } = useParams<{ movieId: string }>();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [showtimes, setShowtimes] = useState<Showtime[] | null>(null);

  useEffect(() => {
    if (!movieId) return;
    api.getMovie(movieId).then(setMovie);
    api.listShowtimes(movieId).then(setShowtimes);
  }, [movieId]);

  if (!movie || !showtimes) return <p className="text-white/50">Loading showtimes...</p>;

  const byTheatre = showtimes.reduce<Record<string, Showtime[]>>((acc, s) => {
    const key = `${s.theatre_name} · ${s.theatre_city}`;
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex gap-6 mb-8">
        <img src={movie.poster_url} alt={movie.title} className="w-32 rounded-lg border border-marquee-line" />
        <div>
          <h1 className="font-display text-4xl mb-1">{movie.title}</h1>
          <p className="text-white/50 text-sm mb-3">
            {movie.genre} · {movie.language} · {movie.duration_min} min
          </p>
          <p className="text-white/70 max-w-xl">{movie.description}</p>
        </div>
      </div>

      {Object.entries(byTheatre).map(([theatre, shows]) => (
        <div key={theatre} className="mb-6">
          <h3 className="text-marquee-gold font-medium mb-2">{theatre}</h3>
          <div className="flex flex-wrap gap-2">
            {shows.map((s) => (
              <Link
                key={s.id}
                to={`/showtimes/${s.id}`}
                className="px-4 py-2 rounded-md border border-marquee-line bg-marquee-panel hover:border-marquee-gold hover:text-marquee-gold transition-colors text-sm"
              >
                {new Date(s.start_time).toLocaleString(undefined, {
                  weekday: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                <span className="text-white/40 ml-2">{s.screen_name}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
