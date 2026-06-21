import { useState, useRef } from 'react'
import { Upload, FileText, Loader2, CheckCircle, XCircle, Scale, BookOpen, Gavel, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import api from '../lib/api'
import { clsx } from 'clsx'

interface LawPoint {
  section: string
  title: string
  description: string
  category: string
}
interface CaseItem {
  title: string
  court: string
  year: number
  citation: string
  category: string
  summary: string
}
interface ActItem {
  title: string
  number: string
  year: number
  ministry: string
  category: string
  description: string
}

interface PipelineResult {
  filename: string
  doc_type: string
  summary: string
  stored: { law_points: number; cases: number; acts: number }
  law_points: LawPoint[]
  cases: CaseItem[]
  acts: ActItem[]
  raw_text_preview: string
  message: string
  ok: boolean
}

const DOC_TYPE_COLORS: Record<string, string> = {
  ipc_section:    'bg-red-500/20 text-red-300',
  bns_section:    'bg-orange-500/20 text-orange-300',
  landmark_case:  'bg-blue-500/20 text-blue-300',
  act:            'bg-purple-500/20 text-purple-300',
  legal_guide:    'bg-green-500/20 text-green-300',
  court_order:    'bg-cyan-500/20 text-cyan-300',
  mixed:          'bg-yellow-500/20 text-yellow-300',
  unknown:        'bg-gray-500/20 text-gray-400',
}

const ACCEPT_TYPES = '.pdf,.txt,.csv,.json'

function ResultCard({ result, onClear }: { result: PipelineResult; onClear: () => void }) {
  const [expandLaw, setExpandLaw] = useState(true)
  const [expandCases, setExpandCases] = useState(true)
  const [expandActs, setExpandActs] = useState(false)
  const [expandRaw, setExpandRaw] = useState(false)

  return (
    <div className="card border border-green-500/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-white/[0.08]">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <CheckCircle size={18} className="text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-200">{result.filename}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`badge text-[10px] ${DOC_TYPE_COLORS[result.doc_type] ?? DOC_TYPE_COLORS.unknown}`}>
                {result.doc_type.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-gray-500">{result.message}</span>
            </div>
          </div>
        </div>
        <button onClick={onClear} className="text-xs text-gray-600 hover:text-gray-300 transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/20">
          Clear
        </button>
      </div>

      {/* Summary */}
      {result.summary && (
        <div className="px-5 py-4 bg-surface-2/40 border-b border-white/[0.06]">
          <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wider">AI Summary</p>
          <p className="text-sm text-gray-300 leading-relaxed">{result.summary}</p>
        </div>
      )}

      {/* Stored stats */}
      <div className="grid grid-cols-3 gap-0 border-b border-white/[0.08]">
        {[
          { label: 'Law Points Stored', value: result.stored.law_points, color: 'text-red-400', icon: <Scale size={14} /> },
          { label: 'Cases Stored', value: result.stored.cases, color: 'text-blue-400', icon: <BookOpen size={14} /> },
          { label: 'Acts Stored', value: result.stored.acts, color: 'text-purple-400', icon: <BarChart3 size={14} /> },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="p-4 text-center border-r border-white/[0.08] last:border-r-0">
            <div className={`flex items-center justify-center gap-1 mb-1 ${color}`}>{icon}</div>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Law Points */}
      {result.law_points.length > 0 && (
        <div className="border-b border-white/[0.08]">
          <button
            className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-white/[0.02] transition-colors"
            onClick={() => setExpandLaw(e => !e)}
          >
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Scale size={12} className="text-red-400" /> Law Points ({result.law_points.length})
            </span>
            {expandLaw ? <ChevronUp size={14} className="text-gray-600" /> : <ChevronDown size={14} className="text-gray-600" />}
          </button>
          {expandLaw && (
            <div className="px-5 pb-4 space-y-2">
              {result.law_points.map((lp, i) => (
                <div key={i} className="p-3 bg-surface-2/60 rounded-lg border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge bg-red-500/20 text-red-300 text-[10px]">{lp.section || '—'}</span>
                    <span className="text-[10px] text-gray-500">{lp.category}</span>
                  </div>
                  <p className="text-xs font-medium text-gray-200 mb-0.5">{lp.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{lp.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cases */}
      {result.cases.length > 0 && (
        <div className="border-b border-white/[0.08]">
          <button
            className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-white/[0.02] transition-colors"
            onClick={() => setExpandCases(e => !e)}
          >
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen size={12} className="text-blue-400" /> Landmark Cases ({result.cases.length})
            </span>
            {expandCases ? <ChevronUp size={14} className="text-gray-600" /> : <ChevronDown size={14} className="text-gray-600" />}
          </button>
          {expandCases && (
            <div className="px-5 pb-4 space-y-2">
              {result.cases.map((c, i) => (
                <div key={i} className="p-3 bg-surface-2/60 rounded-lg border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold text-gray-200">{c.title}</span>
                    {c.year && <span className="text-[10px] text-gray-500">{c.year}</span>}
                    {c.citation && <span className="badge bg-blue-500/20 text-blue-300 text-[10px]">{c.citation}</span>}
                  </div>
                  {c.court && <p className="text-[10px] text-gray-500 mb-1">{c.court} · {c.category}</p>}
                  {c.summary && <p className="text-xs text-gray-500 leading-relaxed">{c.summary}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Acts */}
      {result.acts.length > 0 && (
        <div className="border-b border-white/[0.08]">
          <button
            className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-white/[0.02] transition-colors"
            onClick={() => setExpandActs(e => !e)}
          >
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 size={12} className="text-purple-400" /> Acts ({result.acts.length})
            </span>
            {expandActs ? <ChevronUp size={14} className="text-gray-600" /> : <ChevronDown size={14} className="text-gray-600" />}
          </button>
          {expandActs && (
            <div className="px-5 pb-4 space-y-2">
              {result.acts.map((a, i) => (
                <div key={i} className="p-3 bg-surface-2/60 rounded-lg border border-white/[0.06]">
                  <p className="text-xs font-semibold text-gray-200 mb-0.5">{a.title}</p>
                  {a.year && <p className="text-[10px] text-gray-500 mb-1">{a.year} · {a.ministry}</p>}
                  {a.description && <p className="text-xs text-gray-500 leading-relaxed">{a.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Raw text preview */}
      <div>
        <button
          className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-white/[0.02] transition-colors"
          onClick={() => setExpandRaw(e => !e)}
        >
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Raw Text Preview</span>
          {expandRaw ? <ChevronUp size={14} className="text-gray-600" /> : <ChevronDown size={14} className="text-gray-600" />}
        </button>
        {expandRaw && (
          <div className="px-5 pb-4">
            <pre className="text-[11px] text-gray-500 font-mono bg-surface-2/60 rounded-lg p-3 whitespace-pre-wrap break-words border border-white/[0.06] max-h-40 overflow-y-auto">
              {result.raw_text_preview || '(no text extracted)'}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Pipeline() {
  const [results, setResults] = useState<PipelineResult[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!['pdf', 'txt', 'csv', 'json'].includes(ext)) {
      toast.error('Supported: PDF, TXT, CSV, JSON')
      return
    }
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const r = await api.post('/pipeline/run', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const data: PipelineResult = r.data
      setResults(prev => [data, ...prev])
      if (data.ok) {
        toast.success(`Pipeline complete — ${data.stored.law_points + data.stored.cases + data.stored.acts} items stored`)
      } else {
        toast.error('Pipeline ran but stored 0 items')
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || 'Pipeline failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <PageHeader
        title="Legal Document Pipeline"
        description="Upload legal documents — IPC, BNS, landmark cases, acts. AI extracts and stores law points directly into the intelligence engine."
      />

      {/* Upload zone */}
      <div
        className={clsx(
          'card border-2 border-dashed p-8 mb-6 text-center cursor-pointer transition-all',
          dragOver ? 'border-brand-500 bg-brand-500/5' : 'border-white/10 hover:border-brand-500/40 hover:bg-white/[0.02]'
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => !uploading && fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept={ACCEPT_TYPES} className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
        <div className="flex flex-col items-center gap-3">
          {uploading ? (
            <>
              <Loader2 size={32} className="text-brand-400 animate-spin" />
              <div>
                <p className="text-sm font-semibold text-gray-200">Analysing document…</p>
                <p className="text-xs text-gray-500 mt-1">AI is classifying and extracting legal content</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-brand-600/20 flex items-center justify-center">
                <Upload size={24} className="text-brand-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-200">Drop a legal document or click to browse</p>
                <p className="text-xs text-gray-500 mt-1">PDF · TXT · CSV · JSON · Max 20 MB</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="card p-4 mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">How it works</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { n: '1', label: 'Extract Text', desc: 'From PDF, TXT, CSV or JSON' },
            { n: '2', label: 'AI Classify', desc: 'IPC · BNS · Case · Act · Guide' },
            { n: '3', label: 'Parse Content', desc: 'Sections, cases, citations' },
            { n: '4', label: 'Store to MongoDB', desc: 'Feeds intelligence engine' },
          ].map(({ n, label, desc }) => (
            <div key={n} className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-brand-600/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-brand-400">{n}</span>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-300">{label}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Analysis Results</p>
            <button onClick={() => setResults([])} className="text-xs text-gray-600 hover:text-gray-300 transition-colors">
              Clear all
            </button>
          </div>
          {results.map((r, i) => (
            <ResultCard key={i} result={r} onClear={() => setResults(prev => prev.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}

      {results.length === 0 && !uploading && (
        <div className="card p-12 text-center">
          <Upload size={32} className="mx-auto text-gray-700 mb-3" />
          <p className="text-gray-500 text-sm">No documents processed yet</p>
          <p className="text-gray-700 text-xs mt-1">Upload a PDF or text file to extract legal intelligence</p>
        </div>
      )}
    </div>
  )
}
