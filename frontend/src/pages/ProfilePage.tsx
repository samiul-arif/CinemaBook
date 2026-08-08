import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, UserBooking, UserTicket } from '../api/client';

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [bData, tData] = await Promise.all([
          api.getMyBookings().catch(() => []),
          api.getMyTickets().catch(() => []),
        ]);
        setBookings(bData);
        setTickets(tData);
      } catch (err) {
        console.error('Failed to load profile stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (!user) return null;

  const formattedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Member';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Profile Banner */}
      <div className="relative glass-panel rounded-3xl p-6 sm:p-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar Circle */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-primary via-primaryDark to-accent flex items-center justify-center text-white text-3xl sm:text-4xl font-extrabold shadow-xl shadow-primary/20 shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-textPrimary tracking-tight">
                  {user.name}
                </h1>
                <p className="text-sm text-textSecondary font-medium">CinemaSeat Account</p>
              </div>

              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-xl bg-error/10 hover:bg-error/20 text-error border border-error/20 text-xs font-bold transition-all flex items-center justify-center gap-2 self-center sm:self-start"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>

            <div className="pt-3 border-t border-borderLight/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-textSecondary">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="truncate">{user.email}</span>
              </div>

              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>{user.phone}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Account Stats & Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between rx-lift">
          <div>
            <p className="text-xs uppercase tracking-wider text-textTertiary font-semibold mb-1">Total Bookings</p>
            <p className="text-3xl font-extrabold text-textPrimary">
              {loading ? '...' : bookings.length}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between rx-lift">
          <div>
            <p className="text-xs uppercase tracking-wider text-textTertiary font-semibold mb-1">Active E-Tickets</p>
            <p className="text-3xl font-extrabold text-success">
              {loading ? '...' : tickets.length}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-success/10 border border-success/30 flex items-center justify-center text-success">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Quick Access Menu */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-textPrimary">Quick Access</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/my-bookings"
            className="glass-panel p-5 rounded-2xl flex items-center gap-4 hover:border-primary/50 transition-all rx-lift group"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-textPrimary text-base">My Bookings</h4>
              <p className="text-xs text-textTertiary">View complete history of active and completed seat holds</p>
            </div>
          </Link>

          <Link
            to="/my-tickets"
            className="glass-panel p-5 rounded-2xl flex items-center gap-4 hover:border-success/50 transition-all rx-lift group"
          >
            <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-textPrimary text-base">My E-Tickets</h4>
              <p className="text-xs text-textTertiary">Instant access to verified QR code tickets for gate entry</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};
