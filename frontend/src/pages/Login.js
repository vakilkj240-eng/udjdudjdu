import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Scale, Loader2, ArrowRight, Eye, EyeOff, PenLine, Wifi } from 'lucide-react';

function formatApiErrorDetail(detail) {
  if (detail == null) return 'Something went wrong. Please try again.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === 'string' ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(' ');
  if (detail && typeof detail.msg === 'string') return detail.msg;
  return String(detail);
}

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [slowConn, setSlowConn] = useState(false);
  const slowTimer = useRef(null);
  const { login } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  // Show "waking up server" hint if login takes more than 4 seconds
  useEffect(() => {
    if (loading) {
      slowTimer.current = setTimeout(() => setSlowConn(true), 4000);
    } else {
      clearTimeout(slowTimer.current);
      setSlowConn(false);
    }
    return () => clearTimeout(slowTimer.current);
  }, [loading]);

  const performLogin = async (loginEmail, loginPassword) => {
    setError('');
    setLoading(true);
    try {
      const user = await login(loginEmail, loginPassword);
      if (user.role === 'client') {
        navigate('/client/dashboard');
      } else if (user.role === 'lawyer') {
        navigate('/lawyer/dashboard');
      } else if (user.role === 'legal_writer') {
        navigate('/writer/dashboard');
      }
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await performLogin(email, password);
  };

  const handleDemoLogin = async (role) => {
    const creds = {
      lawyer: { email: 'lawyer@test.com', password: 'password123' },
      client: { email: 'client@test.com', password: 'password123' },
      legal_writer: { email: 'writer@test.com', password: 'password123' },
    }[role];
    if (!creds) return;
    setEmail(creds.email);
    setPassword(creds.password);
    await performLogin(creds.email, creds.password);
  };

  return (
    <div className="min-h-screen flex relative" style={{ isolation: 'isolate' }} data-testid="login-page">
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: -1, backgroundImage: `url(${process.env.PUBLIC_URL}/gold-pattern.png)`, backgroundRepeat: 'repeat', backgroundSize: '320px 320px', opacity: 0.18, pointerEvents: 'none' }} />
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col z-10"
        style={{ background: 'linear-gradient(160deg, #7C1D2B 0%, #5a1420 50%, #3a0c18 100%)' }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: isDark
              ? 'radial-gradient(circle at 1px 1px, rgba(212,175,55,0.55) 1px, transparent 0)'
              : 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        {/* Top: welcome text and form intro */}
        <div className="relative z-10 flex flex-col justify-center flex-1 px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <img src="/logo-circular.png" alt="Gavel & Brief" className="w-16 h-16 object-contain flex-shrink-0"
              style={{ filter: 'drop-shadow(0 0 16px rgba(201,168,76,0.5))' }} />
            <div>
              <h1 className="font-serif text-2xl font-bold text-white">Gavel &amp; Brief</h1>
              <p className="text-sm" style={{ color: 'rgba(201,168,76,0.8)' }}>Legal Intelligence Platform</p>
            </div>
          </div>

          <h2 className="font-serif text-4xl font-bold mb-4 leading-tight">
            India's Most Trusted<br />Legal Platform
          </h2>
          <p className="text-base leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Connect with expert lawyers and get AI-powered case analysis in your language.
          </p>

          <div className="space-y-4 mb-10">
            {[
              '500+ Verified Lawyers across India',
              '10,000+ Cases Resolved',
              '98% Client Satisfaction',
              'All 22 Indian Languages Supported',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(201,168,76,0.25)' }}>
                  <span style={{ color: '#C9A84C', fontWeight: 'bold', fontSize: 13 }}>✓</span>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: description + disclaimer */}
        <div className="relative z-10 px-16 pb-10 mt-auto">
          <div className="rounded-xl p-5 mb-4" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Scale className="w-4 h-4" style={{ color: '#C9A84C' }} />
              <p className="font-semibold text-white text-sm">About Gavel &amp; Brief</p>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
              AI-powered legal intelligence connecting clients and lawyers through smart case analysis, document drafting, and predictive analytics.
            </p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
              <span className="font-semibold" style={{ color: 'rgba(201,168,76,0.9)' }}>Disclaimer:</span> Gavel &amp; Brief is an AI-assisted legal technology platform and does not constitute legal advice. All information is for informational purposes only. Please consult a qualified legal professional for advice specific to your situation.
            </p>
          </div>
          <p className="text-center text-xs mt-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
            © 2026 Gavel &amp; Brief. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right: login form */}
      <div className={`w-full lg:w-1/2 flex items-center justify-center p-8 relative z-10 ${isDark ? 'bg-[#141414]' : 'bg-white'}`}>
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="font-heading text-4xl font-bold text-slate-900 mb-3" data-testid="login-heading">
              Welcome Back
            </h2>
            <p className="text-slate-600 text-lg">Sign in to continue to Gavel &amp; Brief</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg" data-testid="login-error">
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} data-testid="login-form" className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none transition-colors text-slate-900"
                style={{ '--tw-border-opacity': 1 }}
                onFocus={e => e.target.style.borderColor = '#7C1D2B'}
                onBlur={e => e.target.style.borderColor = ''}
                placeholder="you@example.com"
                required
                data-testid="login-email-input"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border-2 border-slate-200 rounded-lg focus:outline-none transition-colors text-slate-900"
                  onFocus={e => e.target.style.borderColor = '#7C1D2B'}
                  onBlur={e => e.target.style.borderColor = ''}
                  placeholder="••••••••"
                  required
                  data-testid="login-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end -mt-2">
              <Link to="/forgot-password" className="text-sm font-medium hover:opacity-80"
                style={{ color: '#7C1D2B' }}>
                Forgot password?
              </Link>
            </div>

            {slowConn && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                style={{ background: 'rgba(212,175,55,0.10)', border: '1px solid rgba(212,175,55,0.3)', color: '#92720a' }}>
                <Wifi className="w-4 h-4 flex-shrink-0 animate-pulse" />
                <span>Server is waking up — this can take up to 30 seconds on first login. Please wait…</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full text-white font-semibold py-4 px-6 rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: '#7C1D2B' }}
              disabled={loading}
              data-testid="login-submit-button"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" />{slowConn ? 'Connecting to server…' : 'Signing in…'}</>
              ) : (
                <>Sign In <ArrowRight className="w-5 h-5" /></>
              )}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white text-slate-500 font-medium uppercase tracking-wider">
                  Or try a demo account
                </span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('lawyer')}
                disabled={loading}
                className="px-3 py-3 border-2 border-slate-200 hover:border-slate-900 rounded-lg text-xs font-semibold text-slate-700 transition-colors disabled:opacity-50 flex flex-col items-center gap-1"
                data-testid="demo-lawyer-login"
              >
                <Scale className="w-4 h-4" />
                Demo Lawyer
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('client')}
                disabled={loading}
                className="px-3 py-3 border-2 border-slate-200 hover:border-slate-900 rounded-lg text-xs font-semibold text-slate-700 transition-colors disabled:opacity-50 flex flex-col items-center gap-1"
                data-testid="demo-client-login"
              >
                <ArrowRight className="w-4 h-4" />
                Demo Client
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('legal_writer')}
                disabled={loading}
                className="px-3 py-3 border-2 border-slate-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex flex-col items-center gap-1"
                style={{ borderColor: 'rgba(124,29,43,0.3)', color: '#7C1D2B' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#7C1D2B'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(124,29,43,0.3)'}
                data-testid="demo-writer-login"
              >
                <PenLine className="w-4 h-4" />
                Demo Writer
              </button>
            </div>
            <p className="mt-3 text-xs text-center text-slate-500">
              One-click login with seeded data — perfect for testing the platform
            </p>
          </div>

          <div className="mt-8 text-center">
            <p className="text-slate-600">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold hover:opacity-80" style={{ color: '#7C1D2B' }} data-testid="login-register-link">
                Create one here
              </Link>
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200 space-y-3">
            <Link to="/" className="text-slate-600 hover:text-slate-900 text-sm flex items-center justify-center gap-2">
              ← Back to Homepage
            </Link>
            <a
              href="/gb-admin/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all group w-full"
              style={{
                background: 'rgba(124,29,43,0.04)',
                borderColor: 'rgba(124,29,43,0.2)',
                color: '#7C1D2B'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(124,29,43,0.08)';
                e.currentTarget.style.borderColor = '#7C1D2B';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(124,29,43,0.04)';
                e.currentTarget.style.borderColor = 'rgba(124,29,43,0.2)';
              }}
            >
              <img src="/logo-circular.png" alt="" className="w-5 h-5 object-contain" />
              <span>Admin Dashboard</span>
              <span style={{ color: 'rgba(124,29,43,0.5)' }}>→</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
