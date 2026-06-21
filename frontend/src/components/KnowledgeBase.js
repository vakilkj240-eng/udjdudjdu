import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Upload, FileText, Trash2, Search, Database,
  CheckCircle, Loader2, RefreshCw, ChevronDown, ChevronUp,
  AlertCircle, File as FileIcon, X, PlusCircle
} from 'lucide-react';
import API_URL from '../lib/api';

const DOC_TYPES = ['judgment', 'act', 'section', 'circular', 'article', 'other'];
const DOMAINS = ['Criminal', 'Civil', 'Family', 'Property', 'Employment', 'Constitutional', 'Tax', 'Other'];

const KnowledgeBase = () => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    title: '',
    content: '',
    doc_type: 'judgment',
    domain: 'Civil',
    source: '',
    citation: '',
    year: new Date().getFullYear(),
  });

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/kb/documents`);
      setDocs(data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleFileRead = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      setForm(f => ({
        ...f,
        title: f.title || file.name.replace(/\.[^.]+$/, ''),
        content: text,
      }));
      setShowForm(true);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileRead(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setIngesting(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/ingest-document`, form);
      toast.success(`Ingested: ${data.chunk_count} chunks stored${data.embeddings_generated ? ' with embeddings' : ''}`);
      setForm({ title: '', content: '', doc_type: 'judgment', domain: 'Civil', source: '', citation: '', year: new Date().getFullYear() });
      setShowForm(false);
      fetchDocs();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ingest failed');
    } finally {
      setIngesting(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Delete this document and all its chunks?')) return;
    try {
      await axios.delete(`${API_URL}/api/kb/documents/${docId}`);
      toast.success('Document deleted');
      setDocs(prev => prev.filter(d => d.id !== docId));
    } catch {
      toast.error('Delete failed');
    }
  };

  const filtered = docs.filter(d =>
    !search ||
    (d.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.domain || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.doc_type || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6" data-testid="knowledge-base-panel">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2"
              style={{ color: 'var(--theme-text)' }}>
            <Database className="w-5 h-5" style={{ color: '#D4AF37' }} />
            Knowledge Base
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
            Paste or upload court judgments and acts to power AI-assisted legal analysis
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchDocs}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors"
            style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-muted)' }}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={() => setShowForm(f => !f)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all"
            style={{ background: '#7C1D2B', color: '#fff' }}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            {showForm ? 'Cancel' : 'Add Document'}
          </button>
        </div>
      </div>

      {/* Ingest Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit}
              className="rounded-2xl border p-6 space-y-4"
              style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
            >
              <h3 className="font-semibold text-sm" style={{ color: 'var(--theme-text)' }}>
                Ingest New Document
              </h3>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 flex items-center justify-center gap-3 cursor-pointer transition-colors ${
                  dragging ? 'border-[#D4AF37] bg-amber-50/20' : 'border-slate-300 dark:border-slate-600 hover:border-[#D4AF37]/60'
                }`}
              >
                <input ref={fileRef} type="file" className="hidden" accept=".txt,.pdf,.md,.doc,.docx"
                  onChange={e => { if (e.target.files[0]) handleFileRead(e.target.files[0]); }} />
                <Upload className="w-4 h-4 text-slate-400" />
                <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                  Drop a .txt / .md file, or <span className="text-[#D4AF37] font-semibold">browse</span> to import text
                </span>
              </div>

              {/* Row: Title + Year */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--theme-text-muted)' }}>Title *</label>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. State v. ABC (2023)"
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                    style={{ background: 'var(--theme-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--theme-text-muted)' }}>Year</label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                    style={{ background: 'var(--theme-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
                  />
                </div>
              </div>

              {/* Row: Type + Domain */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--theme-text-muted)' }}>Document Type</label>
                  <select
                    value={form.doc_type}
                    onChange={e => setForm(f => ({ ...f, doc_type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                    style={{ background: 'var(--theme-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
                  >
                    {DOC_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--theme-text-muted)' }}>Legal Domain</label>
                  <select
                    value={form.domain}
                    onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                    style={{ background: 'var(--theme-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
                  >
                    {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              {/* Citation / Source */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--theme-text-muted)' }}>Citation</label>
                  <input
                    value={form.citation}
                    onChange={e => setForm(f => ({ ...f, citation: e.target.value }))}
                    placeholder="e.g. AIR 2023 SC 123"
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                    style={{ background: 'var(--theme-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--theme-text-muted)' }}>Source / Authority</label>
                  <input
                    value={form.source}
                    onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                    placeholder="e.g. Supreme Court of India"
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                    style={{ background: 'var(--theme-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
                  />
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--theme-text-muted)' }}>
                  Full Text / Content *
                </label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Paste the full text of the judgment, act, or legal document here…"
                  rows={10}
                  className="w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#D4AF37] resize-y"
                  style={{ background: 'var(--theme-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
                  required
                />
                <p className="text-[11px] mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                  ~{Math.ceil((form.content.split(/\s+/).filter(Boolean).length) / 500)} chunk(s) • {form.content.length.toLocaleString()} characters
                </p>
              </div>

              <button
                type="submit"
                disabled={ingesting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-60"
                style={{ background: '#7C1D2B', color: '#fff' }}
              >
                {ingesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                {ingesting ? 'Ingesting…' : 'Ingest into Knowledge Base'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search documents…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
          style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
        />
      </div>

      {/* Document list */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-7 h-7 animate-spin text-slate-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border p-10 text-center"
             style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-surface)' }}>
          <Database className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="font-semibold text-sm" style={{ color: 'var(--theme-text)' }}>
            {search ? 'No documents match your search' : 'No documents ingested yet'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
            Add court judgments and acts above to power AI-driven case analysis
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(doc => {
            const isOpen = expandedDoc === doc.id;
            return (
              <motion.div
                key={doc.id}
                layout
                className="rounded-2xl border overflow-hidden transition-colors"
                style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
              >
                <div
                  className="px-5 py-4 flex items-start justify-between gap-3 cursor-pointer hover:bg-amber-50/10 transition-colors"
                  onClick={() => setExpandedDoc(isOpen ? null : doc.id)}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                         style={{ background: 'rgba(212,175,55,0.12)' }}>
                      <FileText className="w-4 h-4" style={{ color: '#D4AF37' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--theme-text)' }}>{doc.title}</p>
                      <div className="flex items-center flex-wrap gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: 'rgba(124,29,43,0.1)', color: '#7C1D2B' }}>
                          {(doc.doc_type || 'other').toUpperCase()}
                        </span>
                        {doc.domain && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                style={{ background: 'rgba(212,175,55,0.12)', color: '#A08020' }}>
                            {doc.domain}
                          </span>
                        )}
                        {doc.citation && (
                          <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>{doc.citation}</span>
                        )}
                        <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                          {doc.chunk_count || 0} chunk{doc.chunk_count !== 1 ? 's' : ''}
                          {doc.has_embeddings ? ' · ✨ vectors' : ''}
                        </span>
                        {doc.ingested_at && (
                          <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                            {new Date(doc.ingested_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={ev => { ev.stopPropagation(); handleDelete(doc.id); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4 border-t"
                           style={{ borderColor: 'var(--theme-border)' }}>
                        {doc.preview && (
                          <pre className="mt-3 text-xs rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-40 font-mono leading-relaxed"
                               style={{ background: 'var(--theme-bg)', color: 'var(--theme-text-muted)' }}>
                            {doc.preview}
                          </pre>
                        )}
                        {doc.source && (
                          <p className="text-xs mt-2" style={{ color: 'var(--theme-text-muted)' }}>
                            <strong>Source:</strong> {doc.source}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Stats footer */}
      {docs.length > 0 && (
        <div className="flex items-center gap-6 pt-2 border-t"
             style={{ borderColor: 'var(--theme-border)' }}>
          <div className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--theme-text)' }}>{docs.length}</span> document{docs.length !== 1 ? 's' : ''}
          </div>
          <div className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--theme-text)' }}>
              {docs.reduce((a, d) => a + (d.chunk_count || 0), 0)}
            </span> total chunks
          </div>
          <div className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            <span className="font-semibold" style={{ color: '#D4AF37' }}>
              {docs.filter(d => d.has_embeddings).length}
            </span> with vector embeddings
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
