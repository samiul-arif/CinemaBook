import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Movie } from '../api/client';
import { Card } from '../components/ui/Card';

export function MoviesPage() {
  const [movies, setMovies] = useState<Movie[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listMovies().then(setMovies).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <Card className="border-error/40 bg-errorLight text-error p-6 max-w-lg mx-auto text-center">
        <p className="font-semibold text-lg mb-1">Unable to Load Movies</p>
        <p className="text-sm opacity-90">{error}</p>
      </Card>
    );
  }

  if (!movies) {
    return (
      <div>
        <div className="mb-8">
          <div className="h-8 w-48 bg-surfaceVariant animate-pulse rounded-lg mb-2" />
          <div className="h-4 w-72 bg-surfaceVariant animate-pulse rounded-md" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="rounded-2xl border border-borderLight bg-card p-3 h-80 animate-pulse">
              <div className="w-full aspect-[2/3] bg-surfaceVariant rounded-xl mb-3" />
              <div className="h-4 w-3/4 bg-surfaceVariant rounded mb-2" />
              <div className="h-3 w-1/2 bg-surfaceVariant rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primaryLight border border-primary/20 text-primaryDark text-xs font-medium mb-3">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Live Premiere Catalog
          </div>
          <h1 className="font-display text-4xl sm:text-5xl text-textPrimary tracking-wide">
            Now Showing
          </h1>
          <p className="text-textSecondary text-sm sm:text-base mt-1 max-w-xl">
            Select a movie to explore available showtimes. Seats are locked in real-time with zero risk of double booking.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-textTertiary font-mono">
          <span className="px-2.5 py-1 rounded-md bg-surface border border-borderLight">
            {movies.length} Premieres Available
          </span>
        </div>
      </div>

      {/* Movie Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {movies.map((m) => (
          <Card
            key={m.id}
            interactive
            padding="none"
            className="group overflow-hidden flex flex-col justify-between border-borderLight"
          >
            {/* Click-target Stretched Overlay */}
            <Link
              to={`/movies/${m.id}`}
              className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={`Select ${m.title}`}
            />

            <div>
              {/* Poster Image Container */}
              <div className="relative aspect-[2/3] overflow-hidden bg-surface rounded-t-2xl">
                <img
                  src={m.poster_url}
                  alt={m.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
                
                {/* Genre Badge */}
                {m.genre && (
                  <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-medium bg-black/60 backdrop-blur-md text-white border border-white/20">
                    {m.genre}
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="p-4">
                <h2 className="font-semibold text-base text-textPrimary group-hover:text-primary transition-colors leading-snug">
                  {m.title}
                </h2>
                <div className="flex items-center gap-2 text-xs text-textSecondary mt-2">
                  <span className="px-2 py-0.5 rounded bg-surfaceVariant font-medium">
                    {m.language}
                  </span>
                  <span>•</span>
                  <span>{m.duration_min} min</span>
                </div>
              </div>
            </div>

            {/* Bottom Action Footer */}
            <div className="p-4 pt-0 flex items-center justify-between text-xs text-primary font-medium group-hover:translate-x-1 transition-transform">
              <span>View Showtimes</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
