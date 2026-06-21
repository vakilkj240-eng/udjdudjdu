import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';

const API_URL = '';

export default function ForgotPassword() {
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const bg = isDark ? '#0d0d0d' : '#FFFDF7';
  const cardBg = isDark ? '#141414' : '#ffffff';
  const cardBorder = isDark ? 'rgba(212,175,55,0.18)' : '#EFE7D6';
  const headingColor = isDark ? '#e8e8e8' : '#171717';
  const mutedColor = isDark ? '#9a9a9a' : '#57534E';
  const inputBg = isDark ? '#1c1c1c' : '#fff';
  const inputBorder = isDark ? 'rgba(255,255,255,0.15)' : '#d4cfc8';
  const accent = isDark ? '#D4AF37' : '#7C1D2B';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/forgot-password`, { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: bg }}>
      <div className="w-full max-w-md">
        <div className="rounded-2xl p-8 shadow-xl" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
          {sent ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: isDark ? 'rgba(212,175,55,0.12)' : 'rgba(109,7,26,0.08)' }}>
                <CheckCircle className="w-8 h-8" style={{ color: accent }} />
              </div>
              <h2 className="text-2xl font-bold mb-3" style={{ color: headingColor }}>Check your email</h2>
              <p className="mb-2" style={{ color: mutedColor }}>
                If an account exists for <strong style={{ color: headingColor }}>{email}</strong>, you will receive a reset link shortly.
              </p>
              <p className="text-sm mb-6" style={{ color: mutedColor }}>
                In development mode, check the backend console logs for the reset link.
              </p>
              <Link to="/login"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all hover:opacity-90"
                style={{ background: accent, color: isDark ? '#0d0d0d' : '#fff' }}>
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: isDark ? 'rgba(212,175,55,0.12)' : 'rgba(109,7,26,0.08)' }}>
                  <Mail className="w-5 h-5" style={{ color: accent }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: headingColor }}>Forgot password?</h2>
                  <p className="text-sm" style={{ color: mutedColor }}>Enter your email to receive a reset link</p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg text-sm"
                  style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', color: '#ef4444' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: headingColor }}>
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all"
                    style={{ background: inputBg, borderColor: inputBorder, color: headingColor }}
                    onFocus={e => { e.target.style.borderColor = accent; e.target.style.boxShadow = `0 0 0 3px ${accent}22`; }}
                    onBlur={e => { e.target.style.borderColor = inputBorder; e.target.style.boxShadow = 'none'; }}
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 hover:opacity-90"
                  style={{ background: accent, color: isDark ? '#0d0d0d' : '#fff' }}
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Sending reset link...</>
                  ) : (
                    <>Send reset link <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <p className="mt-5 text-center text-sm" style={{ color: mutedColor }}>
                Remember your password?{' '}
                <Link to="/login" className="font-semibold hover:opacity-80" style={{ color: accent }}>
                  Back to Login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
