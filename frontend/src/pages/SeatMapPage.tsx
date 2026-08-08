import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiRequestError, Seat } from '../api/client';

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
    const interval = setInterval(refresh, 3000); // live-ish seat map
    return () => clearInterval(interval);
  }, [showtimeId, refresh]);

  if (!seats || !showtime) return <p className="text-white/50">Loading seat map...</p>;

  const rows = ROW_ORDER.filter((r) => seats.some((s) => s.seat_row === r));

  async function handleHold() {
    if (!showtimeId || !selected) return;
    if (!/^\+?\d{10,14}$/.test(phone)) {
      setError('Enter a valid phone number, e.g. +8801700000000');
      return;
    }
    setHolding(true);
    setError(null);
    try {
      const res = await api.holdSeat(showtimeId, selected.id, phone);
      navigate(`/bookings/${res.booking_ref}`);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 409) {
        setError('Someone else just grabbed that seat. Pick another.');
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
    <div>
      <h1 className="font-display text-3xl mb-1">{showtime.movie_title}</h1>
      <p className="text-white/50 mb-6 text-sm">
        {showtime.theatre_name}, {showtime.theatre_city} · {showtime.screen_name} ·{' '}
        {new Date(showtime.start_time).toLocaleString()}
      </p>

      <div className="bg-marquee-panel border border-marquee-line rounded-xl p-6 mb-6">
        <div className="text-center mb-8">
          <div className="mx-auto h-1.5 w-2/3 rounded-full bg-gradient-to-r from-transparent via-marquee-gold/60 to-transparent" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mt-2">Screen this way</p>
        </div>

        <div className="flex flex-col items-center gap-2">
          {rows.map((row) => (
            <div key={row} className="flex items-center gap-2">
              <span className="w-4 text-xs text-white/30">{row}</span>
              <div className="flex gap-1.5">
                {seats
                  .filter((s) => s.seat_row === row)
                  .sort((a, b) => a.seat_col - b.seat_col)
                  .map((s) => {
                    const isSelected = selected?.id === s.id;
                    const disabled = s.status !== 'AVAILABLE';
                    return (
                      <button
                        key={s.id}
                        disabled={disabled}
                        onClick={() => setSelected(s)}
                        title={`${s.seat_label} · ${s.seat_type} · ৳${s.price}`}
                        className={[
                          'seat w-7 h-7 rounded-t-md text-[10px] flex items-center justify-center border',
                          disabled
                            ? 'seat-disabled bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                            : isSelected
                            ? 'bg-marquee-gold border-marquee-gold text-marquee-bg font-semibold'
                            : s.seat_type === 'RECLINER'
                            ? 'bg-marquee-crimson/20 border-marquee-crimson/50 hover:border-marquee-crimson'
                            : s.seat_type === 'PREMIUM'
                            ? 'bg-marquee-mint/10 border-marquee-mint/40 hover:border-marquee-mint'
                            : 'bg-white/5 border-white/15 hover:border-marquee-gold',
                        ].join(' ')}
                      >
                        {s.seat_col}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-4 justify-center mt-8 text-[11px] text-white/50">
          <Legend swatch="bg-white/5 border border-white/15" label="Standard" />
          <Legend swatch="bg-marquee-mint/10 border border-marquee-mint/40" label="Premium" />
          <Legend swatch="bg-marquee-crimson/20 border border-marquee-crimson/50" label="Recliner" />
          <Legend swatch="bg-white/5 border border-white/5 opacity-40" label="Held / Booked" />
          <Legend swatch="bg-marquee-gold" label="Your pick" />
        </div>
      </div>

      {selected && (
        <div className="bg-marquee-panel border border-marquee-gold/40 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <p className="text-sm text-white/50">Selected seat</p>
            <p className="font-display text-2xl">
              {selected.seat_label} <span className="text-marquee-gold">৳{selected.price}</span>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <input
              type="tel"
              placeholder="+8801700000000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-marquee-bg border border-marquee-line rounded-md px-3 py-2 text-sm w-56 outline-none focus:border-marquee-gold"
            />
            <button
              onClick={handleHold}
              disabled={holding}
              className="px-5 py-2 rounded-md bg-marquee-crimson hover:bg-marquee-crimson/80 disabled:opacity-50 font-medium text-sm transition-colors"
            >
              {holding ? 'Holding...' : 'Hold seat'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-marquee-crimson text-sm mt-3">{error}</p>}
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}
