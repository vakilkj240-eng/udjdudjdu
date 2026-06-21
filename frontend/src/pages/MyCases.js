import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from '../components/Navbar';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, FileText, MapPin, Calendar, Clock, Shield,
  ChevronDown, ChevronUp, CheckCircle, Circle, AlertCircle,
  MessageCircle, Radio, RefreshCw, User, ExternalLink,
  Copy, Check, BookOpen, CalendarDays, Video, Phone, XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import API_URL from '../lib/api';
import CaseChat from '../components/CaseChat';
import { useAuth } from '../contexts/AuthContext';

const STATUS_PIPELINE = [
  { key: 'submitted',          label: 'Submitted',           desc: 'Case submitted to the platform',             color: 'blue' },
  { key: 'analyzed',           label: 'AI Analyzed',         desc: 'AI intelligence analysis complete',          color: 'violet' },
  { key: 'open',               label: 'Open',                desc: 'Case is open for lawyer assignment',         color: 'sky' },
  { key: 'accepted',           label: 'Lawyer Assigned',     desc: 'A lawyer has accepted your case',            color: 'emerald' },
  { key: 'in_progress',        label: 'In Progress',         desc: 'Lawyer is actively working on the case',    color: 'amber' },
  { key: 'awaiting_documents', label: 'Documents Needed',    desc: 'Lawyer requires additional documents',       color: 'orange' },
  { key: 'in_court',           label: 'In Court',            desc: 'Case is being argued in court',             color: 'red' },
  { key: 'completed',          label: 'Completed',           desc: 'Case has been successfully resolved',       color: 'green' },
];

const ALIAS_MAP = {
  'in-progress': 'in_progress',
  'inprogress': 'in_progress',
  'awaiting documents': 'awaiting_documents',
  'closed': 'completed',
  'resolved': 'completed',
};

const COLOR_CLASSES = {
  blue:    { dot: 'bg-blue-500',    ring: 'ring-blue-100',    text: 'text-blue-700',    bar: 'bg-blue-300',    badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  violet:  { dot: 'bg-violet-500',  ring: 'ring-violet-100',  text: 'text-violet-700',  bar: 'bg-violet-300',  badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  sky:     { dot: 'bg-sky-500',     ring: 'ring-sky-100',     text: 'text-sky-700',     bar: 'bg-sky-300',     badge: 'bg-sky-50 text-sky-700 border-sky-200' },
  emerald: { dot: 'bg-emerald-500', ring: 'ring-emerald-100', text: 'text-emerald-700', bar: 'bg-emerald-300', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  amber:   { dot: 'bg-amber-500',   ring: 'ring-amber-100',   text: 'text-amber-700',   bar: 'bg-amber-300',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  orange:  { dot: 'bg-orange-500',  ring: 'ring-orange-100',  text: 'text-orange-700',  bar: 'bg-orange-300',  badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  red:     { dot: 'bg-red-500',     ring: 'ring-red-100',     text: 'text-red-700',     bar: 'bg-red-300',     badge: 'bg-red-50 text-red-700 border-red-200' },
  green:   { dot: 'bg-green-500',   ring: 'ring-green-100',   text: 'text-green-700',   bar: 'bg-green-300',   badge: 'bg-green-50 text-green-700 border-green-200' },
};

function normalizeStatus(s) {
  if (!s) return 'submitted';
  const lower = s.toLowerCase().replace(/-/g, '_');
  return ALIAS_MAP[lower] || lower;
}

function getStageIndex(status) {
  const norm = normalizeStatus(status);
  const idx = STATUS_PIPELINE.findIndex(s => s.key === norm);
  return idx === -1 ? 0 : idx;
}

function timeAgo(isoStr) {
  if (!isoStr) return '';
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
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

const CaseTimeline = ({ currentStatus, statusHistory, justUpdated }) => {
  const currentIndex = getStageIndex(currentStatus);

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Case Progress</p>
        <LiveDot />
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-5 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-400 to-emerald-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(((currentIndex + 1) / STATUS_PIPELINE.length) * 100)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      <div className="relative">
        {STATUS_PIPELINE.map((stage, i) => {
          const isDone = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isPending = i > currentIndex;
          const norm = normalizeStatus(currentStatus);
          const historyEntry = statusHistory?.find(sh => normalizeStatus(sh.status) === stage.key);
          const cls = COLOR_CLASSES[stage.color];

          return (
            <motion.div
              key={stage.key}
              initial={justUpdated && isCurrent ? { backgroundColor: '#fef9c3' } : false}
              animate={{ backgroundColor: 'transparent' }}
              transition={{ duration: 2 }}
              className="flex gap-3 pb-4 last:pb-0 rounded-lg px-1"
            >
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  isDone    ? 'bg-green-500' :
                  isCurrent ? `${cls.dot} ring-4 ${cls.ring}` :
                              'bg-slate-200'
                }`}>
                  {isDone ? (
                    <CheckCircle className="w-3.5 h-3.5 text-white" />
                  ) : isCurrent ? (
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>
                {i < STATUS_PIPELINE.length - 1 && (
                  <div className={`w-0.5 flex-1 mt-1 transition-colors ${isDone ? 'bg-green-300' : 'bg-slate-200'}`} style={{ minHeight: '20px' }} />
                )}
              </div>

              <div className="flex-1 pt-0.5 pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-medium ${
                    isDone    ? 'text-green-700' :
                    isCurrent ? cls.text :
                                'text-slate-400'
                  }`}>{stage.label}</p>
                  {isCurrent && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${cls.badge}`}>
                      Current Stage
                    </span>
                  )}
                  {isPending && i === currentIndex + 1 && (
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">Next</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{stage.desc}</p>
                {historyEntry?.notes && (
                  <p className="text-xs text-slate-500 mt-1 italic bg-slate-50 px-2 py-1 rounded-lg">"{historyEntry.notes}"</p>
                )}
                {historyEntry?.updated_by && (
                  <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <User className="w-2.5 h-2.5" /> {historyEntry.updated_by}
                  </p>
                )}
                {historyEntry?.timestamp && (
                  <p className="text-[10px] text-slate-300 mt-0.5">
                    {new Date(historyEntry.timestamp).toLocaleString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

const statusBadgeColors = {
  submitted:          'bg-blue-50 text-blue-700 border-blue-200',
  analyzed:           'bg-violet-50 text-violet-700 border-violet-200',
  open:               'bg-sky-50 text-sky-700 border-sky-200',
  accepted:           'bg-emerald-50 text-emerald-700 border-emerald-200',
  in_progress:        'bg-amber-50 text-amber-700 border-amber-200',
  'in-progress':      'bg-amber-50 text-amber-700 border-amber-200',
  awaiting_documents: 'bg-orange-50 text-orange-700 border-orange-200',
  in_court:           'bg-red-50 text-red-700 border-red-200',
  completed:          'bg-green-50 text-green-700 border-green-200',
  closed:             'bg-slate-100 text-slate-600 border-slate-200',
};

function statusLabel(s) {
  const stage = STATUS_PIPELINE.find(p => p.key === normalizeStatus(s));
  return stage ? stage.label : s;
}

const BOOKING_STATUS_STYLES = {
  pending:   { cls: 'bg-amber-50 text-amber-700 border-amber-200',  label: 'Pending'   },
  confirmed: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Confirmed' },
  cancelled: { cls: 'bg-red-50 text-red-700 border-red-200',        label: 'Cancelled' },
  completed: { cls: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Completed' },
};

const CONSULT_TYPE_ICONS = {
  video:    <Video className="w-3.5 h-3.5" />,
  phone:    <Phone className="w-3.5 h-3.5" />,
  chat:     <MessageCircle className="w-3.5 h-3.5" />,
};

const MyCases = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('cases');
  const [copiedNyay, setCopiedNyay] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [expandedCase, setExpandedCase] = useState(null);
  const [openChatCase, setOpenChatCase] = useState(null);
  const [unreadByCase, setUnreadByCase] = useState({});
  const [liveStatus, setLiveStatus] = useState({});   // { [caseId]: { case_status, status_history, updated_at } }
  const [justUpdated, setJustUpdated] = useState({}); // { [caseId]: bool }
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const prevStatusRef = useRef({});

  const fetchMyCases = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/my-cases`);
      setCases(data);
      setLastRefresh(Date.now());
    } catch (err) {
      console.error('Failed to fetch cases', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/bookings`);
      setBookings(Array.isArray(data) ? data : (data.bookings || []));
    } catch (err) {
      console.error('Failed to fetch bookings', err);
      setBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  }, []);

  useEffect(() => { fetchMyCases(); }, [fetchMyCases]);

  useEffect(() => {
    if (activeTab === 'bookings') fetchBookings();
  }, [activeTab, fetchBookings]);

  // Poll unread messages
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/messages/unread-summary`);
        setUnreadByCase(data?.per_case || {});
      } catch {}
    };
    fetchUnread();
    const iv = setInterval(fetchUnread, 10000);
    return () => clearInterval(iv);
  }, []);

  // Refresh all case data every 30s — no individual-per-case requests
  useEffect(() => {
    if (cases.length === 0) return;

    const refreshCases = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/my-cases`);
        const fresh = data || [];
        const updates = {};
        const flashes = {};
        fresh.forEach(c => {
          updates[c.id] = { case_status: c.status };
          if (prevStatusRef.current[c.id] && prevStatusRef.current[c.id] !== c.status) {
            flashes[c.id] = true;
          }
          prevStatusRef.current[c.id] = c.status;
        });
        setLiveStatus(prev => ({ ...prev, ...updates }));
        if (Object.keys(flashes).length > 0) {
          setJustUpdated(prev => ({ ...prev, ...flashes }));
          setTimeout(() => setJustUpdated({}), 4000);
        }
        setLastRefresh(Date.now());
      } catch {}
    };

    const iv = setInterval(refreshCases, 30000);
    return () => clearInterval(iv);
  }, [cases]);

  return (
    <div className="min-h-screen bg-slate-50" data-testid="my-cases-page">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900" data-testid="my-cases-title">My Cases</h1>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
              Track your legal cases and bookings in real time
              <LiveDot />
            </p>
          </div>
          <button
            onClick={activeTab === 'cases' ? fetchMyCases : fetchBookings}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-6 w-fit shadow-sm">
          <button
            onClick={() => setActiveTab('cases')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'cases'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            My Cases
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              activeTab === 'cases' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {cases.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'bookings'
                ? 'bg-[#6D071A] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            My Bookings
            {bookings.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === 'bookings' ? 'bg-white/20 text-white' : 'bg-[#6D071A]/10 text-[#6D071A]'
              }`}>
                {bookings.length}
              </span>
            )}
          </button>
        </div>

        {/* ── BOOKINGS TAB ── */}
        {activeTab === 'bookings' && (
          <div>
            {loadingBookings ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-10 h-10 text-slate-300 animate-spin" />
              </div>
            ) : bookings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
                <CalendarDays className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-800 mb-2">No bookings yet</h3>
                <p className="text-sm text-slate-500 mb-5">Book a consultation with a lawyer to get expert advice</p>
                <button
                  onClick={() => navigate('/client/lawyers')}
                  className="inline-flex items-center gap-2 bg-[#6D071A] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#5a0616] transition-colors"
                >
                  Find Lawyers
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((b, i) => {
                  const bStatus = BOOKING_STATUS_STYLES[b.status] || BOOKING_STATUS_STYLES.pending;
                  const cIcon = CONSULT_TYPE_ICONS[b.consultation_type] || CONSULT_TYPE_ICONS.video;
                  return (
                    <motion.div
                      key={b.id || b._id || i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-[#6D071A]/8 flex items-center justify-center flex-shrink-0">
                            <CalendarDays className="w-5 h-5 text-[#6D071A]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-semibold text-slate-900 text-sm">
                                {b.lawyer_name || 'Assigned Lawyer'}
                              </span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${bStatus.cls}`}>
                                {bStatus.label}
                              </span>
                              {b.consultation_type && (
                                <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                  {cIcon}
                                  {b.consultation_type.charAt(0).toUpperCase() + b.consultation_type.slice(1)}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                              {b.scheduled_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(b.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              )}
                              {b.scheduled_time && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {b.scheduled_time}
                                </span>
                              )}
                              {b.case_type && (
                                <span className="flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  {b.case_type}
                                </span>
                              )}
                            </div>
                            {b.notes && (
                              <p className="text-xs text-slate-500 mt-1.5 italic bg-slate-50 px-2.5 py-1.5 rounded-lg">"{b.notes}"</p>
                            )}
                          </div>
                        </div>
                        {b.status === 'pending' && (
                          <button
                            onClick={async () => {
                              try {
                                await axios.put(`${API_URL}/api/bookings/${b.id || b._id}/cancel`);
                                fetchBookings();
                              } catch {}
                            }}
                            className="flex-shrink-0 flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            <XCircle className="w-3 h-3" /> Cancel
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── CASES TAB ── */}
        {activeTab === 'cases' && (loading ? (
          <div className="flex items-center justify-center py-24" data-testid="loading">
            <Loader2 className="w-10 h-10 text-slate-300 animate-spin" />
          </div>
        ) : cases.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center" data-testid="no-cases">
            <FileText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-800 mb-2">No cases yet</h3>
            <p className="text-sm text-slate-500">Submit your first case through the Intelligence Engine</p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="cases-list">
            {cases.map((c, i) => {
              const live = liveStatus[c.id];
              const currentStatus = live?.case_status || c.case_status;
              const currentHistory = live?.status_history || c.status_history || [];
              const lawyerName = live?.lawyer_name || c.lawyer_name;
              const updatedAt = live?.updated_at;
              const isJustUpdated = justUpdated[c.id];
              const stageIdx = getStageIndex(currentStatus);
              const pct = Math.round(((stageIdx + 1) / STATUS_PIPELINE.length) * 100);

              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-all ${
                    isJustUpdated ? 'border-amber-300 shadow-amber-100 shadow-md' : 'border-slate-200'
                  }`}
                  data-testid={`case-item-${i}`}
                >
                  {/* Status change flash banner */}
                  <AnimatePresence>
                    {isJustUpdated && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-amber-50 border-b border-amber-200 px-5 py-2 flex items-center gap-2"
                      >
                        <Radio className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                        <span className="text-xs font-semibold text-amber-700">Case status just updated!</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div
                    className="p-5 cursor-pointer"
                    onClick={() => setExpandedCase(expandedCase === c.id ? null : c.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="font-semibold text-slate-900">{c.case_type} Law</h3>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusBadgeColors[normalizeStatus(currentStatus)] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {statusLabel(currentStatus)}
                          </span>
                          {(c.nyayId || c.nyay_id) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const nyayId = c.nyayId || c.nyay_id;
                                navigator.clipboard.writeText(`${window.location.origin}/case/${nyayId}`);
                                setCopiedNyay(nyayId);
                                setTimeout(() => setCopiedNyay(null), 2500);
                              }}
                              title="Copy public case tracker link"
                              className="text-xs bg-slate-900 hover:bg-slate-700 text-white px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors"
                            >
                              <Shield className="w-3 h-3" />
                              {c.nyayId || c.nyay_id}
                              {copiedNyay === (c.nyayId || c.nyay_id)
                                ? <Check className="w-2.5 h-2.5 text-green-400" />
                                : <Copy className="w-2.5 h-2.5 opacity-50" />
                              }
                            </button>
                          )}
                          {unreadByCase[c.id] > 0 && (
                            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold" data-testid={`unread-badge-${c.id}`}>
                              <MessageCircle className="w-3 h-3" /> {unreadByCase[c.id]} new
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2">{c.description}</p>

                        {/* Mini progress bar always visible */}
                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-1 overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-blue-400 to-emerald-500 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">Stage {stageIdx + 1}/{STATUS_PIPELINE.length}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-400">
                          {c.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location}</span>}
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          {c.urgency && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{c.urgency}</span>}
                          {updatedAt && <span className="flex items-center gap-1"><Radio className="w-3 h-3 text-green-500" />Updated {timeAgo(updatedAt)}</span>}
                        </div>
                      </div>
                      <div className="ml-4 flex-shrink-0 flex flex-col items-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/client/cases/${c.id}`); }}
                          className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                          data-testid={`view-timeline-${c.id}`}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Full Timeline
                        </button>
                        {expandedCase === c.id
                          ? <ChevronUp className="w-5 h-5 text-slate-400" />
                          : <ChevronDown className="w-5 h-5 text-slate-400" />}
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedCase === c.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-slate-100 px-5 py-5 bg-slate-50/80">
                          {lawyerName && (
                            <div className="flex items-center justify-between gap-2 text-sm mb-4 bg-white border border-slate-200 rounded-xl px-4 py-3">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-500" />
                                <span className="text-slate-600">Assigned Lawyer:</span>
                                <span className="font-semibold text-slate-900">{lawyerName}</span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenChatCase(openChatCase === c.id ? null : c.id);
                                  if (openChatCase !== c.id) setUnreadByCase(prev => ({ ...prev, [c.id]: 0 }));
                                }}
                                className={`relative flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                                  openChatCase === c.id
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                                }`}
                                data-testid={`chat-toggle-${c.id}`}
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                {openChatCase === c.id ? 'Close Chat' : 'Message Lawyer'}
                                {unreadByCase[c.id] > 0 && openChatCase !== c.id && (
                                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                    {unreadByCase[c.id] > 9 ? '9+' : unreadByCase[c.id]}
                                  </span>
                                )}
                              </button>
                            </div>
                          )}

                          {openChatCase === c.id && lawyerName && (
                            <div className="mb-4" onClick={e => e.stopPropagation()}>
                              <CaseChat
                                caseId={c.id}
                                currentUserId={user?.id}
                                currentUserName={user?.name}
                                otherPartyName={lawyerName}
                              />
                            </div>
                          )}

                          <CaseTimeline
                            currentStatus={currentStatus}
                            statusHistory={currentHistory}
                            justUpdated={isJustUpdated}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyCases;
