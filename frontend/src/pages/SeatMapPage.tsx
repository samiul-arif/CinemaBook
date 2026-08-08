import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api, ApiRequestError, Seat } from '../api/client';
import { Card } from '../components/ui/Card';
import { Seat as SeatComponent, SeatLegend, SeatVariant } from '../components/ui/Seat';

const ROW_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export function SeatMapPage() {
  const { showtimeId } = useParams<{ showtimeId: string }>();
  const navigate = useNavigate();
  const [seats, setSeats] = useState<Seat[] | null>(null);
  const [showtime, setShowtime] = useState<any>(null);
  const [selected, setSelected] = useState<Seat | null>(null);
  const [phone, setPhone] = useState('');
  const [holding, setHolding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!showtimeId) return;
    api.getSeatMap(showtimeId).then(setSeats).catch(() => {});
  }, [showtimeId]);

  useEffect(() => {
    if (!showtimeId) return;
    api.getShowtime(showtimeId).then(setShowtime);
    refresh();
    const interval = setInterval(refresh, 3000); // Live seat polling
    return () => clearInterval(interval);
  }, [showtimeId, refresh]);

  if (!seats || !showtime) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-surfaceVariant animate-pulse rounded-lg" />
        <div className="h-96 rounded-2xl bg-surfaceVariant animate-pulse" />
      </div>
    );
  }

  const rows = ROW_ORDER.filter((r) => seats.some((s) => s.seat_row === r));

  async function handleHold() {
    if (!showtimeId || !selected) return;
    if (!/^\+?\d{10,14}$/.test(phone.trim())) {
      setError('Please enter a valid phone number, e.g. +8801700000000');
      return;
    }
    setHolding(true);
    setError(null);
    try {
      const res = await api.holdSeat(showtimeId, selected.id, phone.trim());
      navigate(`/bookings/${res.booking_ref}`);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 409) {
        setError('Someone else just reserved that seat! Please pick another.');
        refresh();
        setSelected(null);
      } else {
        setError((e as Error).message);
      }
    } finally {
      setHolding(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to={showtime.movie_id ? `/movies/${showtime.movie_id}` : '/'}
        className="inline-flex items-center gap-2 text-xs font-medium text-textSecondary hover:text-primary transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Showtimes
      </Link>

      {/* Showtime Title Banner */}
      <div>
        <h1 className="font-display text-4xl text-textPrimary tracking-wide mb-1">
          {showtime.movie_title}
        </h1>
        <p className="text-textSecondary text-sm flex flex-wrap items-center gap-2">
          <span>{showtime.theatre_name}, {showtime.theatre_city}</span>
          <span>•</span>
          <span className="font-medium text-primary">{showtime.screen_name}</span>
          <span>•</span>
          <span>{new Date(showtime.start_time).toLocaleString()}</span>
        </p>
      </div>

      {/* Main Seat Map Interactive Card */}
      <Card className="overflow-hidden p-6 sm:p-8">
        {/* Cinema Screen Graphic Header */}
        <div className="text-center mb-10">
          <div className="mx-auto h-2 w-3/4 max-w-md rounded-full bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_15px_rgb(var(--color-primary))] opacity-80" />
          <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-textTertiary mt-3">
            SCREEN THIS WAY
          </p>
        </div>

        {/* Seats Grid */}
        <div className="flex flex-col items-center gap-2.5 overflow-x-auto py-2">
          {rows.map((row) => (
            <div key={row} className="flex items-center gap-3">
              <span className="w-5 text-xs font-mono text-textTertiary text-right">{row}</span>
              <div className="flex gap-2">
                {seats
                  .filter((s) => s.seat_row === row)
                  .sort((a, b) => a.seat_col - b.seat_col)
                  .map((s) => {
                    const isSelected = selected?.id === s.id;
                    const disabled = s.status !== 'AVAILABLE';
                    
                    let variant: SeatVariant = 'standard';
                    if (disabled) {
                      variant = 'booked';
                    } else if (isSelected) {
                      variant = 'selected';
                    } else if (s.seat_type === 'RECLINER') {
                      variant = 'recliner';
                    } else if (s.seat_type === 'PREMIUM') {
                      variant = 'premium';
                    }

                    return (
                      <SeatComponent
                        key={s.id}
                        disabled={disabled}
                        onClick={() => setSelected(s)}
                        title={`${s.seat_label} · ${s.seat_type} · ৳${s.price}`}
                        variant={variant}
                        label={s.seat_col}
                      />
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 sm:gap-6 justify-center mt-10 pt-6 border-t border-borderLight/60 text-xs text-textSecondary">
          <SeatLegend variant="standard" label="Standard (৳350)" />
          <SeatLegend variant="premium" label="Premium (৳450)" />
          <SeatLegend variant="recliner" label="Recliner (৳650)" />
          <SeatLegend variant="booked" label="Held / Booked" />
          <SeatLegend variant="selected" label="Your Choice" />
        </div>
      </Card>

      {/* Selected Seat Hold Drawer */}
      {selected && (
        <Card className="border-primary/50 bg-primaryLight/30 backdrop-blur-md p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider text-textTertiary font-mono">Selected Seat</span>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl text-textPrimary">{selected.seat_label}</span>
              <span className="text-sm font-semibold text-primary">৳{selected.price}</span>
              <span className="text-xs text-textSecondary uppercase font-mono">({selected.seat_type})</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <input
              type="tel"
              placeholder="+8801700000000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-card border border-borderLight rounded-xl px-4 py-2.5 text-sm w-full sm:w-60 outline-none focus:border-primary text-textPrimary shadow-sm"
            />
            <button
              onClick={handleHold}
              disabled={holding}
              className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primaryDark text-white font-medium text-sm transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {holding ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Reserving...
                </>
              ) : (
                'Hold Seat (2 min)'
              )}
            </button>
          </div>
        </Card>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-errorLight border border-error/30 text-error text-sm font-medium flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}

