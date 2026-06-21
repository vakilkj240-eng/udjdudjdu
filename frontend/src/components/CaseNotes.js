import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check, Edit3, Loader2, Pin, PinOff, Plus, Save, Search,
  Sparkles, StickyNote, Tag, Trash2, X
} from 'lucide-react';
import API_URL from '../lib/api';

const priorities = ['Normal', 'High', 'Urgent', 'Low'];

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const priorityClass = {
  Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Normal: 'bg-stone-50 text-stone-700 border-stone-200',
  High: 'bg-[#D4AF37]/15 text-[#7A1023] border-[#D4AF37]/40',
  Urgent: 'bg-[#6D071A]/10 text-[#6D071A] border-[#6D071A]/30',
};

const CaseNotes = ({ caseId, compact = false }) => {
  const [notes, setNotes] = useState([]);
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [tags, setTags] = useState('');
  const [pinned, setPinned] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');

  const fetchNotes = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/cases/${caseId}/notes`);
      setNotes(data);
    } catch (err) {
      console.error('Failed to load case notes', err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchNotes();
    const interval = setInterval(fetchNotes, 15000);
    return () => clearInterval(interval);
  }, [fetchNotes]);

  const visibleNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(note =>
      note.content.toLowerCase().includes(q) ||
      note.author_name?.toLowerCase().includes(q) ||
      note.tags?.some(tag => tag.toLowerCase().includes(q))
    );
  }, [notes, search]);

  const createNote = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const tagList = tags.split(',').map(tag => tag.trim()).filter(Boolean);
      const { data } = await axios.post(`${API_URL}/api/cases/${caseId}/notes`, {
        content,
        pinned,
        priority,
        tags: tagList,
      });
      setNotes(prev => [data, ...prev].sort((a, b) => Number(b.pinned) - Number(a.pinned)));
      setContent('');
      setTags('');
      setPinned(false);
      setPriority('Normal');
    } finally {
      setSaving(false);
    }
  };

  const updateNote = async (noteId, patch) => {
    const { data } = await axios.patch(`${API_URL}/api/notes/${noteId}`, patch);
    setNotes(prev => prev.map(note => note.id === noteId ? data : note)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updated_at) - new Date(a.updated_at)));
    return data;
  };

  const deleteNote = async (noteId) => {
    if (!window.confirm('Delete this case note?')) return;
    await axios.delete(`${API_URL}/api/notes/${noteId}`);
    setNotes(prev => prev.filter(note => note.id !== noteId));
  };

  const saveDraft = async (noteId) => {
    await updateNote(noteId, { content: draft });
    setEditingId(null);
    setDraft('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#6D071A] text-white flex items-center justify-center shadow-lg shadow-[#6D071A]/20">
            <StickyNote className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#171717]">Case Notes</h3>
            <p className="text-xs text-stone-500">Shared quick-reference workspace</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search notes, tags, authors"
            className="w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 py-2 text-xs text-stone-800 outline-none transition focus:border-[#6D071A] focus:ring-4 focus:ring-[#6D071A]/10"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#FFFDF7] p-3 shadow-sm">
        <textarea
          value={content}
          onChange={event => setContent(event.target.value)}
          placeholder="Add a note visible to both parties..."
          rows={compact ? 2 : 3}
          className="w-full resize-none rounded-xl border border-[#E7D99A] bg-white px-3 py-2 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-[#6D071A] focus:ring-4 focus:ring-[#6D071A]/10"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={priority}
            onChange={event => setPriority(event.target.value)}
            className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs font-medium text-stone-700 outline-none focus:border-[#6D071A]"
          >
            {priorities.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <div className="flex min-w-[140px] flex-1 items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1.5">
            <Tag className="w-3.5 h-3.5 text-stone-400" />
            <input
              value={tags}
              onChange={event => setTags(event.target.value)}
              placeholder="tags, comma separated"
              className="w-full bg-transparent text-xs text-stone-700 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setPinned(v => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition hover:-translate-y-0.5 ${
              pinned ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#6D071A]' : 'border-stone-200 bg-white text-stone-600'
            }`}
          >
            <Pin className="w-3.5 h-3.5" />
            Pin
          </button>
          <button
            type="button"
            onClick={createNote}
            disabled={saving || !content.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#6D071A] px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-[#6D071A]/20 transition hover:-translate-y-0.5 hover:bg-[#800020] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add Note
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-[#6D071A]" />
        </div>
      ) : visibleNotes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-4 py-8 text-center">
          <Sparkles className="mx-auto mb-2 h-5 w-5 text-[#D4AF37]" />
          <p className="text-sm font-semibold text-stone-800">No notes yet</p>
          <p className="text-xs text-stone-500">Pin strategy points, hearing reminders, or document gaps here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <AnimatePresence initial={false}>
            {visibleNotes.map(note => (
              <motion.div
                key={note.id}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                className={`rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl ${
                  note.pinned ? 'border-[#D4AF37]/70 shadow-[#D4AF37]/10' : 'border-stone-200'
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-[#171717]">{note.author_name}</span>
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-500">{note.author_role}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${priorityClass[note.priority] || priorityClass.Normal}`}>
                        {note.priority}
                      </span>
                      {note.pinned && <span className="inline-flex items-center gap-1 rounded-full bg-[#D4AF37]/15 px-2 py-0.5 text-[10px] font-bold text-[#6D071A]"><Pin className="w-3 h-3" />Pinned</span>}
                    </div>
                    <p className="mt-1 text-[11px] text-stone-400">Updated {formatDate(note.updated_at || note.created_at)}</p>
                  </div>
                  {note.is_mine && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => updateNote(note.id, { pinned: !note.pinned })}
                        className="rounded-lg p-1.5 text-stone-400 transition hover:bg-[#D4AF37]/15 hover:text-[#6D071A]"
                        title={note.pinned ? 'Unpin note' : 'Pin note'}
                      >
                        {note.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => { setEditingId(note.id); setDraft(note.content); }}
                        className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-[#6D071A]"
                        title="Edit note"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="rounded-lg p-1.5 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {editingId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={draft}
                      onChange={event => setDraft(event.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#6D071A] focus:ring-4 focus:ring-[#6D071A]/10"
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-stone-600">
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                      <button onClick={() => saveDraft(note.id)} className="inline-flex items-center gap-1 rounded-lg bg-[#6D071A] px-2.5 py-1.5 text-xs font-semibold text-white">
                        <Save className="w-3.5 h-3.5" /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{note.content}</p>
                )}

                {note.tags?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {note.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-stone-50 px-2 py-1 text-[10px] font-semibold text-stone-500">
                        <Check className="w-3 h-3 text-[#D4AF37]" /> {tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default CaseNotes;
