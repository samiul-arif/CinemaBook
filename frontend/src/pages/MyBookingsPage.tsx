import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, UserBooking } from '../api/client';

export const MyBookingsPage: React.FC = () => {
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBookings() {
      try {
        const data = await api.getMyBookings();
        setBookings(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch bookings');
      } finally {
        setLoading(false);
      }
    }
    loadBookings();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'CONFIRMED':
        return (
          <span className="px-3 py-1 rounded-full bg-successLight text-success border border-success/30 text-xs font-bold uppercase tracking-wider">
            Confirmed
          </span>
        );
      case 'HOLD':
        return (
          <span className="px-3 py-1 rounded-full bg-warningLight text-warning border border-warning/30 text-xs font-bold uppercase tracking-wider">
            Seat Held (OTP Needed)
          </span>
        );
      case 'PAYMENT_PENDING':
      case 'OTP_VERIFIED':
        return (
          <span className="px-3 py-1 rounded-full bg-primaryLight text-primary border border-primary/30 text-xs font-bold uppercase tracking-wider">
            Payment Pending
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="px-3 py-1 rounded-full bg-surfaceVariant text-textTertiary border border-borderLight text-xs font-bold uppercase tracking-wider">
            Expired
          </span>
        );
      case 'FAILED':
        return (
          <span className="px-3 py-1 rounded-full bg-errorLight text-error border border-error/30 text-xs font-bold uppercase tracking-wider">
            Failed
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full bg-surface text-textSecondary border border-borderLight text-xs font-bold uppercase tracking-wider">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-textTertiary font-medium">Loading your bookings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-textPrimary tracking-tight">My Bookings</h1>
          <p className="text-sm text-textSecondary">
            Manage your seat reservations and check booking statuses.
          </p>
        </div>
        <Link
          to="/"
          className="px-4 py-2.5 rounded-xl bg-surface hover:bg-surfaceVariant border border-borderLight text-textPrimary font-semibold text-xs transition-colors self-start sm:self-auto"
        >
          + Book Another Ticket
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-errorLight text-error border border-error/20 text-sm">
          {error}
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-textPrimary">No Bookings Found</h3>
          <p className="text-sm text-textSecondary max-w-md mx-auto">
            You haven't reserved any showtime seats yet. Browse currently playing movies and select your favorite seat!
          </p>
          <Link
            to="/"
            className="inline-block px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primaryDark transition-colors"
          >
            Explore Movies
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const isConfirmed = b.status === 'CONFIRMED' || b.ticket_generated;
            const isPending = b.status === 'HOLD' || b.status === 'OTP_VERIFIED' || b.status === 'PAYMENT_PENDING';
            const showtimeDate = b.start_time
              ? new Date(b.start_time).toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : 'N/A';

            return (
              <div
                key={b.id}
                className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between rx-lift"
              >
                {/* Left: Poster + Movie Details */}
                <div className="flex items-start sm:items-center gap-4 flex-1">
                  {b.poster_url ? (
                    <img
                      src={b.poster_url}
                      alt={b.movie_title}
                      className="w-16 h-22 object-cover rounded-xl border border-borderLight shrink-0 shadow-md"
                    />
                  ) : (
                    <div className="w-16 h-22 rounded-xl bg-surface border border-borderLight flex items-center justify-center text-textTertiary shrink-0">
                      🎬
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-textTertiary font-semibold">#{b.booking_ref}</span>
                      {getStatusBadge(b.status)}
                    </div>

                    <h3 className="text-lg font-bold text-textPrimary leading-tight">
                      {b.movie_title}
                    </h3>

                    <p className="text-xs text-textSecondary">
                      {b.theatre_name} ({b.screen_name}) • Seat <span className="font-bold text-primary">{b.seat_label}</span> ({b.seat_type})
                    </p>

                    <p className="text-xs text-textTertiary flex items-center gap-1.5 pt-0.5">
                      <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {showtimeDate}
                    </p>
                  </div>
                </div>

                {/* Right: Amount & Action */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-t-0 border-borderLight/60 gap-3 shrink-0">
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] uppercase tracking-wider text-textTertiary font-semibold">Total Price</p>
                    <p className="text-xl font-extrabold text-textPrimary">
                      {b.currency || 'BDT'} {b.amount}
                    </p>
                  </div>

                  <Link
                    to={`/bookings/${b.booking_ref}`}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 ${
                      isConfirmed
                        ? 'bg-success text-white hover:bg-success/90 shadow-success/20'
                        : isPending
                        ? 'bg-primary text-white hover:bg-primaryDark shadow-primary/20'
                        : 'bg-surface text-textSecondary hover:bg-surfaceVariant border border-borderLight'
                    }`}
                  >
                    {isConfirmed ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                        </svg>
                        <span>View E-Ticket</span>
                      </>
                    ) : isPending ? (
                      <>
                        <span>Complete Booking →</span>
                      </>
                    ) : (
                      <span>View Details</span>
                    )}
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
