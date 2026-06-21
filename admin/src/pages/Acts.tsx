import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, Pencil, Download, Search, Loader2, Gavel } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import { Table } from '../components/ui/Table'
import Modal from '../components/ui/Modal'
import { adminApi } from '../lib/api'

interface Act {
  id: string
  title: string
  number?: string
  year?: number
  ministry?: string
  category?: string
  description?: string
  section_count?: number
  created_at: string
}

const emptyForm = { title: '', number: '', year: new Date().getFullYear(), ministry: '', category: 'civil', description: '' }

export default function Acts() {
  const [acts, setActs] = useState<Act[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Act | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const csvRef = useRef<HTMLInputElement>(null)

  function load() {
    setLoading(true)
    adminApi.getActs({ search }).then((r) => setActs(r.data.items ?? r.data)).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search])

  function openCreate() { setForm({ ...emptyForm }); setEditing(null); setFormOpen(true) }
  function openEdit(a: Act) {
    setForm({ title: a.title, number: a.number || '', year: a.year || new Date().getFullYear(), ministry: a.ministry || '', category: a.category || 'civil', description: a.description || '' })
    setEditing(a); setFormOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editing) {
        await adminApi.updateAct(editing.id, form)
        setActs((a) => a.map((x) => x.id === editing.id ? { ...x, ...form } : x))
        toast.success('Act updated')
      } else {
        const r = await adminApi.createAct(form)
        setActs((a) => [r.data, ...a])
        toast.success('Act created')
      }
      setFormOpen(false)
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this act?')) return
    try {
      await adminApi.deleteAct(id)
      setActs((a) => a.filter((x) => x.id !== id))
      toast.success('Deleted')
    } catch { toast.error('Delete failed') }
  }

  async function handleCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setImporting(true)
    const fd = new FormData(); fd.append('file', file)
    try {
      const r = await adminApi.importActsCsv(fd)
      toast.success(`Imported ${r.data.imported} acts`); load()
    } catch { toast.error('Import failed') }
    finally { setImporting(false); e.target.value = '' }
  }

  const columns = [
    {
      key: 'title', label: 'Act Title',
      render: (r: Act) => (
        <div className="flex items-start gap-2">
          <Gavel size={13} className="text-green-400 flex-shrink-0 mt-0.5" />
          <span className="font-medium text-gray-200 text-sm max-w-xs">{r.title}</span>
        </div>
      )
    },
    { key: 'number', label: 'Act No.', render: (r: Act) => <span className="text-gray-400 text-xs font-mono">{r.number || '—'}</span> },
    { key: 'year', label: 'Year', render: (r: Act) => <span className="text-gray-400">{r.year || '—'}</span> },
    { key: 'ministry', label: 'Ministry', render: (r: Act) => <span className="text-gray-400 text-xs">{r.ministry || '—'}</span> },
    {
      key: 'section_count', label: 'Sections',
      render: (r: Act) => r.section_count
        ? <span className="badge bg-green-600/20 text-green-400">{r.section_count}</span>
        : <span className="text-gray-600">—</span>
    },
    {
      key: 'actions', label: '',
      render: (r: Act) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-gray-500 hover:text-brand-400 hover:bg-brand-600/10 transition-colors"><Pencil size={13} /></button>
          <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-600/10 transition-colors"><Trash2 size={13} /></button>
        </div>
      )
    },
  ]

  return (
    <div>
      <PageHeader title="Acts" description="Legislative acts and statutes"
        actions={
          <>
            <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsv} />
            <button className="btn-secondary" onClick={() => csvRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Import CSV
            </button>
            <button className="btn-primary" onClick={openCreate}><Plus size={14} /> Add Act</button>
          </>
        }
      />

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input className="input pl-9" placeholder="Search acts…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Table columns={columns} data={acts} loading={loading} keyExtractor={(r) => r.id} emptyMessage="No acts yet" />

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Act' : 'Add Act'} width="max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. The Indian Penal Code, 1860" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Act Number</label>
              <input className="input font-mono text-xs" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="45 of 1860" />
            </div>
            <div>
              <label className="label">Year</label>
              <input className="input" type="number" value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="label">Ministry</label>
            <input className="input" value={form.ministry} onChange={(e) => setForm({ ...form, ministry: e.target.value })} placeholder="Ministry of Law and Justice" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[80px] resize-none" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setFormOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving || !form.title}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {editing ? 'Save Changes' : 'Create Act'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
