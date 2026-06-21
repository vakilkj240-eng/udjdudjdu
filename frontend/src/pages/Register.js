import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Scale, Loader2, ArrowRight, User, Briefcase, PenLine } from 'lucide-react';
import Footer from '../components/Footer';

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

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'client',
    specialization: '',
    location: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await register(formData);
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

  return (
    <div className="min-h-screen flex" data-testid="register-page">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '40px 40px'}}></div>
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <Scale className="w-16 h-16 text-amber-400 mb-8" />
          <h1 className="font-heading text-5xl font-bold mb-6 leading-tight">
            Join
            <span className="text-amber-400"> Gavel & Brief</span>
          </h1>
          <p className="text-xl text-slate-300 leading-relaxed mb-8">
            Create your account and get access to India's best legal professionals or start connecting with clients seeking expert legal advice.
          </p>
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
            <p className="text-slate-200 mb-4 font-medium">Why join Gavel & Brief?</p>
            <ul className="space-y-3 text-slate-300">
              <li className="flex items-center gap-3">
                <span className="text-amber-400">✓</span>
                AI-powered case matching
              </li>
              <li className="flex items-center gap-3">
                <span className="text-amber-400">✓</span>
                Verified legal professionals
              </li>
              <li className="flex items-center gap-3">
                <span className="text-amber-400">✓</span>
                Transparent pricing & process
              </li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="font-heading text-4xl font-bold text-slate-900 mb-3" data-testid="register-heading">
              Create Account
            </h2>
            <p className="text-slate-600 text-lg">Join Gavel & Brief today</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg" data-testid="register-error">
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} data-testid="register-form" className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                I am a
              </label>
              <div className="grid grid-cols-3 gap-3" data-testid="role-selector">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'client' })}
                  className={
                    formData.role === 'client'
                      ? 'flex flex-col items-center gap-2 p-4 bg-slate-900 text-white rounded-xl border-2 border-slate-900 transition-all'
                      : 'flex flex-col items-center gap-2 p-4 bg-white text-slate-700 rounded-xl border-2 border-slate-200 hover:border-slate-400 transition-all'
                  }
                  data-testid="role-client-button"
                >
                  <User className="w-8 h-8" />
                  <span className="font-semibold text-sm">Client</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'lawyer' })}
                  className={
                    formData.role === 'lawyer'
                      ? 'flex flex-col items-center gap-2 p-4 bg-slate-900 text-white rounded-xl border-2 border-slate-900 transition-all'
                      : 'flex flex-col items-center gap-2 p-4 bg-white text-slate-700 rounded-xl border-2 border-slate-200 hover:border-slate-400 transition-all'
                  }
                  data-testid="role-lawyer-button"
                >
                  <Briefcase className="w-8 h-8" />
                  <span className="font-semibold text-sm">Lawyer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'legal_writer' })}
                  className={
                    formData.role === 'legal_writer'
                      ? 'flex flex-col items-center gap-2 p-4 bg-slate-900 text-white rounded-xl border-2 border-slate-900 transition-all'
                      : 'flex flex-col items-center gap-2 p-4 bg-white text-slate-700 rounded-xl border-2 border-slate-200 hover:border-slate-400 transition-all'
                  }
                  data-testid="role-writer-button"
                >
                  <PenLine className="w-8 h-8" />
                  <span className="font-semibold text-sm">Legal Writer</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-slate-900 focus:outline-none transition-colors text-slate-900"
                placeholder="John Doe"
                required
                data-testid="register-name-input"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-slate-900 focus:outline-none transition-colors text-slate-900"
                placeholder="you@example.com"
                required
                data-testid="register-email-input"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-slate-900 focus:outline-none transition-colors text-slate-900"
                placeholder="••••••••"
                required
                data-testid="register-password-input"
              />
            </div>

            {formData.role === 'lawyer' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Specialization
                  </label>
                  <select
                    name="specialization"
                    value={formData.specialization}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-slate-900 focus:outline-none transition-colors text-slate-900 bg-white"
                    required
                    data-testid="register-specialization-select"
                  >
                    <option value="">Select your specialization</option>
                    <option value="Criminal">Criminal Law</option>
                    <option value="Civil">Civil Law</option>
                    <option value="Family">Family Law</option>
                    <option value="Property">Property Law</option>
                    <option value="Corporate">Corporate Law</option>
                    <option value="Tax">Tax Law</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:border-slate-900 focus:outline-none transition-colors text-slate-900"
                    placeholder="e.g., Mumbai, Delhi"
                    required
                    data-testid="register-location-input"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-4 px-6 rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={loading}
              data-testid="register-submit-button"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create Account <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-slate-600">
              Already have an account?{' '}
              <Link to="/login" className="text-amber-600 hover:text-amber-700 font-semibold" data-testid="register-login-link">
                Sign in here
              </Link>
            </p>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-200">
            <Link to="/" className="text-slate-600 hover:text-slate-900 text-sm flex items-center justify-center gap-2">
              ← Back to Homepage
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Register;
