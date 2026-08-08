import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, Movie, Showtime } from '../api/client';
import { Card } from '../components/ui/Card';

export function ShowtimesPage() {
  const { movieId } = useParams<{ movieId: string }>();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [showtimes, setShowtimes] = useState<Showtime[] | null>(null);

  useEffect(() => {
    if (!movieId) return;
    api.getMovie(movieId).then(setMovie);
    api.listShowtimes(movieId).then(setShowtimes);
  }, [movieId]);

  if (!movie || !showtimes) {
    return (
      <div className="space-y-6">
        <div className="h-64 rounded-2xl bg-surfaceVariant animate-pulse" />
        <div className="h-32 rounded-2xl bg-surfaceVariant animate-pulse" />
      </div>
    );
  }

  const byTheatre = showtimes.reduce<Record<string, Showtime[]>>((acc, s) => {
    const key = `${s.theatre_name} · ${s.theatre_city}`;
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {/* Navigation Back */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-xs font-medium text-textSecondary hover:text-primary transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Movies Catalog
      </Link>

      {/* Movie Details Hero Banner */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-col md:flex-row gap-5 p-5 items-center md:items-start">
          <img
            src={movie.poster_url}
            alt={movie.title}
            className="w-28 sm:w-32 md:w-36 aspect-[2/3] object-cover rounded-xl shadow-md border border-borderLight"
          />
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-3">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primaryLight text-primaryDark">
                {movie.genre}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-surfaceVariant text-textSecondary">
                {movie.language}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-surfaceVariant text-textSecondary">
                {movie.duration_min} Minutes
              </span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl text-textPrimary tracking-wide mb-3">
              {movie.title}
            </h1>

            <p className="text-textSecondary text-sm leading-relaxed max-w-2xl">
              {movie.description}
            </p>
          </div>
        </div>
      </Card>

      {/* Showtimes by Theatre */}
      <div>
        <h2 className="text-lg font-semibold text-textPrimary mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 002-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Select Showtime & Location
        </h2>

        {Object.entries(byTheatre).length === 0 ? (
          <Card className="p-8 text-center text-textSecondary">
            No showtimes currently available for this movie.
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(byTheatre).map(([theatre, shows]) => (
              <Card key={theatre} className="p-5">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-borderLight/60">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <h3 className="font-semibold text-base text-textPrimary">{theatre}</h3>
                </div>

                <div className="flex flex-wrap gap-3">
                  {shows.map((s) => (
                    <Link
                      key={s.id}
                      to={`/showtimes/${s.id}`}
                      className="rx-lift group relative flex items-center gap-3 px-4 py-3 rounded-xl border border-borderLight bg-surface hover:border-primary/50 transition-colors"
                    >
                      <div>
                        <div className="text-sm font-semibold text-textPrimary group-hover:text-primary transition-colors">
                          {new Date(s.start_time).toLocaleString(undefined, {
                            weekday: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div className="text-[11px] text-textTertiary mt-0.5">
                          {s.screen_name}
                        </div>
                      </div>

                      <div className="pl-3 border-l border-borderLight text-xs text-primary font-medium flex items-center gap-1">
                        <span>Select Seats</span>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
