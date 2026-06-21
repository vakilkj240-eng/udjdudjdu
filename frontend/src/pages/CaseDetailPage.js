import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import CaseChat from '../components/CaseChat';
import CaseNotes from '../components/CaseNotes';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import API_URL from '../lib/api';
import {
  ArrowLeft, Shield, MapPin, Calendar, Clock, DollarSign,
  CheckCircle, Circle, AlertCircle, MessageCircle, Radio,
  User, FileText, Loader2, ChevronDown, ChevronUp, Info,
  Gavel, Scale, Search, BookOpen, HelpCircle,
  Upload, Download, Trash2, Paperclip, File as FileIcon, Image, X,
  Plus, Flag, Copy, Check, Link2
} from 'lucide-react';

// ─── File type helpers ────────────────────────────────────────────────────────
function extIcon(ext) {
  const e = (ext || '').toLowerCase();
  if (['.png', '.jpg', '.jpeg'].includes(e)) return Image;
  return FileIcon;
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Documents panel (used in CaseDetailPage) ─────────────────────────────────
const DocumentsPanel = ({ caseId, currentUserId, isLawyer = false }) => {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const inputRef = useRef(null);

  const fetchDocs = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/cases/${caseId}/documents`);
      setDocs(data);
    } catch {} finally { setLoadingDocs(false); }
  }, [caseId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const uploadFile = async (file) => {
    if (!file) return;
    const allowed = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.txt', '.xlsx', '.xls'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) { alert(`File type not allowed: ${ext}`); return; }
    if (file.size > 10 * 1024 * 1024) { alert('File too large (max 10 MB)'); return; }
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await axios.post(`${API_URL}/api/cases/${caseId}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDocs(prev => [...prev, data]);
    } catch (err) {
      alert(err.response?.data?.detail || 'Upload failed');
    } finally { setUploading(false); }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await axios.delete(`${API_URL}/api/documents/${docId}`);
      setDocs(prev => prev.filter(d => d.id !== docId));
    } catch (err) { alert(err.response?.data?.detail || 'Delete failed'); }
  };

  const handleDownload = async (docId, name) => {
    try {
      const res = await axios.get(`${API_URL}/api/documents/${docId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = name; a.click();
      window.URL.revokeObjectURL(url);
    } catch { alert('Download failed'); }
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl px-4 py-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
          dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
        }`}
      >
        <input ref={inputRef} type="file" className="hidden"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,.xlsx,.xls"
          onChange={e => { if (e.target.files[0]) uploadFile(e.target.files[0]); e.target.value = ''; }}
        />
        {uploading ? (
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        ) : (
          <Upload className="w-6 h-6 text-slate-400" />
        )}
        <p className="text-xs font-medium text-slate-500 text-center">
          {uploading ? 'Uploading…' : 'Drop a file here or click to upload'}
        </p>
        <p className="text-[10px] text-slate-400">PDF, DOC, DOCX, PNG, JPG, TXT, XLSX · max 10 MB</p>
      </div>

      {/* File list */}
      {loadingDocs ? (
        <div className="flex justify-center py-3"><Loader2 className="w-5 h-5 text-slate-300 animate-spin" /></div>
      ) : docs.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3">No documents attached yet</p>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => {
            const Icon = extIcon(doc.extension);
            const isOwner = doc.uploader_id === currentUserId;
            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl px-3 py-2.5 hover:border-indigo-200 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{doc.original_name}</p>
                  <p className="text-[10px] text-slate-400">
                    {fmtSize(doc.size_bytes)} · {doc.uploader_name}
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      doc.uploader_role === 'lawyer' ? 'bg-violet-100 text-violet-600' : 'bg-blue-100 text-blue-600'
                    }`}>{doc.uploader_role}</span>
                    · {doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleDownload(doc.id, doc.original_name)}
                    className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-indigo-50 flex items-center justify-center transition-colors"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500 hover:text-indigo-600" />
                  </button>
                  {isOwner && (
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-red-50 flex items-center justify-center transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Pipeline definition ──────────────────────────────────────────────────────
const PIPELINE = [
  {
    key: 'submitted',
    label: 'Case Submitted',
    icon: FileText,
    color: 'blue',
    what_to_expect: 'Your case has been received by the platform. Our system will now review and analyse it.',
    client_action: null,
  },
  {
    key: 'analyzed',
    label: 'AI Analysis Complete',
    icon: Search,
    color: 'violet',
    what_to_expect: 'Our AI engine has analysed your case, assessed the risk level, and identified relevant laws and precedents.',
    client_action: 'Review your AI-generated case summary and NyayID from the case list.',
  },
  {
    key: 'open',
    label: 'Open for Lawyers',
    icon: BookOpen,
    color: 'sky',
    what_to_expect: 'Your case is now visible to qualified lawyers on our platform. Lawyers matching your case type and location can accept it.',
    client_action: 'You may also browse and directly contact lawyers from the Find Lawyers page.',
  },
  {
    key: 'accepted',
    label: 'Lawyer Assigned',
    icon: User,
    color: 'emerald',
    what_to_expect: 'A lawyer has accepted your case. They will review your situation and reach out if they need more information.',
    client_action: 'Use the chat feature to introduce yourself and share any additional documents.',
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    icon: Scale,
    color: 'amber',
    what_to_expect: 'Your lawyer is actively working on your case — researching, drafting documents, and preparing strategy.',
    client_action: 'Respond promptly to any messages from your lawyer. Keep all relevant documents accessible.',
  },
  {
    key: 'awaiting_documents',
    label: 'Documents Needed',
    icon: AlertCircle,
    color: 'orange',
    what_to_expect: 'Your lawyer requires additional documents or information to proceed with the case.',
    client_action: 'Upload or share the requested documents with your lawyer via the chat immediately.',
  },
  {
    key: 'in_court',
    label: 'In Court',
    icon: Gavel,
    color: 'red',
    what_to_expect: 'Your case is now being argued before a court. Your lawyer is representing you in proceedings.',
    client_action: 'Attend all court hearings as instructed. Follow your lawyer\'s guidance strictly.',
  },
  {
    key: 'completed',
    label: 'Resolved',
    icon: CheckCircle,
    color: 'green',
    what_to_expect: 'Your case has been successfully resolved. All legal proceedings are complete.',
    client_action: 'Leave a review for your lawyer to help other clients on the platform.',
  },
];

const ALIAS_MAP = {
  'in-progress': 'in_progress',
  'inprogress': 'in_progress',
  'awaiting documents': 'awaiting_documents',
  'closed': 'completed',
  'resolved': 'completed',
};

function normalize(s) {
  if (!s) return 'submitted';
  const l = s.toLowerCase().replace(/-/g, '_');
  return ALIAS_MAP[l] || l;
}

function stageIdx(status) {
  const n = normalize(status);
  const i = PIPELINE.findIndex(p => p.key === n);
  return i === -1 ? 0 : i;
}

const COLORS = {
  blue:    { bg: 'bg-blue-500',    ring: 'ring-4 ring-blue-100',    text: 'text-blue-700',    light: 'bg-blue-50 border-blue-200',    bar: 'from-blue-400'    },
  violet:  { bg: 'bg-violet-500',  ring: 'ring-4 ring-violet-100',  text: 'text-violet-700',  light: 'bg-violet-50 border-violet-200',  bar: 'from-violet-400'  },
  sky:     { bg: 'bg-sky-500',     ring: 'ring-4 ring-sky-100',     text: 'text-sky-700',     light: 'bg-sky-50 border-sky-200',     bar: 'from-sky-400'     },
  emerald: { bg: 'bg-emerald-500', ring: 'ring-4 ring-emerald-100', text: 'text-emerald-700', light: 'bg-emerald-50 border-emerald-200', bar: 'from-emerald-400' },
  amber:   { bg: 'bg-amber-500',   ring: 'ring-4 ring-amber-100',   text: 'text-amber-700',   light: 'bg-amber-50 border-amber-200',   bar: 'from-amber-400'   },
  orange:  { bg: 'bg-orange-500',  ring: 'ring-4 ring-orange-100',  text: 'text-orange-700',  light: 'bg-orange-50 border-orange-200',  bar: 'from-orange-400'  },
  red:     { bg: 'bg-red-500',     ring: 'ring-4 ring-red-100',     text: 'text-red-700',     light: 'bg-red-50 border-red-200',     bar: 'from-red-400'     },
  green:   { bg: 'bg-green-500',   ring: 'ring-4 ring-green-100',   text: 'text-green-700',   light: 'bg-green-50 border-green-200',   bar: 'from-green-400'   },
};

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const LiveDot = () => (
  <span className="flex items-center gap-1.5">
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
    </span>
    <span className="text-[10px] font-bold uppercase tracking-widest text-green-600">Live</span>
  </span>
);

// ─── Main page ────────────────────────────────────────────────────────────────
const CaseDetailPage = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef(null);

  const [caseData, setCaseData] = useState(null);
  const [liveStatus, setLiveStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [justUpdated, setJustUpdated] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [expandedGuide, setExpandedGuide] = useState(true);
  const [timeline, setTimeline] = useState([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', date: '', type: 'milestone' });
  const [addingEvent, setAddingEvent] = useState(false);
  const [nyayCopied, setNyayCopied] = useState(false);
  const prevStatusRef = useRef(null);

  // Fetch base case from the role-specific case list.
  const fetchCase = useCallback(async () => {
    try {
      const endpoint = user?.role === 'lawyer' ? '/api/lawyer/dashboard' : '/api/my-cases';
      const { data } = await axios.get(`${API_URL}${endpoint}`);
      const found = data.find(c => c.id === caseId);
      if (found) setCaseData(found);
    } catch {}
    finally { setLoading(false); }
  }, [caseId, user?.role]);

  // Poll live status
  const pollStatus = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/cases/${caseId}/status`);
      setLiveStatus(data);
      if (prevStatusRef.current && prevStatusRef.current !== data.case_status) {
        setJustUpdated(true);
        setTimeout(() => setJustUpdated(false), 5000);
      }
      prevStatusRef.current = data.case_status;
    } catch {}
  }, [caseId]);

  const fetchTimeline = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/cases/${caseId}/timeline`);
      setTimeline(Array.isArray(data) ? data : (data?.timeline_events || []));
    } catch {}
  }, [caseId]);

  const addTimelineEvent = async () => {
    if (!newEvent.title.trim()) return;
    setAddingEvent(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/cases/${caseId}/timeline`, {
        ...newEvent, added_by: user?.name || 'Client',
      });
      setTimeline(prev => [...prev, data]);
      setNewEvent({ title: '', description: '', date: '', type: 'milestone' });
      setShowAddEvent(false);
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to add event');
    } finally { setAddingEvent(false); }
  };

  const toggleEventDone = async (eventId, currentDone) => {
    try {
      await axios.patch(`${API_URL}/api/cases/${caseId}/timeline/${eventId}`, { completed: !currentDone });
      setTimeline(prev => prev.map(e => e.id === eventId ? { ...e, completed: !currentDone } : e));
    } catch {}
  };

  const deleteTimelineEvent = async (eventId) => {
    if (!window.confirm('Remove this event?')) return;
    try {
      await axios.delete(`${API_URL}/api/cases/${caseId}/timeline/${eventId}`);
      setTimeline(prev => prev.filter(e => e.id !== eventId));
    } catch {}
  };

  const copyNyayLink = () => {
    const nyayId = caseData?.nyayId || caseData?.nyay_id;
    if (!nyayId) return;
    navigator.clipboard.writeText(`${window.location.origin}/case/${nyayId}`);
    setNyayCopied(true);
    setTimeout(() => setNyayCopied(false), 2500);
  };

  useEffect(() => { fetchCase(); }, [fetchCase]);
  useEffect(() => {
    pollStatus();
    const iv = setInterval(pollStatus, 15000);
    return () => clearInterval(iv);
  }, [pollStatus]);
  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-10 h-10 text-slate-300 animate-spin" />
        </div>
      </div>
    );
  }

  if (!caseData && !liveStatus) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-24 text-center">
          <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Case not found</h2>
          <p className="text-sm text-slate-500 mb-6">This case doesn't exist or doesn't belong to your account.</p>
          <button onClick={() => navigate('/client/cases')} className="text-sm bg-slate-900 text-white px-5 py-2.5 rounded-xl">
            Back to My Cases
          </button>
        </div>
      </div>
    );
  }

  const currentStatus = liveStatus?.case_status || caseData?.case_status || 'submitted';
  const statusHistory = liveStatus?.status_history || caseData?.status_history || [];
  const lawyerName = liveStatus?.lawyer_name || caseData?.lawyer_name;
  const updatedAt = liveStatus?.updated_at;
  const currentIdx = stageIdx(currentStatus);
  const pct = Math.round(((currentIdx + 1) / PIPELINE.length) * 100);
  const currentStage = PIPELINE[currentIdx];
  const nextStage = PIPELINE[currentIdx + 1] || null;
  const currentColors = COLORS[currentStage.color];

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back button */}
        <button
          onClick={() => navigate(user?.role === 'lawyer' ? '/lawyer/dashboard' : '/client/cases')}
          className="flex items-center gap-2 text-sm text-stone-500 hover:text-[#6D071A] mb-6 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to {user?.role === 'lawyer' ? 'Dashboard' : 'My Cases'}
        </button>

        {/* ── Hero Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-[1.4rem] overflow-hidden shadow-2xl shadow-[#6D071A]/10 mb-6 border border-[#EFE7D6] ${justUpdated ? 'ring-2 ring-[#D4AF37]' : ''}`}
        >
          {/* Gradient header */}
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.26),transparent_30%),linear-gradient(135deg,#6D071A,#800020)] px-6 pt-6 pb-10">
            <AnimatePresence>
              {justUpdated && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mb-3 flex items-center gap-2 bg-amber-400/30 border border-amber-300/40 rounded-xl px-3 py-2"
                >
                  <Radio className="w-4 h-4 text-amber-200 animate-pulse" />
                  <span className="text-sm font-semibold text-amber-100">Status just updated!</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h1 className="text-2xl font-bold text-white">
                    {caseData?.case_type || 'Legal'} Case
                  </h1>
                  {(caseData?.nyayId || caseData?.nyay_id) && (
                    <button
                      onClick={copyNyayLink}
                      className="inline-flex items-center gap-1 bg-white/20 hover:bg-white/35 text-white text-xs font-mono font-bold px-2.5 py-1 rounded-full transition-all"
                      title="Copy public tracker link"
                    >
                      <Shield className="w-3 h-3" />
                      {caseData.nyayId || caseData.nyay_id}
                      {nyayCopied ? <Check className="w-3 h-3 text-green-300" /> : <Copy className="w-3 h-3 opacity-50" />}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
                  {caseData?.location && (
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{caseData.location}</span>
                  )}
                  {caseData?.created_at && (
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Filed {fmtDate(caseData.created_at)}</span>
                  )}
                  {caseData?.urgency && (
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{caseData.urgency} urgency</span>
                  )}
                  {caseData?.budget && (
                    <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />₹{caseData.budget}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <LiveDot />
                {updatedAt && (
                  <span className="text-xs text-white/50">Updated {timeAgo(updatedAt)}</span>
                )}
              </div>
            </div>
          </div>

          {/* Progress row */}
          <div className="bg-white px-6 -mt-5 pt-6 pb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${currentColors.text}`}>{currentStage.label}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${currentColors.light}`}>
                  Stage {currentIdx + 1} of {PIPELINE.length}
                </span>
              </div>
              <span className="text-sm font-bold text-slate-700">{pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${currentColors.bar} to-emerald-500`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>

            {/* Case description snippet */}
            {caseData?.description && (
              <p className="mt-4 text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 line-clamp-3">
                {caseData.description}
              </p>
            )}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Main Timeline ── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Current stage guidance card */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`rounded-2xl border p-5 ${currentColors.light}`}
            >
              <button
                onClick={() => setExpandedGuide(v => !v)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Info className={`w-4 h-4 ${currentColors.text}`} />
                  <span className={`text-sm font-semibold ${currentColors.text}`}>
                    What's happening now — {currentStage.label}
                  </span>
                </div>
                {expandedGuide
                  ? <ChevronUp className={`w-4 h-4 ${currentColors.text}`} />
                  : <ChevronDown className={`w-4 h-4 ${currentColors.text}`} />}
              </button>
              <AnimatePresence initial={false}>
                {expandedGuide && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="mt-3 text-sm text-slate-700 leading-relaxed">
                      {currentStage.what_to_expect}
                    </p>
                    {currentStage.client_action && (
                      <div className="mt-3 flex items-start gap-2 bg-white/70 rounded-xl px-3 py-2.5 border border-white/50">
                        <CheckCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${currentColors.text}`} />
                        <p className="text-sm font-medium text-slate-800">{currentStage.client_action}</p>
                      </div>
                    )}
                    {nextStage && (
                      <p className="mt-3 text-xs text-slate-500">
                        <span className="font-semibold">Next:</span> {nextStage.label} — {nextStage.what_to_expect.slice(0, 80)}…
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Full timeline */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
            >
              <h2 className="text-sm font-semibold text-slate-700 mb-5 flex items-center gap-2">
                <Scale className="w-4 h-4 text-slate-400" />
                Full Case Timeline
              </h2>

              <div className="space-y-0">
                {PIPELINE.map((stage, i) => {
                  const isDone = i < currentIdx;
                  const isCurrent = i === currentIdx;
                  const isPending = i > currentIdx;
                  const cls = COLORS[stage.color];
                  const Icon = stage.icon;
                  const histEntry = statusHistory.find(h => normalize(h.status) === stage.key);

                  return (
                    <motion.div
                      key={stage.key}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i }}
                      className="flex gap-4"
                    >
                      {/* Icon + connector */}
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                          isDone    ? 'bg-green-500'
                          : isCurrent ? `${cls.bg} ${cls.ring}`
                          : 'bg-slate-100'
                        }`}>
                          {isDone ? (
                            <CheckCircle className="w-4 h-4 text-white" />
                          ) : (
                            <Icon className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-slate-300'}`} />
                          )}
                        </div>
                        {i < PIPELINE.length - 1 && (
                          <div className={`w-0.5 my-1 flex-1 ${isDone ? 'bg-green-200' : 'bg-slate-100'}`}
                            style={{ minHeight: 24 }} />
                        )}
                      </div>

                      {/* Content */}
                      <div className={`flex-1 pb-5 ${i === PIPELINE.length - 1 ? 'pb-0' : ''}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-semibold ${
                            isDone ? 'text-green-700'
                            : isCurrent ? cls.text
                            : 'text-slate-400'
                          }`}>
                            {stage.label}
                          </p>
                          {isCurrent && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${cls.light}`}>
                              Current
                            </span>
                          )}
                          {isPending && i === currentIdx + 1 && (
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                              Up next
                            </span>
                          )}
                        </div>

                        {/* History entry details */}
                        {histEntry ? (
                          <div className="mt-1.5 space-y-1">
                            {histEntry.notes && histEntry.notes !== 'Status updated by lawyer' && (
                              <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100 italic">
                                "{histEntry.notes}"
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                              {histEntry.updated_by && (
                                <span className="flex items-center gap-1">
                                  <User className="w-2.5 h-2.5" />{histEntry.updated_by}
                                </span>
                              )}
                              {histEntry.timestamp && (
                                <span>{fmtDate(histEntry.timestamp)}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          !isCurrent && !isPending && null
                        )}

                        {/* Pending stages show brief expectation */}
                        {isPending && (
                          <p className="mt-1 text-xs text-slate-400 line-clamp-1">
                            {stage.what_to_expect.slice(0, 72)}…
                          </p>
                        )}

                        {/* Current stage guidance inline */}
                        {isCurrent && (
                          <p className="mt-1 text-xs text-slate-500">
                            {stage.what_to_expect}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* ── Milestone & Deadline Tracker ── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Flag className="w-4 h-4 text-slate-400" />
                  Milestones &amp; Deadlines
                </h2>
                <button
                  onClick={() => setShowAddEvent(v => !v)}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
                  style={{ background: showAddEvent ? '#7C1D2B' : '#F1F5F9', color: showAddEvent ? 'white' : '#374151' }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {showAddEvent ? 'Cancel' : 'Add Event'}
                </button>
              </div>

              <AnimatePresence>
                {showAddEvent && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mb-4"
                  >
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                      <input
                        type="text"
                        placeholder="Event title *"
                        value={newEvent.title}
                        onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))}
                        className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C1D2B]/30"
                      />
                      <div className="flex gap-2">
                        <select
                          value={newEvent.type}
                          onChange={e => setNewEvent(p => ({ ...p, type: e.target.value }))}
                          className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none"
                        >
                          <option value="milestone">Milestone</option>
                          <option value="deadline">Deadline</option>
                          <option value="hearing">Hearing</option>
                          <option value="filing">Filing</option>
                        </select>
                        <input
                          type="date"
                          value={newEvent.date}
                          onChange={e => setNewEvent(p => ({ ...p, date: e.target.value }))}
                          className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Notes (optional)"
                        value={newEvent.description}
                        onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))}
                        className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C1D2B]/30"
                      />
                      <button
                        onClick={addTimelineEvent}
                        disabled={!newEvent.title.trim() || addingEvent}
                        className="w-full py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                        style={{ background: '#7C1D2B' }}
                      >
                        {addingEvent ? 'Adding…' : 'Save Event'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {timeline.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Flag className="w-8 h-8 mx-auto mb-2 opacity-25" />
                  <p className="text-sm font-medium">No milestones added yet</p>
                  <p className="text-xs mt-1">Track hearings, deadlines, and key case milestones</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {timeline.map(event => {
                    const TC = {
                      milestone: 'bg-purple-100 text-purple-700',
                      deadline:  'bg-red-100 text-red-700',
                      hearing:   'bg-amber-100 text-amber-700',
                      filing:    'bg-blue-100 text-blue-700',
                    };
                    const isOverdue = event.date && !event.completed && new Date(event.date) < new Date();
                    const isSoon = event.date && !event.completed && !isOverdue &&
                      (new Date(event.date) - new Date() < 7 * 24 * 3600 * 1000);
                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                          event.completed ? 'bg-slate-50 border-slate-100 opacity-60' :
                          isOverdue ? 'bg-red-50 border-red-200' :
                          isSoon ? 'bg-amber-50 border-amber-200' :
                          'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <button onClick={() => toggleEventDone(event.id, event.completed)} className="mt-0.5 flex-shrink-0">
                          {event.completed
                            ? <CheckCircle className="w-4 h-4 text-green-500" />
                            : <Circle className="w-4 h-4 text-slate-300 hover:text-slate-500 transition-colors" />
                          }
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-semibold ${event.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                              {event.title}
                            </p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${TC[event.type] || TC.milestone}`}>
                              {event.type}
                            </span>
                            {isOverdue && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">OVERDUE</span>}
                            {isSoon && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white">SOON</span>}
                          </div>
                          {event.description && <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>}
                          {event.date && (
                            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5" />
                              {new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                        <button onClick={() => deleteTimelineEvent(event.id)} className="flex-shrink-0 text-slate-200 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-4">
            {/* Lawyer card */}
            {lawyerName ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"
              >
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Assigned Lawyer
                </h3>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white font-bold text-lg">
                    {lawyerName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{lawyerName}</p>
                    <p className="text-xs text-slate-500">{caseData?.case_type} Specialist</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowChat(v => !v)}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    showChat
                      ? 'bg-slate-900 text-white'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  {showChat ? 'Close Chat' : 'Message Lawyer'}
                </button>
                <AnimatePresence>
                  {showChat && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mt-3"
                    >
                      <CaseChat
                        caseId={caseId}
                        currentUserId={user?.id}
                        currentUserName={user?.name}
                        otherPartyName={lawyerName}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-amber-50 border border-amber-200 rounded-2xl p-5"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">No lawyer assigned yet</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Your case is open for lawyers to accept. You'll be notified when one is assigned.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Quick stats */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3"
            >
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Case Details</h3>
              {[
                { label: 'Case Type', value: caseData?.case_type, icon: FileText },
                { label: 'Location', value: caseData?.location, icon: MapPin },
                { label: 'Urgency', value: caseData?.urgency, icon: Clock },
                { label: 'Budget', value: caseData?.budget ? `₹${caseData.budget}` : null, icon: DollarSign },
                { label: 'NyayID', value: caseData?.nyayId || caseData?.nyay_id, icon: Shield },
              ].filter(r => r.value).map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-medium">{label}</p>
                    <p className="text-xs font-semibold text-slate-800 truncate">{value}</p>
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Progress summary */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"
            >
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Progress Summary</h3>
              <div className="flex items-center gap-3 mb-3">
                <div className="relative w-14 h-14 flex-shrink-0">
                  <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r="22" fill="none" stroke="#f1f5f9" strokeWidth="6" />
                    <motion.circle
                      cx="28" cy="28" r="22" fill="none"
                      stroke={currentColors.bg.replace('bg-', '').includes('500') ? '#22c55e' : '#6366f1'}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 22}`}
                      initial={{ strokeDashoffset: 2 * Math.PI * 22 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 22 * (1 - pct / 100) }}
                      transition={{ duration: 1.2, ease: 'easeOut' }}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-800">{pct}%</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{currentStage.label}</p>
                  <p className="text-xs text-slate-500">Stage {currentIdx + 1} of {PIPELINE.length}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {PIPELINE.length - currentIdx - 1} stage{PIPELINE.length - currentIdx - 1 !== 1 ? 's' : ''} remaining
                  </p>
                </div>
              </div>
              {nextStage && (
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                  <Circle className="w-3 h-3 text-slate-300 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-400">Next stage</p>
                    <p className="text-xs font-medium text-slate-700">{nextStage.label}</p>
                  </div>
                </div>
              )}
            </motion.div>
            {/* ── Documents Panel ── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.34 }}
              className="bg-white rounded-2xl border border-[#EFE7D6] shadow-sm p-5"
            >
              <CaseNotes caseId={caseId} compact />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <button
                onClick={() => setShowDocs(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-semibold text-slate-800">Documents &amp; Files</span>
                </div>
                {showDocs
                  ? <ChevronUp className="w-4 h-4 text-slate-400" />
                  : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              <AnimatePresence initial={false}>
                {showDocs && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-slate-100 px-6 py-4"
                  >
                    <DocumentsPanel
                      caseId={caseId}
                      currentUserId={user?.id}
                      isLawyer={user?.role === 'lawyer'}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaseDetailPage;
