import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Movie } from '../api/client';

export function MoviesPage() {
  const [movies, setMovies] = useState<Movie[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listMovies().then(setMovies).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-marquee-crimson">Could not load movies: {error}</p>;
  if (!movies) return <p className="text-white/50">Loading now showing...</p>;

  return (
    <div>
      <h1 className="font-display text-4xl mb-1">Now Showing</h1>
      <p className="text-white/50 mb-8">Pick a title. Seats go fast on premiere night.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
        {movies.map((m) => (
          <Link
            key={m.id}
            to={`/movies/${m.id}`}
            className="group rounded-lg overflow-hidden border border-marquee-line bg-marquee-panel hover:border-marquee-gold/60 transition-colors"
          >
            <img src={m.poster_url} alt={m.title} className="w-full aspect-[2/3] object-cover" />
            <div className="p-3">
              <h2 className="font-medium leading-tight group-hover:text-marquee-gold transition-colors">
                {m.title}
              </h2>
              <p className="text-xs text-white/40 mt-1">
                {m.language} · {m.duration_min} min
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
