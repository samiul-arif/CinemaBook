import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiRequestError, Booking } from '../api/client';

function useCountdown(target: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!target) return 0;
  return Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000));
}

export function BookingPage() {
  const { bookingRef } = useParams<{ bookingRef: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const secondsLeft = useCountdown(booking?.hold_expires_at ?? null);

  useEffect(() => {
    if (!bookingRef) return;
    const load = () => api.getBooking(bookingRef).then(setBooking).catch(() => {});
    load();
    const id = setInterval(load, 2500);
    return () => clearInterval(id);
  }, [bookingRef]);

  const step = useMemo(() => {
    if (!booking) return 0;
    if (booking.status === 'CONFIRMED') return 4;
    if (booking.status === 'PAYMENT_PENDING') return 3;
    if (booking.status === 'OTP_VERIFIED') return 3;
    if (booking.status === 'HOLD') return 1;
    return -1; // EXPIRED / FAILED
  }, [booking]);

  if (!booking) return <p className="text-white/50">Loading booking...</p>;

  const expired = booking.status === 'EXPIRED';
  const failed = booking.status === 'FAILED';

  async function handleSendOtp() {
    if (!bookingRef) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.sendOtp(bookingRef);
      setOtpSent(true);
      setMessage('Code sent. It can take a few seconds to arrive.');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp() {
    if (!bookingRef) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.verifyOtp(bookingRef, otpCode);
      if (!res.verified) {
        setMessage('That code did not match. Try again or resend.');
      } else {
        const fresh = await api.getBooking(bookingRef);
        setBooking(fresh);
      }
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 410) {
        setMessage('Your hold expired while waiting for the code.');
      } else {
        setMessage((e as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handlePay() {
    if (!bookingRef) return;
    setPaying(true);
    setMessage(null);
    try {
      await api.pay(bookingRef);
      setMessage('Payment submitted. Waiting for the gateway to confirm...');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="font-display text-3xl mb-1">Booking {bookingRef}</h1>
      <p className="text-white/40 text-sm mb-8">৳{booking.amount} · {booking.phone}</p>

      <Steps step={step} />

      {expired && (
        <Notice tone="crimson">
          This hold expired before checkout finished. <Link to="/" className="underline">Browse movies</Link> to pick a seat again.
        </Notice>
      )}

      {failed && (
        <Notice tone="crimson">
          Payment failed. The seat has been released back to the seat map. You're welcome to try again with a new hold.
        </Notice>
      )}

      {booking.status === 'HOLD' && (
        <div className="bg-marquee-panel border border-marquee-line rounded-xl p-5">
          <p className="text-sm text-white/60 mb-4">
            Hold expires in <span className="text-marquee-gold font-medium">{secondsLeft}s</span>. Verify your phone to continue.
          </p>
          {!otpSent ? (
            <button
              onClick={handleSendOtp}
              disabled={busy || secondsLeft === 0}
              className="px-5 py-2 rounded-md bg-marquee-crimson hover:bg-marquee-crimson/80 disabled:opacity-50 text-sm font-medium"
            >
              {busy ? 'Sending...' : 'Send OTP'}
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="123456"
                className="bg-marquee-bg border border-marquee-line rounded-md px-3 py-2 text-sm w-32 outline-none focus:border-marquee-gold"
              />
              <button
                onClick={handleVerifyOtp}
                disabled={busy || secondsLeft === 0}
                className="px-4 py-2 rounded-md bg-marquee-gold text-marquee-bg font-medium text-sm disabled:opacity-50"
              >
                Verify
              </button>
              <button
                onClick={handleSendOtp}
                disabled={busy}
                className="px-3 py-2 rounded-md border border-marquee-line text-sm text-white/60 hover:text-white"
              >
                Resend
              </button>
            </div>
          )}
        </div>
      )}

      {booking.status === 'OTP_VERIFIED' && (
        <div className="bg-marquee-panel border border-marquee-line rounded-xl p-5">
          <p className="text-sm text-white/60 mb-4">Phone verified. Complete payment to confirm your seat.</p>
          <button
            onClick={handlePay}
            disabled={paying}
            className="px-5 py-2 rounded-md bg-marquee-crimson hover:bg-marquee-crimson/80 disabled:opacity-50 text-sm font-medium"
          >
            {paying ? 'Submitting...' : `Pay ৳${booking.amount}`}
          </button>
        </div>
      )}

      {booking.status === 'PAYMENT_PENDING' && (
        <div className="bg-marquee-panel border border-marquee-line rounded-xl p-5 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-marquee-gold animate-pulse" />
          <p className="text-sm text-white/60">
            Waiting on the payment gateway. This can take a few seconds — we'll update automatically.
          </p>
        </div>
      )}

      {booking.status === 'CONFIRMED' && (
        <Notice tone="mint">
          🎟 Booking confirmed! Seat locked in for good. Show this reference at the counter:{' '}
          <span className="font-mono text-marquee-gold">{bookingRef}</span>
        </Notice>
      )}

      {message && <p className="text-sm text-white/50 mt-4">{message}</p>}
    </div>
  );
}

function Steps({ step }: { step: number }) {
  const labels = ['Hold', 'Verify', 'Pay', 'Confirmed'];
  return (
    <div className="flex items-center gap-2 mb-6 text-xs">
      {labels.map((l, i) => (
        <div key={l} className="flex items-center gap-2">
          <div
            className={[
              'w-6 h-6 rounded-full flex items-center justify-center border',
              i < step
                ? 'bg-marquee-gold border-marquee-gold text-marquee-bg'
                : i === step
                ? 'border-marquee-gold text-marquee-gold'
                : 'border-white/15 text-white/30',
            ].join(' ')}
          >
            {i + 1}
          </div>
          <span className={i <= step ? 'text-white/70' : 'text-white/30'}>{l}</span>
          {i < labels.length - 1 && <span className="w-6 h-px bg-white/15 mx-1" />}
        </div>
      ))}
    </div>
  );
}

function Notice({ tone, children }: { tone: 'crimson' | 'mint'; children: React.ReactNode }) {
  const cls =
    tone === 'crimson'
      ? 'border-marquee-crimson/40 bg-marquee-crimson/10 text-marquee-crimson'
      : 'border-marquee-mint/40 bg-marquee-mint/10 text-marquee-mint';
  return <div className={`border rounded-xl p-4 text-sm mb-4 ${cls}`}>{children}</div>;
}
