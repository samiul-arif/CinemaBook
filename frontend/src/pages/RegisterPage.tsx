import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiRequestError } from '../api/client';

export const RegisterPage: React.FC = () => {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already logged in, redirect
  React.useEffect(() => {
    if (user) {
      navigate(redirect, { replace: true });
    }
  }, [user, navigate, redirect]);

  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (!pass) return { score, label: 'Empty', color: 'text-textTertiary', bg: 'bg-borderLight' };
    
    if (pass.length >= 8) score++;
    if (/[a-z]/.test(pass)) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 2) {
      return { score, label: 'Weak', color: 'text-error', bg: 'bg-error' };
    } else if (score === 3) {
      return { score, label: 'Medium', color: 'text-warning', bg: 'bg-warning' };
    } else if (score === 4) {
      return { score, label: 'Strong', color: 'text-success', bg: 'bg-success' };
    } else {
      return { score, label: 'Very Strong', color: 'text-success font-extrabold', bg: 'bg-emerald-600' };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (!phone.trim()) {
      setError('Please enter a valid phone number');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number');
      return;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      setError('Password must contain at least one special character');
      return;
    }
    if (password !== confirmPassword) {
      setError('Confirm password does not match password');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        name: fullName,
        email,
        phone,
        password,
        confirmPassword,
      });
      navigate(redirect, { replace: true });
    } catch (err: any) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-4">
      {/* Main Container - Two-Column on Desktop, Single-Column on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch rounded-3xl overflow-hidden glass-panel border border-borderLight shadow-2xl">
        
        {/* Left Column: Cinema Branding & Feature Banner (Hidden or stacked on Mobile) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-primary/90 via-primaryDark to-accent text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          {/* Decorative Ambient Shapes */}
          <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-primary/30 blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <Link to="/" className="inline-flex items-center gap-3 group mb-8">
              <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white backdrop-blur-md group-hover:scale-105 transition-transform">
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                  <path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z" />
                </svg>
              </div>
              <span className="font-display text-3xl tracking-wider text-white">
                CINEMA<span className="text-white/80 font-bold ml-0.5">SEAT</span>
              </span>
            </Link>

            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 leading-tight">
              Create Your Account
            </h2>
            <p className="text-white/80 text-sm sm:text-base leading-relaxed mb-6">
              Instant access to premium cinema bookings, live seat maps, and instant digital E-Tickets.
            </p>

            {/* Feature Highlights */}
            <div className="space-y-4 my-8">
              <div className="flex items-start gap-3 bg-white/10 p-3.5 rounded-2xl backdrop-blur-sm border border-white/10">
                <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Instant Registration</h4>
                  <p className="text-xs text-white/75">No waiting for email or phone OTP during signup. Get started in seconds.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white/10 p-3.5 rounded-2xl backdrop-blur-sm border border-white/10">
                <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Digital E-Ticket Wallet</h4>
                  <p className="text-xs text-white/75">Access all your showtime tickets with verified QR codes instantly.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6 border-t border-white/15 text-xs text-white/70">
            Hackathon Guaranteed: Seamless non-blocking account creation.
          </div>
        </div>

        {/* Right Column: Registration Form */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            {/* Sign In / Create Account tab switcher */}
            <div className="flex mb-8 bg-surface rounded-2xl p-1 border border-borderLight">
              <Link
                to={`/login?redirect=${encodeURIComponent(redirect)}`}
                className="flex-1 text-center py-2.5 rounded-xl text-textSecondary hover:text-textPrimary text-xs font-semibold transition-all"
              >
                Sign In
              </Link>
              <span
                aria-current="page"
                className="flex-1 text-center py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-sm transition-all"
              >
                Create Account
              </span>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-2xl bg-errorLight text-error border border-error/20 text-sm flex items-start gap-3 animate-fade-in">
                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samiul Arif"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-surface border border-borderLight text-textPrimary placeholder-textTertiary focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-sm"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="samiul@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-surface border border-borderLight text-textPrimary placeholder-textTertiary focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-sm"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+8801784738289"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-surface border border-borderLight text-textPrimary placeholder-textTertiary focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-sm"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1.5">
                  Password (min 8 chars)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-11 rounded-xl bg-surface border border-borderLight text-textPrimary placeholder-textTertiary focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-textTertiary hover:text-textSecondary transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {password && (
                  <div className="mt-2.5 space-y-1.5 animate-fade-in">
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span className="text-textSecondary">Password Strength:</span>
                      <span className={getPasswordStrength(password).color}>
                        {getPasswordStrength(password).label}
                      </span>
                    </div>
                    {/* Strength Bar */}
                    <div className="h-1.5 w-full bg-borderLight rounded-full overflow-hidden flex gap-1">
                      <div
                        className={`h-full transition-all duration-300 ${getPasswordStrength(password).bg}`}
                        style={{ width: `${(getPasswordStrength(password).score / 5) * 100}%` }}
                      />
                    </div>
                    {/* Feedback Checklist */}
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[10px] text-textSecondary">
                      <div className="flex items-center gap-1">
                        <span className={password.length >= 8 ? 'text-success' : 'text-textTertiary'}>
                          {password.length >= 8 ? '✓' : '○'} Min 8 characters
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={/[A-Z]/.test(password) ? 'text-success' : 'text-textTertiary'}>
                          {/[A-Z]/.test(password) ? '✓' : '○'} Uppercase letter
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={/[a-z]/.test(password) ? 'text-success' : 'text-textTertiary'}>
                          {/[a-z]/.test(password) ? '✓' : '○'} Lowercase letter
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={/[0-9]/.test(password) ? 'text-success' : 'text-textTertiary'}>
                          {/[0-9]/.test(password) ? '✓' : '○'} One number
                        </span>
                      </div>
                      <div className="flex items-center gap-1 col-span-2">
                        <span className={/[^A-Za-z0-9]/.test(password) ? 'text-success' : 'text-textTertiary'}>
                          {/[^A-Za-z0-9]/.test(password) ? '✓' : '○'} Special character (!@#$...)
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-11 rounded-xl bg-surface border border-borderLight text-textPrimary placeholder-textTertiary focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-textTertiary hover:text-textSecondary transition-colors"
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3.5 px-6 rounded-xl bg-primary hover:bg-primaryDark text-white font-bold text-sm tracking-wide shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <span>Register Account</span>
                )}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
};
