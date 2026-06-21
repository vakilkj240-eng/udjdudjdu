import { useEffect, useState } from 'react'
import { Save, Database, Key, RefreshCw, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import { adminApi } from '../lib/api'

interface Settings {
  admin_email: string
  openai_configured: boolean
  supabase_configured: boolean
  mongo_configured: boolean
  db_backend: string
  document_count: number
  chunk_count: number
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [migrating, setMigrating] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPass, setSavingPass] = useState(false)

  useEffect(() => {
    adminApi.getSettings()
      .then((r) => setSettings(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleMigrate() {
    if (!confirm('Run database migration? This will create any missing tables in Supabase.')) return
    setMigrating(true)
    try {
      const r = await adminApi.runMigration()
      toast.success(r.data.message || 'Migration complete')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || 'Migration failed')
    } finally {
      setMigrating(false)
    }
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return }
    setSavingPass(true)
    try {
      await adminApi.updateSettings({ new_password: newPassword })
      toast.success('Password updated')
      setNewPassword(''); setConfirmPassword('')
    } catch { toast.error('Failed to update password') }
    finally { setSavingPass(false) }
  }

  const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className="flex items-center gap-2">
      {ok
        ? <CheckCircle size={14} className="text-green-400" />
        : <AlertCircle size={14} className="text-red-400" />}
      <span className={`text-sm ${ok ? 'text-green-400' : 'text-red-400'}`}>{label}</span>
    </div>
  )

  return (
    <div>
      <PageHeader title="Settings" description="Platform configuration and system status" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Status */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database size={14} className="text-brand-400" />
            <h2 className="font-semibold text-sm text-gray-200">System Status</h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-4 bg-white/5 rounded animate-pulse" />
              ))}
            </div>
          ) : settings ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <StatusBadge ok={settings.supabase_configured} label={`Supabase: ${settings.supabase_configured ? 'Connected' : 'Not configured'}`} />
                <StatusBadge ok={settings.openai_configured} label={`OpenAI: ${settings.openai_configured ? 'Configured' : 'Not configured'}`} />
                <StatusBadge ok={settings.mongo_configured} label={`MongoDB: ${settings.mongo_configured ? 'Connected' : 'Not configured'}`} />
              </div>

              <div className="border-t border-white/[0.08] pt-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Database Backend</p>
                <span className="badge bg-brand-600/20 text-brand-400 text-sm">{settings.db_backend || 'Unknown'}</span>
              </div>

              <div className="border-t border-white/[0.08] pt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Documents</p>
                  <p className="text-xl font-bold text-gray-100">{settings.document_count?.toLocaleString() ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Chunks</p>
                  <p className="text-xl font-bold text-gray-100">{settings.chunk_count?.toLocaleString() ?? 0}</p>
                </div>
              </div>

              <button className="btn-secondary w-full justify-center" onClick={handleMigrate} disabled={migrating}>
                {migrating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Run DB Migration
              </button>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Failed to load settings</p>
          )}
        </div>

        {/* Security */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Key size={14} className="text-brand-400" />
            <h2 className="font-semibold text-sm text-gray-200">Admin Security</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label">Admin Email</label>
              <input className="input opacity-60 cursor-not-allowed" value={settings?.admin_email || '—'} readOnly />
            </div>
            <div>
              <label className="label">New Password</label>
              <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters" autoComplete="new-password" />
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password" autoComplete="new-password" />
            </div>
            <button className="btn-primary" onClick={handleChangePassword} disabled={savingPass || !newPassword}>
              {savingPass ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Update Password
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
