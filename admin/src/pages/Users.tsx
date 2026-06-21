import { useEffect, useState } from 'react'
import { Search, Trash2, Pencil, Loader2, ShieldCheck, UserCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import { Table } from '../components/ui/Table'
import Modal from '../components/ui/Modal'
import { adminApi } from '../lib/api'
import { formatDistanceToNow } from 'date-fns'

interface User {
  id: string
  email: string
  name?: string
  role: string
  is_active?: boolean
  created_at: string
  last_login?: string
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    adminApi.getUsers({ search }).then((r) => setUsers(r.data.items ?? r.data)).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search])

  function openEdit(u: User) { setEditUser(u); setEditRole(u.role); setEditActive(u.is_active ?? true) }

  async function handleSave() {
    if (!editUser) return
    setSaving(true)
    try {
      await adminApi.updateUser(editUser.id, { role: editRole, is_active: editActive })
      setUsers((u) => u.map((x) => x.id === editUser.id ? { ...x, role: editRole, is_active: editActive } : x))
      toast.success('User updated')
      setEditUser(null)
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this user? This cannot be undone.')) return
    try {
      await adminApi.deleteUser(id)
      setUsers((u) => u.filter((x) => x.id !== id))
      toast.success('User deleted')
    } catch { toast.error('Delete failed') }
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-red-600/20 text-red-400',
    lawyer: 'bg-brand-600/20 text-brand-400',
    client: 'bg-green-600/20 text-green-400',
    legal_writer: 'bg-purple-600/20 text-purple-400',
  }

  const columns = [
    {
      key: 'name', label: 'User',
      render: (r: User) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-surface-3 flex items-center justify-center flex-shrink-0">
            <UserCircle size={15} className="text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-200">{r.name || r.email.split('@')[0]}</p>
            <p className="text-xs text-gray-500">{r.email}</p>
          </div>
        </div>
      )
    },
    {
      key: 'role', label: 'Role',
      render: (r: User) => (
        <span className={`badge ${roleColors[r.role] ?? 'bg-gray-600/20 text-gray-400'}`}>
          {r.role === 'admin' && <ShieldCheck size={10} className="mr-1" />}
          {r.role}
        </span>
      )
    },
    {
      key: 'is_active', label: 'Status',
      render: (r: User) => r.is_active !== false
        ? <span className="badge bg-green-600/20 text-green-400">Active</span>
        : <span className="badge bg-gray-600/20 text-gray-500">Inactive</span>
    },
    {
      key: 'last_login', label: 'Last Login',
      render: (r: User) => r.last_login
        ? <span className="text-gray-500 text-xs">{formatDistanceToNow(new Date(r.last_login), { addSuffix: true })}</span>
        : <span className="text-gray-600 text-xs">Never</span>
    },
    {
      key: 'created_at', label: 'Joined',
      render: (r: User) => <span className="text-gray-500 text-xs">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
    },
    {
      key: 'actions', label: '',
      render: (r: User) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-gray-500 hover:text-brand-400 hover:bg-brand-600/10 transition-colors"><Pencil size={13} /></button>
          <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-600/10 transition-colors"><Trash2 size={13} /></button>
        </div>
      )
    },
  ]

  return (
    <div>
      <PageHeader title="Users" description="Manage platform users and roles" />

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input className="input pl-9" placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Table columns={columns} data={users} loading={loading} keyExtractor={(r) => r.id} emptyMessage="No users found" />

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit User">
        <div className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input opacity-60 cursor-not-allowed" value={editUser?.email || ''} readOnly />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
              <option value="client">Client</option>
              <option value="lawyer">Lawyer</option>
              <option value="legal_writer">Legal Writer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="active" checked={editActive} onChange={(e) => setEditActive(e.target.checked)}
              className="w-4 h-4 accent-brand-500" />
            <label htmlFor="active" className="text-sm text-gray-300">Active account</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setEditUser(null)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
