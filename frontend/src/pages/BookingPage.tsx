import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiRequestError, Booking, DetailedTicket } from '../api/client';
import { Card } from '../components/ui/Card';
import { TicketView } from '../components/TicketView';

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
  const [copied, setCopied] = useState(false);
  const [ticket, setTicket] = useState<DetailedTicket | null>(null);
  const [generatingTicket, setGeneratingTicket] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const secondsLeft = useCountdown(booking?.hold_expires_at ?? null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  useEffect(() => {
    if (!bookingRef) return;
    const load = () =>
      api.getBooking(bookingRef)
        .then((data) => {
          setBooking(data);
          setLoadError(null);
        })
        .catch((e) => {
          setLoadError(e.message || 'Failed to load booking');
        });
    load();
    const id = setInterval(load, 2500);
    return () => clearInterval(id);
  }, [bookingRef]);

  // Auto-show OTP input as soon as the booking loads in HOLD state.
  // The backend already sent OTP during holdSeat; we mark it as sent here
  // so the input is immediately visible (and Resend is available if needed).
  useEffect(() => {
    if (booking?.status === 'HOLD' && !otpSent) {
      setOtpSent(true);
      setMessage('OTP sent to your registered phone number.');
      setResendCooldown(30);
    }
  }, [booking?.status]);

  const step = useMemo(() => {
    if (!booking) return 0;
    if (booking.status === 'CONFIRMED') return 4;
    if (booking.status === 'PAYMENT_PENDING') return 3;
    if (booking.status === 'OTP_VERIFIED') return 3;
    if (booking.status === 'HOLD') return 1;
    return -1; // EXPIRED / FAILED
  }, [booking]);

  if (loadError) {
    return (
      <div className="max-w-lg mx-auto p-8 bg-surfaceVariant rounded-2xl text-center space-y-4">
        <h2 className="text-xl font-bold text-error">Booking Not Found</h2>
        <p className="text-sm text-textSecondary">
          This booking reference may have expired or been cleared after the database was restarted.
        </p>
        <Link to="/" className="inline-block px-6 py-2.5 rounded-xl bg-primary hover:bg-primaryDark text-white text-sm font-medium transition-colors">
          Back to Home
        </Link>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="h-8 w-48 bg-surfaceVariant animate-pulse rounded-lg" />
        <div className="h-64 bg-surfaceVariant animate-pulse rounded-2xl" />
      </div>
    );
  }

  const expired = booking.status === 'EXPIRED';
  const failed = booking.status === 'FAILED';

  async function handleSendOtp() {
    if (!bookingRef || resendCooldown > 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.sendOtp(bookingRef);
      setOtpSent(true);
      setResendCooldown(30);
      if (res.code) {
        setMessage(`Verification code sent. Code: ${res.code}`);
      } else {
        setMessage('Verification code sent. Check your logs/phone.');
      }
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
        setMessage('That code did not match. Please try again.');
      } else {
        const fresh = await api.getBooking(bookingRef);
        setBooking(fresh);
      }
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 410) {
        setMessage('Your seat hold expired before verification.');
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
      setMessage('Payment submitted. Gateway processing callback...');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setPaying(false);
    }
  }

  async function handleGenerateTicket() {
    if (!bookingRef) return;
    setGeneratingTicket(true);
    setMessage(null);
    try {
      const t = await api.generateTicket(bookingRef);
      setTicket(t);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setGeneratingTicket(false);
    }
  }

  const copyRef = () => {
    if (!bookingRef) return;
    navigator.clipboard.writeText(bookingRef);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Title Header */}
      <div className="text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-3 pb-2 border-b border-borderLight/60">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-textTertiary">Booking Reference</span>
          <h1 className="font-display text-4xl text-textPrimary tracking-wide flex items-center gap-2">
            {bookingRef}
            <button
              onClick={copyRef}
              title="Copy Reference"
              className="p-1 rounded-md bg-surface border border-borderLight text-textSecondary hover:text-primary transition-colors text-xs font-sans"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </h1>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary font-mono">৳{booking.amount}</div>
          {booking.phone && (
            <div className="text-xs text-textSecondary font-mono">
              {booking.phone.replace(/(\+?\d{5})(\d+)(\d{2})/, (_m, s, _mid, e) => `${s}${'*'.repeat(_mid.length)}${e}`)}
            </div>
          )}
        </div>
      </div>

      {/* Progress Steps */}
      <Steps step={step} />

      {/* Expiry Notice */}
      {expired && (
        <Notice tone="error">
          <p className="font-semibold mb-1">Seat Hold Expired</p>
          <p className="text-sm opacity-90">
            This hold expired before payment completed.{' '}
            <Link to="/" className="underline font-medium hover:text-error">
              Return to movies
            </Link>{' '}
            to pick a new seat.
          </p>
        </Notice>
      )}

      {/* Failed Notice */}
      {failed && (
        <Notice tone="error">
          <p className="font-semibold mb-1">Payment Unsuccessful</p>
          <p className="text-sm opacity-90">
            The gateway declined the transaction. The seat was released back to the map.
          </p>
        </Notice>
      )}

      {/* HOLD State Card */}
      {booking.status === 'HOLD' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-borderLight/60">
            <span className="text-sm text-textSecondary">Seat Hold Expiry</span>
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-primaryLight text-primaryDark animate-pulse">
              {secondsLeft}s remaining
            </span>
          </div>

          {/* Masked phone display */}
          <div className="flex items-center gap-2 text-sm text-textSecondary">
            <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            OTP sent to{' '}
            <span className="font-mono font-semibold text-textPrimary">
              {booking.phone
                ? booking.phone.replace(/(\+?\d{5})(\d+)(\d{2})/, (_m, s, mid, e) => `${s}${'*'.repeat(mid.length)}${e}`)
                : '—'}
            </span>
          </div>

          {/* OTP Input — always visible (OTP already sent by backend on hold) */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                className="bg-surface border border-borderLight rounded-xl px-4 py-2.5 text-sm w-full outline-none focus:border-primary font-mono text-textPrimary tracking-widest"
              />
              <button
                onClick={handleVerifyOtp}
                disabled={busy || secondsLeft === 0 || otpCode.length === 0}
                className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primaryDark text-white font-medium text-sm transition-colors shadow-md disabled:opacity-50 whitespace-nowrap"
              >
                {busy ? 'Verifying...' : 'Verify'}
              </button>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-textTertiary">Mock OTP code: <span className="font-mono font-bold">{booking.otp_code || 'Sent to phone'}</span></span>
              <button
                onClick={handleSendOtp}
                disabled={busy || resendCooldown > 0}
                className="text-primary hover:underline font-medium disabled:opacity-50 disabled:no-underline"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* OTP_VERIFIED State Card */}
      {booking.status === 'OTP_VERIFIED' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-success font-medium text-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            Phone Number Verified
          </div>

          <p className="text-sm text-textSecondary">
            Your seat is locked. Click below to initiate payment with the mock gateway.
          </p>

          <button
            onClick={handlePay}
            disabled={paying}
            className="w-full py-3.5 rounded-xl bg-primary hover:bg-primaryDark text-white font-semibold text-base transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {paying ? 'Processing Payment...' : `Pay ৳${booking.amount}`}
          </button>
        </Card>
      )}

      {/* PAYMENT_PENDING State */}
      {booking.status === 'PAYMENT_PENDING' && (
        <Card className="p-6 flex items-center gap-4 border-primary/40 bg-primaryLight/20">
          <div className="w-4 h-4 rounded-full bg-primary animate-ping flex-shrink-0" />
          <div>
            <p className="font-semibold text-textPrimary text-sm mb-0.5">Awaiting Payment Gateway Confirmation</p>
            <p className="text-xs text-textSecondary">
              The gateway is settling the charge asynchronously (2–15s delay). This page will auto-update upon confirmation.
            </p>
          </div>
        </Card>
      )}

      {/* CONFIRMED Ticket Display & E-Ticket Generator */}
      {booking.status === 'CONFIRMED' && (
        <div className="space-y-6">
          <Notice tone="success">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-2xl bg-success/20 text-success text-3xl">🎟️</div>
                <div className="space-y-1">
                  <p className="font-bold text-xl text-textPrimary">Booking Confirmed!</p>
                  <p className="text-sm text-textSecondary">
                    Your seat is permanently locked. Booking Ref:{' '}
                    <strong className="font-mono text-primary">{bookingRef}</strong>
                  </p>
                </div>
              </div>
            </div>
          </Notice>

          {!ticket ? (
            <Card className="p-6 text-center space-y-4 border-primary/40 bg-gradient-to-b from-card to-primaryLight/10">
              <div className="w-12 h-12 rounded-full bg-primaryLight text-primary flex items-center justify-center mx-auto text-2xl">
                ✨
              </div>
              <div>
                <h3 className="font-bold text-lg text-textPrimary">Ready to Entry</h3>
                <p className="text-xs text-textSecondary max-w-sm mx-auto mt-1">
                  Generate your official electronic cinema pass with unique QR & Barcode verification.
                </p>
              </div>
              <button
                onClick={handleGenerateTicket}
                disabled={generatingTicket}
                className="px-8 py-3.5 rounded-xl bg-primary hover:bg-primaryDark text-white font-bold text-sm transition-all shadow-lg hover:shadow-primary/30 flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
              >
                {generatingTicket ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating E-Ticket...
                  </>
                ) : (
                  '🎫 Generate E-Ticket'
                )}
              </button>
            </Card>
          ) : (
            <TicketView ticket={ticket} onClose={() => setTicket(null)} />
          )}
        </div>
      )}

      {message && (
        <p className="text-xs text-center text-textSecondary font-mono bg-surface p-3 rounded-xl border border-borderLight">
          {message}
        </p>
      )}
    </div>
  );
}

function Steps({ step }: { step: number }) {
  const labels = ['Hold Seat', 'Verify Phone', 'Payment', 'Confirmed'];
  return (
    <div className="grid grid-cols-4 gap-2 text-center text-xs py-2">
      {labels.map((l, i) => {
        const isActive = i === step;
        const isDone = i < step;

        return (
          <div
            key={l}
            className={`p-2.5 rounded-xl border transition-all ${
              isDone
                ? 'bg-successLight border-success/30 text-success font-medium'
                : isActive
                ? 'bg-primaryLight border-primary/50 text-primaryDark font-bold shadow-sm'
                : 'bg-surface border-borderLight text-textTertiary'
            }`}
          >
            <div className="font-mono text-[11px] opacity-75 mb-0.5">Step 0{i + 1}</div>
            <div className="truncate">{l}</div>
          </div>
        );
      })}
    </div>
  );
}

function Notice({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  const style =
    tone === 'error'
      ? 'border-error/40 bg-errorLight text-error'
      : 'border-success/40 bg-successLight text-textPrimary';
  return <div className={`border rounded-2xl p-5 ${style}`}>{children}</div>;
}
