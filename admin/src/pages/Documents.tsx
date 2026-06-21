import { useEffect, useState, useRef } from 'react'
import { Upload, Download, Trash2, Pencil, Search, FileText, Loader2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import { Table } from '../components/ui/Table'
import Modal from '../components/ui/Modal'
import { adminApi } from '../lib/api'
import { formatDistanceToNow } from 'date-fns'

interface Doc {
  id: string
  title: string
  source?: string
  file_type?: string
  chunk_count?: number
  created_at: string
  metadata?: Record<string, unknown>
}

export default function Documents() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editDoc, setEditDoc] = useState<Doc | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editSource, setEditSource] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const csvRef = useRef<HTMLInputElement>(null)

  function load() {
    setLoading(true)
    adminApi.getDocuments({ search }).then((r) => setDocs(r.data.items ?? r.data)).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      await adminApi.uploadDocument(fd)
      toast.success('Document uploaded')
      load()
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const r = await adminApi.importDocumentsCsv(fd)
      toast.success(`Imported ${r.data.imported} documents`)
      load()
    } catch {
      toast.error('CSV import failed')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this document and all its chunks?')) return
    try {
      await adminApi.deleteDocument(id)
      toast.success('Deleted')
      setDocs((d) => d.filter((x) => x.id !== id))
    } catch {
      toast.error('Delete failed')
    }
  }

  async function handleSaveEdit() {
    if (!editDoc) return
    setSaving(true)
    try {
      await adminApi.updateDocument(editDoc.id, { title: editTitle, source: editSource })
      toast.success('Saved')
      setDocs((d) => d.map((x) => x.id === editDoc.id ? { ...x, title: editTitle, source: editSource } : x))
      setEditDoc(null)
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      key: 'title', label: 'Title',
      render: (r: Doc) => (
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-brand-400 flex-shrink-0" />
          <span className="font-medium text-gray-200 truncate max-w-xs">{r.title}</span>
        </div>
      )
    },
    { key: 'source', label: 'Source', render: (r: Doc) => <span className="text-gray-400 text-xs">{r.source || '—'}</span> },
    {
      key: 'file_type', label: 'Type',
      render: (r: Doc) => r.file_type ? (
        <span className="badge bg-brand-600/20 text-brand-300">{r.file_type.toUpperCase()}</span>
      ) : <span className="text-gray-600">—</span>
    },
    { key: 'chunk_count', label: 'Chunks', render: (r: Doc) => <span className="text-gray-400">{r.chunk_count ?? 0}</span> },
    {
      key: 'created_at', label: 'Added',
      render: (r: Doc) => <span className="text-gray-500 text-xs">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
    },
    {
      key: 'actions', label: '',
      render: (r: Doc) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => { setEditDoc(r); setEditTitle(r.title); setEditSource(r.source ?? '') }}
            className="p-1.5 rounded-lg text-gray-500 hover:text-brand-400 hover:bg-brand-600/10 transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={() => handleDelete(r.id)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-600/10 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      )
    },
  ]

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Manage uploaded PDF documents and their metadata"
        actions={
          <>
            <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
            <button className="btn-secondary" onClick={() => csvRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Import CSV
            </button>
            <input ref={fileRef} type="file" accept=".pdf,.txt,.docx" className="hidden" onChange={handleUpload} />
            <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Upload PDF
            </button>
          </>
        }
      />

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input className="input pl-9" placeholder="Search documents…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Table columns={columns} data={docs} loading={loading} keyExtractor={(r) => r.id} emptyMessage="No documents yet — upload a PDF to get started" />

      <Modal open={!!editDoc} onClose={() => setEditDoc(null)} title="Edit Document">
        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">Source</label>
            <input className="input" value={editSource} onChange={(e) => setEditSource(e.target.value)} placeholder="e.g. Supreme Court of India" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setEditDoc(null)}>Cancel</button>
            <button className="btn-primary" onClick={handleSaveEdit} disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
