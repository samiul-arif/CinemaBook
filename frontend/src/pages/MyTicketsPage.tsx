import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, UserTicket } from '../api/client';

export const MyTicketsPage: React.FC = () => {
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTickets() {
      try {
        const data = await api.getMyTickets();
        setTickets(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch tickets');
      } finally {
        setLoading(false);
      }
    }
    loadTickets();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-success/30 border-t-success rounded-full animate-spin" />
        <p className="text-sm text-textTertiary font-medium">Loading digital tickets...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-textPrimary tracking-tight">My Digital E-Tickets</h1>
          <p className="text-sm text-textSecondary">
            Your active confirmed showtime tickets with gate check-in QR codes.
          </p>
        </div>
        <Link
          to="/"
          className="px-4 py-2.5 rounded-xl bg-surface hover:bg-surfaceVariant border border-borderLight text-textPrimary font-semibold text-xs transition-colors self-start sm:self-auto"
        >
          + Book More Seats
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-errorLight text-error border border-error/20 text-sm">
          {error}
        </div>
      )}

      {tickets.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-success/10 text-success mx-auto flex items-center justify-center">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-textPrimary">No Active E-Tickets</h3>
          <p className="text-sm text-textSecondary max-w-md mx-auto">
            You don't have any confirmed digital tickets yet. Complete a seat booking to generate your printable E-Ticket!
          </p>
          <Link
            to="/"
            className="inline-block px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primaryDark transition-colors"
          >
            Find a Showtime
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tickets.map((t) => {
            const showtimeDate = t.start_time
              ? new Date(t.start_time).toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : 'N/A';

            return (
              <div
                key={t.id}
                className="glass-panel rounded-3xl overflow-hidden border border-success/30 shadow-xl flex flex-col justify-between rx-lift"
              >
                {/* Header Strip */}
                <div className="bg-gradient-to-r from-success to-emerald-600 px-6 py-3 text-white flex items-center justify-between">
                  <span className="font-mono text-xs font-bold tracking-wider">REF: #{t.booking_ref}</span>
                  <span className="text-[10px] uppercase font-extrabold tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full">
                    ADMIT ONE
                  </span>
                </div>

                <div className="p-6 space-y-5 flex-1">
                  <div className="flex gap-4">
                    {t.poster_url ? (
                      <img
                        src={t.poster_url}
                        alt={t.movie_title}
                        className="w-20 h-28 object-cover rounded-xl border border-borderLight shrink-0 shadow-md"
                      />
                    ) : (
                      <div className="w-20 h-28 rounded-xl bg-surface border border-borderLight flex items-center justify-center text-2xl shrink-0">
                        🎬
                      </div>
                    )}

                    <div className="space-y-1 flex-1">
                      <h3 className="text-xl font-extrabold text-textPrimary leading-tight">
                        {t.movie_title}
                      </h3>
                      <p className="text-xs text-textSecondary font-medium">
                        {t.theatre_name} • {t.screen_name}
                      </p>
                      <p className="text-xs text-textTertiary flex items-center gap-1.5 pt-1">
                        <svg className="w-3.5 h-3.5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {showtimeDate}
                      </p>
                    </div>
                  </div>

                  {/* Seat Grid Box */}
                  <div className="bg-surface p-4 rounded-2xl border border-borderLight flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-textTertiary font-bold block">Assigned Seat</span>
                      <span className="text-2xl font-extrabold text-primary">{t.seat_label}</span>
                      <span className="text-xs text-textTertiary ml-2">({t.seat_type})</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-textTertiary font-bold block">Paid Amount</span>
                      <span className="text-lg font-bold text-textPrimary">{t.currency || 'BDT'} {t.amount}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="px-6 py-4 bg-surface/50 border-t border-borderLight/60 flex items-center justify-between">
                  <span className="text-xs text-success font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    Valid Gate Ticket
                  </span>

                  <Link
                    to={`/bookings/${t.booking_ref}`}
                    className="px-4 py-2 rounded-xl bg-success text-white font-bold text-xs hover:bg-success/90 shadow-md shadow-success/20 transition-all flex items-center gap-1.5"
                  >
                    <span>View / Print E-Ticket</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
