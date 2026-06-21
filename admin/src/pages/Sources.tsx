import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, Pencil, Download, Search, ExternalLink, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import { Table } from '../components/ui/Table'
import Modal from '../components/ui/Modal'
import { adminApi } from '../lib/api'
import { formatDistanceToNow } from 'date-fns'

interface Source {
  id: string
  name: string
  url?: string
  type?: string
  description?: string
  document_count?: number
  created_at: string
}

const emptyForm = { name: '', url: '', type: 'court', description: '' }

export default function Sources() {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Source | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const csvRef = useRef<HTMLInputElement>(null)

  function load() {
    setLoading(true)
    adminApi.getSources({ search }).then((r) => setSources(r.data.items ?? r.data)).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search])

  function openCreate() { setForm(emptyForm); setEditing(null); setFormOpen(true) }
  function openEdit(s: Source) { setForm({ name: s.name, url: s.url || '', type: s.type || 'court', description: s.description || '' }); setEditing(s); setFormOpen(true) }

  async function handleSave() {
    setSaving(true)
    try {
      if (editing) {
        await adminApi.updateSource(editing.id, form)
        setSources((s) => s.map((x) => x.id === editing.id ? { ...x, ...form } : x))
        toast.success('Source updated')
      } else {
        const r = await adminApi.createSource(form)
        setSources((s) => [r.data, ...s])
        toast.success('Source created')
      }
      setFormOpen(false)
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this source?')) return
    try {
      await adminApi.deleteSource(id)
      setSources((s) => s.filter((x) => x.id !== id))
      toast.success('Deleted')
    } catch {
      toast.error('Delete failed')
    }
  }

  async function handleCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setImporting(true)
    const fd = new FormData(); fd.append('file', file)
    try {
      const r = await adminApi.importSourcesCsv(fd)
      toast.success(`Imported ${r.data.imported} sources`); load()
    } catch { toast.error('Import failed') }
    finally { setImporting(false); e.target.value = '' }
  }

  const typeColors: Record<string, string> = {
    court: 'bg-amber-600/20 text-amber-400',
    legislation: 'bg-green-600/20 text-green-400',
    journal: 'bg-purple-600/20 text-purple-400',
    other: 'bg-gray-600/20 text-gray-400',
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r: Source) => <span className="font-medium text-gray-200">{r.name}</span> },
    {
      key: 'url', label: 'URL',
      render: (r: Source) => r.url
        ? <a href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-400 hover:text-brand-300 text-xs transition-colors">
            <ExternalLink size={11} />{new URL(r.url).hostname}
          </a>
        : <span className="text-gray-600">—</span>
    },
    {
      key: 'type', label: 'Type',
      render: (r: Source) => <span className={`badge ${typeColors[r.type || 'other'] ?? typeColors.other}`}>{r.type || 'other'}</span>
    },
    { key: 'document_count', label: 'Docs', render: (r: Source) => <span className="text-gray-400">{r.document_count ?? 0}</span> },
    {
      key: 'created_at', label: 'Added',
      render: (r: Source) => <span className="text-gray-500 text-xs">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
    },
    {
      key: 'actions', label: '',
      render: (r: Source) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-gray-500 hover:text-brand-400 hover:bg-brand-600/10 transition-colors"><Pencil size={13} /></button>
          <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-600/10 transition-colors"><Trash2 size={13} /></button>
        </div>
      )
    },
  ]

  return (
    <div>
      <PageHeader title="Sources" description="Legal data sources and publishers"
        actions={
          <>
            <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsv} />
            <button className="btn-secondary" onClick={() => csvRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Import CSV
            </button>
            <button className="btn-primary" onClick={openCreate}><Plus size={14} /> Add Source</button>
          </>
        }
      />

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input className="input pl-9" placeholder="Search sources…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Table columns={columns} data={sources} loading={loading} keyExtractor={(r) => r.id} emptyMessage="No sources yet" />

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Source' : 'Add Source'}>
        <div className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Supreme Court of India" />
          </div>
          <div>
            <label className="label">URL</label>
            <input className="input" type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="court">Court</option>
              <option value="legislation">Legislation</option>
              <option value="journal">Journal</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[80px] resize-none" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setFormOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving || !form.name}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {editing ? 'Save Changes' : 'Create Source'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
