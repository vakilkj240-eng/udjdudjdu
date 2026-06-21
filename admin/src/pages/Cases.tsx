import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, Pencil, Download, Search, Loader2, Scale } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import { Table } from '../components/ui/Table'
import Modal from '../components/ui/Modal'
import { adminApi } from '../lib/api'
import { formatDistanceToNow } from 'date-fns'

interface Case {
  id: string
  title: string
  court?: string
  year?: number
  citation?: string
  category?: string
  summary?: string
  created_at: string
}

const emptyForm = { title: '', court: '', year: new Date().getFullYear(), citation: '', category: 'civil', summary: '' }

export default function Cases() {
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Case | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const csvRef = useRef<HTMLInputElement>(null)

  function load() {
    setLoading(true)
    adminApi.getCases({ search }).then((r) => setCases(r.data.items ?? r.data)).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search])

  function openCreate() { setForm({ ...emptyForm }); setEditing(null); setFormOpen(true) }
  function openEdit(c: Case) {
    setForm({ title: c.title, court: c.court || '', year: c.year || new Date().getFullYear(), citation: c.citation || '', category: c.category || 'civil', summary: c.summary || '' })
    setEditing(c); setFormOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editing) {
        await adminApi.updateCase(editing.id, form)
        setCases((c) => c.map((x) => x.id === editing.id ? { ...x, ...form } : x))
        toast.success('Case updated')
      } else {
        const r = await adminApi.createCase(form)
        setCases((c) => [r.data, ...c])
        toast.success('Case created')
      }
      setFormOpen(false)
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this case?')) return
    try {
      await adminApi.deleteCase(id)
      setCases((c) => c.filter((x) => x.id !== id))
      toast.success('Deleted')
    } catch { toast.error('Delete failed') }
  }

  async function handleCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setImporting(true)
    const fd = new FormData(); fd.append('file', file)
    try {
      const r = await adminApi.importCasesCsv(fd)
      toast.success(`Imported ${r.data.imported} cases`); load()
    } catch { toast.error('Import failed') }
    finally { setImporting(false); e.target.value = '' }
  }

  const catColors: Record<string, string> = {
    civil: 'bg-brand-600/20 text-brand-400',
    criminal: 'bg-red-600/20 text-red-400',
    constitutional: 'bg-purple-600/20 text-purple-400',
    commercial: 'bg-amber-600/20 text-amber-400',
    family: 'bg-green-600/20 text-green-400',
  }

  const columns = [
    {
      key: 'title', label: 'Case Title',
      render: (r: Case) => (
        <div className="flex items-start gap-2">
          <Scale size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <span className="font-medium text-gray-200 text-sm line-clamp-2 max-w-xs">{r.title}</span>
        </div>
      )
    },
    { key: 'court', label: 'Court', render: (r: Case) => <span className="text-gray-400 text-xs">{r.court || '—'}</span> },
    { key: 'year', label: 'Year', render: (r: Case) => <span className="text-gray-400">{r.year || '—'}</span> },
    { key: 'citation', label: 'Citation', render: (r: Case) => <span className="text-gray-500 text-xs font-mono">{r.citation || '—'}</span> },
    {
      key: 'category', label: 'Category',
      render: (r: Case) => <span className={`badge ${catColors[r.category || ''] ?? 'bg-gray-600/20 text-gray-400'}`}>{r.category || 'other'}</span>
    },
    {
      key: 'actions', label: '',
      render: (r: Case) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-gray-500 hover:text-brand-400 hover:bg-brand-600/10 transition-colors"><Pencil size={13} /></button>
          <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-600/10 transition-colors"><Trash2 size={13} /></button>
        </div>
      )
    },
  ]

  return (
    <div>
      <PageHeader title="Cases" description="Legal case database"
        actions={
          <>
            <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsv} />
            <button className="btn-secondary" onClick={() => csvRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Import CSV
            </button>
            <button className="btn-primary" onClick={openCreate}><Plus size={14} /> Add Case</button>
          </>
        }
      />

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input className="input pl-9" placeholder="Search cases…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Table columns={columns} data={cases} loading={loading} keyExtractor={(r) => r.id} emptyMessage="No cases yet" />

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Case' : 'Add Case'} width="max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. State v. Sharma (2023)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Court</label>
              <input className="input" value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} placeholder="Supreme Court of India" />
            </div>
            <div>
              <label className="label">Year</label>
              <input className="input" type="number" value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Citation</label>
              <input className="input font-mono text-xs" value={form.citation} onChange={(e) => setForm({ ...form, citation: e.target.value })} placeholder="AIR 2023 SC 1234" />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="civil">Civil</option>
                <option value="criminal">Criminal</option>
                <option value="constitutional">Constitutional</option>
                <option value="commercial">Commercial</option>
                <option value="family">Family</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Summary</label>
            <textarea className="input min-h-[100px] resize-none" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Brief summary of the case…" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setFormOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving || !form.title}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {editing ? 'Save Changes' : 'Create Case'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
