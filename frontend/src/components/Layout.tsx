import { useState, useRef, useEffect } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Background } from './ui/Background';

/** Mask a phone for display: +88017*****45 */
function maskPhone(phone: string): string {
  return phone.replace(/(\+?\d{5})(\d+)(\d{2})/, (_m, s, mid, e) => `${s}${'*'.repeat(mid.length)}${e}`);
}

/** Avatar initials badge */
function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
  const cls =
    size === 'md'
      ? 'w-9 h-9 rounded-xl text-sm font-extrabold'
      : 'w-7 h-7 rounded-lg text-[11px] font-extrabold';
  return (
    <div className={`${cls} bg-primary text-white flex items-center justify-center select-none`}>
      {initials}
    </div>
  );
}

export function Layout() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col relative text-textPrimary selection:bg-primary selection:text-white transition-colors duration-200">
      <Background />

      <header className="glass-panel sticky top-0 z-30 transition-all duration-200">
        <div className="max-w-7xl mx-auto px-5 py-3.5 flex items-center justify-between gap-3">

          <Link to="/" className="flex items-center gap-3 group flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z" />
              </svg>
            </div>
            <div>
              <span className="font-display text-2xl tracking-wider text-textPrimary">
                CINEMA<span className="text-primary font-bold ml-0.5">SEAT</span>
              </span>
              <span className="hidden lg:inline-block text-[10px] uppercase tracking-[0.2em] text-textTertiary ml-3 pl-3 border-l border-borderLight">
                Zero-Concurrency Overbooking
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {!isLoading && (
              <>
                {user ? (
                  <>
                    {/* Desktop pills */}
                    <nav className="hidden sm:flex items-center gap-2" aria-label="Authenticated navigation">
                      <Link
                        to="/my-bookings"
                        className="px-3 py-1.5 rounded-xl border border-borderLight bg-surface hover:bg-surfaceVariant text-textSecondary hover:text-textPrimary text-xs font-semibold transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        My Bookings
                      </Link>

                      <Link
                        to="/my-tickets"
                        className="px-3 py-1.5 rounded-xl border border-borderLight bg-surface hover:bg-surfaceVariant text-textSecondary hover:text-textPrimary text-xs font-semibold transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                        </svg>
                        My Tickets
                      </Link>

                      <Link
                        to="/profile"
                        className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-bold transition-all flex items-center gap-2"
                      >
                        <Avatar name={user.name} />
                        <span className="max-w-[100px] truncate">{user.name.split(' ')[0]}</span>
                      </Link>

                      <button
                        onClick={handleLogout}
                        title="Sign out"
                        className="p-2 rounded-xl border border-borderLight bg-surface hover:bg-surfaceVariant text-textTertiary hover:text-error transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </button>
                    </nav>

                    {/* Mobile avatar + dropdown */}
                    <div className="relative sm:hidden" ref={dropdownRef}>
                      <button
                        id="user-menu-button"
                        onClick={() => setDropdownOpen((o) => !o)}
                        aria-expanded={dropdownOpen}
                        aria-haspopup="true"
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors"
                      >
                        <Avatar name={user.name} />
                        <svg
                          className={`w-3.5 h-3.5 text-primary transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {dropdownOpen && (
                        <div
                          role="menu"
                          aria-labelledby="user-menu-button"
                          className="absolute right-0 top-full mt-2 w-56 rounded-2xl glass-panel border border-borderLight shadow-2xl shadow-black/10 overflow-hidden z-50 animate-fade-in"
                        >
                          <div className="px-4 py-3 border-b border-borderLight/60 bg-primary/5">
                            <p className="text-xs font-bold text-textPrimary truncate">{user.name}</p>
                            <p className="text-[10px] text-textTertiary font-mono truncate mt-0.5">
                              {user.phone ? maskPhone(user.phone) : user.email}
                            </p>
                          </div>

                          <div className="py-1.5">
                            <Link
                              to="/my-tickets"
                              role="menuitem"
                              onClick={() => setDropdownOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-textSecondary hover:text-textPrimary hover:bg-surfaceVariant transition-colors"
                            >
                              <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                              </svg>
                              My Tickets
                            </Link>

                            <Link
                              to="/my-bookings"
                              role="menuitem"
                              onClick={() => setDropdownOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-textSecondary hover:text-textPrimary hover:bg-surfaceVariant transition-colors"
                            >
                              <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                              My Bookings
                            </Link>

                            <Link
                              to="/profile"
                              role="menuitem"
                              onClick={() => setDropdownOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-textSecondary hover:text-textPrimary hover:bg-surfaceVariant transition-colors"
                            >
                              <svg className="w-4 h-4 text-textSecondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              Profile
                            </Link>
                          </div>

                          <div className="border-t border-borderLight/60 py-1.5">
                            <button
                              role="menuitem"
                              onClick={handleLogout}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-errorLight transition-colors"
                            >
                              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                              </svg>
                              Sign Out
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* GUEST — single Get Started CTA */
                  <Link
                    to="/login"
                    id="get-started-btn"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primaryDark text-white text-xs font-bold shadow-md shadow-primary/25 transition-all hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    Get Started
                  </Link>
                )}
              </>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-xl border border-borderLight bg-surface hover:bg-surfaceVariant text-textSecondary hover:text-textPrimary transition-colors flex items-center gap-2 text-xs font-medium ml-1"
            >
              {theme === 'dark' ? (
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-5 py-10 relative z-10">
        <Outlet />
      </main>

      <footer className="border-t border-borderLight/60 py-8 text-center text-xs text-textTertiary relative z-10 bg-surface/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-5 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p>© {new Date().getFullYear()} CinemaSeat — Built with ResourceX Design System</p>
          <div className="flex items-center gap-4 text-textSecondary">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Backend: 4000
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Gateway: 9000
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
