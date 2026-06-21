import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Scale, Eye, EyeOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { adminApi } from '../lib/api'
import { setToken, isAuthenticated } from '../lib/auth'
import { useEffect } from 'react'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated()) navigate('/dashboard')
  }, [navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await adminApi.login(email, password)
      setToken(res.data.token)
      toast.success('Welcome back')
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-600 rounded-2xl mb-4 shadow-lg shadow-brand-600/30">
            <Scale size={24} className="text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Gavel &amp; Brief</h1>
          <p className="text-gray-400 text-sm mt-1">Admin Dashboard</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="admin@gavelandbrief.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={loading}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-white/[0.08]">
            <p className="text-[11px] text-gray-500 text-center mb-2.5 uppercase tracking-wider font-medium">Demo Access</p>
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                const demoEmail = 'admin@gavelandbrief.com'
                const demoPass = 'Admin@GB2024'
                setEmail(demoEmail)
                setPassword(demoPass)
                setLoading(true)
                try {
                  const res = await adminApi.login(demoEmail, demoPass)
                  setToken(res.data.token)
                  toast.success('Signed in as Admin')
                  navigate('/dashboard')
                } catch {
                  toast.error('Demo login failed')
                } finally {
                  setLoading(false)
                }
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-brand-500/40 transition-all group disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-brand-600/25 border border-brand-500/30 flex items-center justify-center">
                  <Scale size={13} className="text-brand-400" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-gray-200">Admin Demo</p>
                  <p className="text-[10px] text-gray-500">admin@gavelandbrief.com</p>
                </div>
              </div>
              <span className="text-xs text-gray-600 group-hover:text-brand-400 transition-colors">→</span>
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Gavel &amp; Brief Legal Intelligence Platform
        </p>
      </div>
    </div>
  )
}
