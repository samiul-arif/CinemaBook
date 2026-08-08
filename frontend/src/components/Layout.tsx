import { Link, Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-marquee-line/60 bg-marquee-bg/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-marquee-crimson" />
            <span className="font-display text-2xl tracking-wider">
              CINEMA<span className="text-marquee-gold">SEAT</span>
            </span>
          </Link>
          <span className="text-xs uppercase tracking-[0.2em] text-white/40">
            One seat. One buyer. Every time.
          </span>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-5 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-marquee-line/60 py-6 text-center text-xs text-white/30">
        CinemaSeat — built for Zero to Production, IEEE CS CUET × Poridhi.io
      </footer>
    </div>
  );
}
