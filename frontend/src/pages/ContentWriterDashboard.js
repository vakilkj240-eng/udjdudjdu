import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from '../components/Navbar';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PenLine, FileText, CheckCircle, Clock, IndianRupee, ChevronRight,
  Loader2, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Save,
  Send, Circle, BookOpen, Star, TrendingUp, User, Inbox, X, Plus
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import API_URL from '../lib/api';

const STATUS_CONFIG = {
  open: {
    label: 'Open',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  accepted: {
    label: 'In Progress',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  submitted: {
    label: 'Submitted',
    badge: 'bg-green-50 text-green-700 border-green-200',
    dot: 'bg-green-500',
  },
};

const fmt = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

const StatCard = ({ label, value, icon: Icon, color, sub }) => {
  const colors = {
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    slate: 'bg-slate-700',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color] || colors.slate}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};

const NewDraftModal = ({ onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) { toast.error('Please enter a title'); return; }
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/drafts`, { title: title.trim(), description: description.trim() });
      toast.success('Draft request created!');
      onCreated();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to create draft');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">New Draft Request</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Affidavit for name change"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe what document you need written..."
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Request
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const DraftEditor = ({ draft, onAccepted, onSubmitted, userId }) => {
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState(draft.body || '');
  const [accepting, setAccepting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const saveTimer = useRef(null);
  const cfg = STATUS_CONFIG[draft.status] || STATUS_CONFIG.open;
  const isMine = draft.legal_writer_id === userId;
  const isAccepted = draft.status === 'accepted' && isMine;
  const isSubmitted = draft.status === 'submitted';

  const handleBodyChange = (val) => {
    setBody(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => autoSave(val), 2000);
  };

  const autoSave = async (content) => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/draft/${draft.id}/body`, { body: content });
      setLastSaved(new Date());
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await axios.post(`${API_URL}/api/draft/${draft.id}/accept`);
      toast.success('Draft accepted! Start writing below.');
      setExpanded(true);
      onAccepted();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to accept draft');
    } finally {
      setAccepting(false);
    }
  };

  const handleSubmit = async () => {
    if (!body.trim()) { toast.error('Please write the draft content before submitting'); return; }
    setSubmitting(true);
    try {
      await axios.put(`${API_URL}/api/draft/${draft.id}/body`, { body });
      const { data } = await axios.post(`${API_URL}/api/draft/${draft.id}/submit`);
      toast.success(`Draft submitted! ₹${data.earnings_added} added to your earnings.`);
      onSubmitted();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to submit draft');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      layout
      className={`bg-white rounded-2xl border transition-all ${
        isAccepted ? 'border-amber-300 shadow-md' : 'border-slate-200'
      }`}
    >
      {/* Header */}
      <div
        className="p-5 flex items-start gap-4 cursor-pointer"
        onClick={() => !isSubmitted && setExpanded((e) => !e)}
      >
        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${cfg.badge}`}>
              {cfg.label}
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {fmt(draft.created_at)}
            </span>
            {isSubmitted && draft.submitted_at && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Submitted {fmt(draft.submitted_at)}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-slate-900 text-sm truncate">{draft.title}</h3>
          {draft.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{draft.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {draft.status === 'open' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleAccept(); }}
              disabled={accepting}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {accepting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Accept
            </button>
          )}
          {isAccepted && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded((e) => !e); }}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          )}
          {isSubmitted && (
            <CheckCircle className="w-5 h-5 text-green-500" />
          )}
        </div>
      </div>

      {/* Inline editor for accepted drafts */}
      <AnimatePresence>
        {isAccepted && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-amber-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700">Write the draft content</label>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  {saving ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>
                  ) : lastSaved ? (
                    <><Save className="w-3 h-3" /> Saved {lastSaved.toLocaleTimeString()}</>
                  ) : (
                    'Auto-saves as you type'
                  )}
                </span>
              </div>
              <textarea
                value={body}
                onChange={(e) => handleBodyChange(e.target.value)}
                rows={12}
                placeholder={`Write the full legal document here...\n\nInclude:\n- All relevant clauses\n- Proper legal language\n- Party details (use [PARTY NAME] as placeholders)\n- Date and signature sections`}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y font-mono leading-relaxed"
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-slate-400">{body.length} characters</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => autoSave(body)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" /> Save
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !body.trim()}
                    className="flex items-center gap-1.5 px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
                  >
                    {submitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Submit & Earn ₹{Number(100).toLocaleString()}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submitted body preview */}
      {isSubmitted && draft.body && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Submitted Content</p>
          <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
            {draft.body}
          </div>
        </div>
      )}
    </motion.div>
  );
};

const EmptyState = ({ tab }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
      {tab === 'available' ? (
        <Inbox className="w-8 h-8 text-slate-300" />
      ) : (
        <PenLine className="w-8 h-8 text-slate-300" />
      )}
    </div>
    <p className="font-medium text-slate-500">
      {tab === 'available'
        ? 'No open drafts right now'
        : "You haven't accepted any drafts yet"}
    </p>
    <p className="text-sm text-slate-400 mt-1">
      {tab === 'available'
        ? 'Check back soon — new document requests appear here as clients submit them.'
        : 'Browse the Available tab to find and accept draft requests.'}
    </p>
  </div>
);

export default function ContentWriterDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('available');
  const [showNewModal, setShowNewModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, draftsRes] = await Promise.all([
        axios.get(`${API_URL}/api/legal-writer/dashboard`),
        axios.get(`${API_URL}/api/drafts`),
      ]);
      setStats(dashRes.data.stats);
      setDrafts(draftsRes.data);
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (user.role !== 'legal_writer') { navigate('/'); return; }
    fetchData();
  }, [user, navigate, fetchData]);

  const availableDrafts = drafts.filter((d) => d.status === 'open');
  const myDrafts = drafts.filter(
    (d) => d.legal_writer_id === user?.id && d.status !== 'open'
  );

  const displayedDrafts = tab === 'available' ? availableDrafts : myDrafts;

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--theme-bg)', isolation: 'isolate' }}>
      <div aria-hidden="true" className="page-gold-pattern" style={{ position: 'fixed', inset: 0, zIndex: -1, backgroundImage: `url(${process.env.PUBLIC_URL}/gold-pattern.png)`, backgroundRepeat: 'repeat', backgroundSize: '320px 320px', opacity: 0.18, pointerEvents: 'none' }} />
      <div className="relative z-10">
      <Navbar />

      <AnimatePresence>
        {showNewModal && (
          <NewDraftModal
            onClose={() => setShowNewModal(false)}
            onCreated={fetchData}
          />
        )}
      </AnimatePresence>

      {/* Brand page header */}
      <div className="pt-2">
        <div className="px-6 py-8" style={{ background: 'linear-gradient(135deg, #7C1D2B 0%, #9b2335 55%, #4a1118 100%)' }}>
          <div className="max-w-5xl mx-auto flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(201,168,76,0.2)' }}>
                  <PenLine className="w-4.5 h-4.5" style={{ color: '#F0C84A' }} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(201,168,76,0.8)' }}>Writer Portal</span>
                  <span style={{ color: 'rgba(201,168,76,0.4)' }}>›</span>
                  <span className="text-xs font-semibold uppercase tracking-widest text-white/60">Dashboard</span>
                </div>
              </div>
              <h1 className="font-serif text-2xl font-bold text-white">Legal Writer Dashboard</h1>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Welcome back, <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{user?.name}</strong>. Accept draft requests and earn for every submission.
              </p>
            </div>
            <div className="flex gap-2 self-center">
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                style={{ background: 'rgba(201,168,76,0.2)', color: '#F0C84A', border: '1px solid rgba(201,168,76,0.35)', backdropFilter: 'blur(8px)' }}
              >
                <Plus className="w-4 h-4" /> New Request
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 h-24 animate-pulse" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Available Drafts"
              value={stats.open_drafts}
              icon={Inbox}
              color="blue"
              sub="Ready to accept"
            />
            <StatCard
              label="My Drafts"
              value={stats.my_drafts}
              icon={PenLine}
              color="amber"
              sub="In progress"
            />
            <StatCard
              label="Submitted"
              value={stats.submitted_drafts}
              icon={CheckCircle}
              color="green"
              sub="Completed"
            />
            <StatCard
              label="Earnings"
              value={`₹${Number(stats.earnings || 0).toLocaleString('en-IN')}`}
              icon={IndianRupee}
              color="slate"
              sub="Total earned"
            />
          </div>
        ) : null}

        {/* How it works banner */}
        {!loading && availableDrafts.length === 0 && myDrafts.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6 flex gap-4">
            <div className="flex-shrink-0">
              <BookOpen className="w-6 h-6 text-amber-600 mt-0.5" />
            </div>
            <div>
              <p className="font-semibold text-amber-900 mb-2">How Legal Writing Works</p>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { icon: Inbox, step: '1', text: 'Browse open draft requests from clients' },
                  { icon: PenLine, step: '2', text: 'Accept a draft, write the legal document' },
                  { icon: IndianRupee, step: '3', text: 'Submit to earn ₹100 per accepted draft' },
                ].map(({ icon: Icon, step, text }) => (
                  <div key={step} className="flex items-start gap-2">
                    <div className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-amber-800">
                      {step}
                    </div>
                    <p className="text-sm text-amber-800">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-200 rounded-xl p-1 mb-5 w-fit">
          {[
            { key: 'available', label: 'Available', count: availableDrafts.length, icon: Inbox },
            { key: 'mine', label: 'My Drafts', count: myDrafts.length, icon: PenLine },
          ].map(({ key, label, count, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {count > 0 && (
                <span
                  className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
                    tab === key ? 'bg-amber-100 text-amber-700' : 'bg-slate-300 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Draft list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 h-20 animate-pulse" />
            ))}
          </div>
        ) : displayedDrafts.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {displayedDrafts.map((draft, i) => (
                <motion.div
                  key={draft.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <DraftEditor
                    draft={draft}
                    onAccepted={fetchData}
                    onSubmitted={fetchData}
                    userId={user?.id}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Earnings milestone hint */}
        {stats && stats.submitted_drafts > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 bg-gradient-to-r from-amber-500 to-amber-400 rounded-2xl p-5 flex items-center gap-4"
          >
            <Star className="w-8 h-8 text-white flex-shrink-0" />
            <div className="text-white">
              <p className="font-bold">
                {stats.submitted_drafts} draft{stats.submitted_drafts !== 1 ? 's' : ''} submitted
              </p>
              <p className="text-amber-100 text-sm">
                You've earned ₹{Number(stats.earnings || 0).toLocaleString('en-IN')} so far. Keep writing to grow your earnings!
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-white/60 ml-auto flex-shrink-0" />
          </motion.div>
        )}
      </div>
      </div>
    </div>
  );
}
