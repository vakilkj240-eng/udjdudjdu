import { useEffect, useState } from 'react'
import { Search, Trash2, Pencil, Layers, Eye, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import { Table } from '../components/ui/Table'
import Modal from '../components/ui/Modal'
import { adminApi } from '../lib/api'

interface Chunk {
  id: string
  document_id: string
  document_title?: string
  content: string
  chunk_index: number
  embedding?: number[]
  metadata?: Record<string, unknown>
  created_at: string
}

export default function Chunks() {
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [viewChunk, setViewChunk] = useState<Chunk | null>(null)
  const [editChunk, setEditChunk] = useState<Chunk | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  function load(q?: string) {
    setLoading(true)
    const params = q ? { q, limit, offset: (page - 1) * limit } : { limit, offset: (page - 1) * limit }
    adminApi.getChunks(params)
      .then((r) => { setChunks(r.data.items ?? r.data); setTotal(r.data.total ?? 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (!search) load() }, [page, search])

  async function handleSearch() {
    if (!search.trim()) return load()
    setSearching(true)
    try {
      const r = await adminApi.searchChunks(search)
      setChunks(r.data.items ?? r.data)
      setTotal(r.data.total ?? 0)
    } catch {
      toast.error('Search failed')
    } finally {
      setSearching(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this chunk?')) return
    try {
      await adminApi.deleteChunk(id)
      toast.success('Deleted')
      setChunks((c) => c.filter((x) => x.id !== id))
    } catch {
      toast.error('Delete failed')
    }
  }

  async function handleSaveEdit() {
    if (!editChunk) return
    setSaving(true)
    try {
      await adminApi.updateChunk(editChunk.id, { content: editContent })
      toast.success('Saved')
      setChunks((c) => c.map((x) => x.id === editChunk.id ? { ...x, content: editContent } : x))
      setEditChunk(null)
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      key: 'chunk_index', label: '#',
      render: (r: Chunk) => <span className="badge bg-surface-2 text-gray-400">#{r.chunk_index}</span>
    },
    {
      key: 'document_title', label: 'Document',
      render: (r: Chunk) => <span className="text-xs text-brand-400 truncate max-w-[150px] block">{r.document_title || r.document_id}</span>
    },
    {
      key: 'content', label: 'Content',
      render: (r: Chunk) => <span className="text-gray-300 text-xs line-clamp-2 max-w-sm">{r.content}</span>
    },
    {
      key: 'embedding', label: 'Embedding',
      render: (r: Chunk) => r.embedding && r.embedding.length > 0
        ? <span className="badge bg-green-600/20 text-green-400">✓ {r.embedding.length}d</span>
        : <span className="badge bg-gray-600/20 text-gray-500">None</span>
    },
    {
      key: 'actions', label: '',
      render: (r: Chunk) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => setViewChunk(r)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-cyan-400 hover:bg-cyan-600/10 transition-colors">
            <Eye size={13} />
          </button>
          <button onClick={() => { setEditChunk(r); setEditContent(r.content) }}
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

  const pages = Math.ceil(total / limit)

  return (
    <div>
      <PageHeader
        title="Chunks"
        description={`${total.toLocaleString()} text chunks from processed documents`}
      />

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input className="input pl-9" placeholder="Semantic search chunks…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
        </div>
        <button className="btn-secondary" onClick={handleSearch} disabled={searching}>
          {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Search
        </button>
      </div>

      <Table columns={columns} data={chunks} loading={loading} keyExtractor={(r) => r.id} emptyMessage="No chunks found" />

      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
          <span>{total.toLocaleString()} total chunks</span>
          <div className="flex gap-1">
            <button className="btn-secondary py-1.5 px-3" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            <span className="px-3 py-1.5 bg-surface-2 rounded-lg border border-white/10">{page} / {pages}</span>
            <button className="btn-secondary py-1.5 px-3" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>›</button>
          </div>
        </div>
      )}

      {/* View Modal */}
      <Modal open={!!viewChunk} onClose={() => setViewChunk(null)} title={`Chunk #${viewChunk?.chunk_index}`} width="max-w-2xl">
        {viewChunk && (
          <div className="space-y-4">
            <div>
              <label className="label">Document</label>
              <p className="text-sm text-brand-400">{viewChunk.document_title || viewChunk.document_id}</p>
            </div>
            <div>
              <label className="label">Content</label>
              <div className="bg-surface-2 rounded-lg p-4 text-sm text-gray-300 max-h-60 overflow-y-auto border border-white/[0.08] leading-relaxed">
                {viewChunk.content}
              </div>
            </div>
            {viewChunk.embedding && viewChunk.embedding.length > 0 && (
              <div>
                <label className="label">Embedding ({viewChunk.embedding.length} dimensions)</label>
                <div className="bg-surface-2 rounded-lg p-3 text-xs text-gray-400 font-mono overflow-x-auto border border-white/[0.08]">
                  [{viewChunk.embedding.slice(0, 8).map(v => v.toFixed(4)).join(', ')}, …]
                </div>
              </div>
            )}
            {viewChunk.metadata && Object.keys(viewChunk.metadata).length > 0 && (
              <div>
                <label className="label">Metadata</label>
                <pre className="bg-surface-2 rounded-lg p-3 text-xs text-gray-400 overflow-x-auto border border-white/[0.08]">
                  {JSON.stringify(viewChunk.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editChunk} onClose={() => setEditChunk(null)} title="Edit Chunk" width="max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="label">Content</label>
            <textarea className="input min-h-[200px] resize-y font-mono text-xs leading-relaxed"
              value={editContent} onChange={(e) => setEditContent(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setEditChunk(null)}>Cancel</button>
            <button className="btn-primary" onClick={handleSaveEdit} disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
