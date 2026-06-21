import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, CheckCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';

const API_URL = '';

export default function ResetPassword() {
  const { isDark } = useTheme();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const bg = isDark ? '#0d0d0d' : '#FFFDF7';
  const cardBg = isDark ? '#141414' : '#ffffff';
  const cardBorder = isDark ? 'rgba(212,175,55,0.18)' : '#EFE7D6';
  const headingColor = isDark ? '#e8e8e8' : '#171717';
  const mutedColor = isDark ? '#9a9a9a' : '#57534E';
  const inputBg = isDark ? '#1c1c1c' : '#fff';
  const inputBorder = isDark ? 'rgba(255,255,255,0.15)' : '#d4cfc8';
  const accent = isDark ? '#D4AF37' : '#7C1D2B';

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: bg }}>
        <div className="text-center max-w-sm">
          <p className="text-lg font-semibold mb-2" style={{ color: headingColor }}>Invalid reset link</p>
          <p className="text-sm mb-4" style={{ color: mutedColor }}>This link is invalid or has expired.</p>
          <Link to="/forgot-password" className="text-sm font-semibold hover:opacity-80" style={{ color: accent }}>
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/reset-password`, { token, new_password: password });
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please request a new reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: bg }}>
      <div className="w-full max-w-md">
        <div className="rounded-2xl p-8 shadow-xl" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
          {done ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: isDark ? 'rgba(212,175,55,0.12)' : 'rgba(109,7,26,0.08)' }}>
                <CheckCircle className="w-8 h-8" style={{ color: accent }} />
              </div>
              <h2 className="text-2xl font-bold mb-3" style={{ color: headingColor }}>Password updated!</h2>
              <p className="mb-6" style={{ color: mutedColor }}>
                Your password has been changed. Redirecting you to login...
              </p>
              <Link to="/login"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm hover:opacity-90"
                style={{ background: accent, color: isDark ? '#0d0d0d' : '#fff' }}>
                Go to Login
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: isDark ? 'rgba(212,175,55,0.12)' : 'rgba(109,7,26,0.08)' }}>
                  <Lock className="w-5 h-5" style={{ color: accent }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: headingColor }}>Set new password</h2>
                  <p className="text-sm" style={{ color: mutedColor }}>Choose a strong password for your account</p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg text-sm"
                  style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', color: '#ef4444' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: headingColor }}>New password</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-11 rounded-xl border text-sm outline-none transition-all"
                      style={{ background: inputBg, borderColor: inputBorder, color: headingColor }}
                      onFocus={e => { e.target.style.borderColor = accent; e.target.style.boxShadow = `0 0 0 3px ${accent}22`; }}
                      onBlur={e => { e.target.style.borderColor = inputBorder; e.target.style.boxShadow = 'none'; }}
                      placeholder="At least 8 characters"
                      required
                    />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70"
                      style={{ color: mutedColor }}>
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: headingColor }}>Confirm password</label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all"
                    style={{ background: inputBg, borderColor: inputBorder, color: headingColor }}
                    onFocus={e => { e.target.style.borderColor = accent; e.target.style.boxShadow = `0 0 0 3px ${accent}22`; }}
                    onBlur={e => { e.target.style.borderColor = inputBorder; e.target.style.boxShadow = 'none'; }}
                    placeholder="Repeat your password"
                    required
                  />
                </div>
                <button
                  type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm disabled:opacity-50 hover:opacity-90"
                  style={{ background: accent, color: isDark ? '#0d0d0d' : '#fff' }}
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Updating...</> : <>Update password <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>

              <p className="mt-5 text-center text-sm" style={{ color: mutedColor }}>
                <Link to="/login" className="font-semibold hover:opacity-80" style={{ color: accent }}>Back to Login</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
