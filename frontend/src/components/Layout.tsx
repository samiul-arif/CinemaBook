import { Link, Outlet } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { Background } from './ui/Background';

export function Layout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col relative text-textPrimary selection:bg-primary selection:text-white transition-colors duration-200">
      <Background />

      {/* Header Panel */}
      <header className="glass-panel sticky top-0 z-30 transition-all duration-200">
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z" />
              </svg>
            </div>
            <div>
              <span className="font-display text-2xl tracking-wider text-textPrimary">
                CINEMA<span className="text-primary font-bold ml-0.5">SEAT</span>
              </span>
              <span className="hidden sm:inline-block text-[10px] uppercase tracking-[0.2em] text-textTertiary ml-3 pl-3 border-l border-borderLight">
                Zero-Concurrency Overbooking
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-xl border border-borderLight bg-surface hover:bg-surfaceVariant text-textSecondary hover:text-textPrimary transition-colors flex items-center gap-2 text-xs font-medium"
            >
              {theme === 'dark' ? (
                <>
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="hidden sm:inline">Light Mode</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  <span className="hidden sm:inline">Dark Mode</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-5 py-10 relative z-10">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-borderLight/60 py-8 text-center text-xs text-textTertiary relative z-10 bg-surface/30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row justify-between items-center gap-3">
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
