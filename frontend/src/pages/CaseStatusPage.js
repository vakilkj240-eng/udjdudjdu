import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scale, CheckCircle, Clock, AlertCircle, User, MapPin,
  Calendar, Copy, Share2, ArrowRight, Shield, BookOpen,
  Loader2, ExternalLink, ChevronRight, Circle, Flag,
  Briefcase, FileText
} from 'lucide-react';
import API_URL from '../lib/api';

const STATUS_FLOW = [
  { key: 'submitted',         label: 'Submitted',         icon: FileText,   desc: 'Case details received' },
  { key: 'under_review',      label: 'Under Review',      icon: BookOpen,   desc: 'Being reviewed by our team' },
  { key: 'active',            label: 'Active',            icon: Briefcase,  desc: 'Lawyer assigned & working' },
  { key: 'pending_decision',  label: 'Pending Decision',  icon: Scale,      desc: 'Awaiting court / decision' },
  { key: 'resolved',          label: 'Resolved',          icon: CheckCircle, desc: 'Case concluded' },
];

const URGENCY_COLOR = {
  High:   { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500' },
  Medium: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500' },
  Low:    { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-500' },
};

const EVENT_TYPE_CONFIG = {
  milestone: { color: 'bg-blue-500',   label: 'Milestone' },
  deadline:  { color: 'bg-red-500',    label: 'Deadline' },
  hearing:   { color: 'bg-purple-500', label: 'Hearing' },
  filing:    { color: 'bg-green-500',  label: 'Filing' },
};

function fmt(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function getStatusIndex(status) {
  const map = {
    submitted: 0, under_review: 1, active: 2, pending_decision: 3, resolved: 4,
    open: 0, in_review: 1, accepted: 2, closed: 4, dismissed: 4,
  };
  return map[status] ?? 0;
}

export default function CaseStatusPage() {
  const { nyayId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!nyayId) { setError('Invalid NyayID'); setLoading(false); return; }
    axios.get(`${API_URL}/api/public/case/${nyayId}`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Case not found. Please verify the NyayID.'))
      .finally(() => setLoading(false));
  }, [nyayId]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const currentIdx = data ? getStatusIndex(data.case_status) : 0;
  const urg = data ? (URGENCY_COLOR[data.urgency] || URGENCY_COLOR.Medium) : null;

  return (
    <div className="min-h-screen" style={{ background: '#FDFAF5' }}>
      {/* Top nav bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo-circular.png" alt="Gavel & Brief" className="w-8 h-8 object-contain" />
            <span className="font-serif font-bold text-slate-900 text-sm">Gavel &amp; Brief</span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Shield className="w-3.5 h-3.5" />
            Public Case Tracker
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-10">
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(124,29,43,0.08)' }}>
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#7C1D2B' }} />
            </div>
            <p className="text-slate-500 text-sm">Loading case details…</p>
          </div>
        )}

        {error && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="text-center py-32">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'rgba(124,29,43,0.08)' }}>
              <AlertCircle className="w-10 h-10" style={{ color: '#7C1D2B' }} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Case Not Found</h2>
            <p className="text-slate-500 mb-6 max-w-sm mx-auto">{error}</p>
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl text-white"
              style={{ background: '#7C1D2B' }}>
              Go to Homepage <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}

        {data && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="space-y-6">

            {/* Hero card */}
            <div className="rounded-3xl overflow-hidden shadow-md border border-slate-200">
              {/* Crimson header */}
              <div className="px-6 py-5 flex items-start justify-between gap-4"
                style={{ background: 'linear-gradient(135deg, #7C1D2B 0%, #9b2335 60%, #5a1420 100%)' }}>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Scale className="w-5 h-5 text-white/70" />
                    <span className="text-xs font-medium text-white/60 uppercase tracking-widest">NyayID</span>
                  </div>
                  <h1 className="font-mono text-2xl font-bold text-white tracking-wide">{data.nyay_id}</h1>
                  <p className="text-white/60 text-sm mt-1">
                    Filed {fmt(data.created_at)}
                    {data.location && <> · <MapPin className="inline w-3 h-3 mx-0.5" />{data.location}</>}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={copyLink}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', backdropFilter: 'blur(8px)' }}>
                    {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                  <button onClick={() => navigator.share?.({ title: `Case ${data.nyay_id}`, url: window.location.href })}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', backdropFilter: 'blur(8px)' }}>
                    <Share2 className="w-3.5 h-3.5" />
                    Share
                  </button>
                </div>
              </div>

              {/* Status + meta row */}
              <div className="bg-white px-6 py-4 flex flex-wrap items-center gap-3 border-b border-slate-100">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
                  style={{ background: 'rgba(201,168,76,0.1)', color: '#9A6E1A', borderColor: 'rgba(201,168,76,0.3)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {data.category}
                </span>
                {urg && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${urg.bg} ${urg.text} ${urg.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${urg.dot}`} />
                    {data.urgency} Urgency
                  </span>
                )}
                {data.description_preview && (
                  <p className="text-xs text-slate-500 line-clamp-1 flex-1 min-w-0">{data.description_preview}</p>
                )}
              </div>

              {/* Status progress bar */}
              <div className="bg-white px-6 pt-6 pb-8">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">Case Progress</p>
                <div className="relative">
                  {/* Track line */}
                  <div className="absolute top-5 left-5 right-5 h-0.5 bg-slate-100" style={{ zIndex: 0 }}>
                    <div className="h-full transition-all duration-700"
                      style={{
                        width: `${(currentIdx / (STATUS_FLOW.length - 1)) * 100}%`,
                        background: 'linear-gradient(90deg, #7C1D2B, #C9A84C)'
                      }} />
                  </div>
                  {/* Steps */}
                  <div className="relative z-10 grid gap-0" style={{ gridTemplateColumns: `repeat(${STATUS_FLOW.length}, 1fr)` }}>
                    {STATUS_FLOW.map((step, i) => {
                      const done = i < currentIdx;
                      const current = i === currentIdx;
                      const Icon = step.icon;
                      return (
                        <div key={step.key} className="flex flex-col items-center gap-2 px-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 shadow-sm
                            ${done ? 'text-white' : current ? 'text-white' : 'text-slate-300 bg-white border-2 border-slate-200'}`}
                            style={done || current ? {
                              background: done ? '#7C1D2B' : 'linear-gradient(135deg, #7C1D2B, #C9A84C)',
                              boxShadow: current ? '0 0 0 4px rgba(124,29,43,0.15)' : 'none'
                            } : {}}>
                            {done ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                          </div>
                          <div className="text-center">
                            <p className={`text-xs font-semibold ${current ? 'text-slate-900' : done ? 'text-slate-700' : 'text-slate-400'}`}>
                              {step.label}
                            </p>
                            <p className="text-xs text-slate-400 hidden sm:block mt-0.5 leading-tight">{step.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Assigned Lawyer */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4">Assigned Lawyer</h3>
                {data.lawyer_name ? (
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(124,29,43,0.1)' }}>
                      <User className="w-6 h-6" style={{ color: '#7C1D2B' }} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{data.lawyer_name}</p>
                      {data.lawyer_specialization && (
                        <p className="text-sm text-slate-500 mt-0.5">{data.lawyer_specialization}</p>
                      )}
                      {data.lawyer_location && (
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />{data.lawyer_location}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 py-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-slate-300" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500">Not yet assigned</p>
                      <p className="text-xs text-slate-400">A lawyer will be matched soon</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Status History */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4">Status History</h3>
                {data.status_history && data.status_history.length > 0 ? (
                  <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                    {[...data.status_history].reverse().map((h, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                          style={{ background: i === 0 ? '#7C1D2B' : '#cbd5e1' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 capitalize">{(h.new_status || h.status || '').replace(/_/g, ' ')}</p>
                          {h.note && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{h.note}</p>}
                          <p className="text-xs text-slate-400 mt-0.5">{fmt(h.changed_at || h.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 py-2">No status updates yet.</p>
                )}
              </div>
            </div>

            {/* Timeline Events */}
            {data.timeline_events && data.timeline_events.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-5">Case Timeline</h3>
                <div className="relative">
                  <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-100" />
                  <div className="space-y-5">
                    {data.timeline_events.sort((a, b) => new Date(a.date) - new Date(b.date)).map((ev, i) => {
                      const cfg = EVENT_TYPE_CONFIG[ev.type] || EVENT_TYPE_CONFIG.milestone;
                      return (
                        <div key={ev.id || i} className="relative pl-12">
                          <div className={`absolute left-3 top-1 w-4 h-4 rounded-full ${cfg.color} flex items-center justify-center flex-shrink-0`}>
                            {ev.completed && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <div className={`rounded-xl p-4 border transition-all ${ev.completed ? 'opacity-60' : ''}`}
                            style={{ background: '#FAFAF8', borderColor: '#E8E4DE' }}>
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div>
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full text-white ${cfg.color}`}>
                                    {cfg.label}
                                  </span>
                                  {ev.completed && (
                                    <span className="text-xs text-green-600 flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" />Completed
                                    </span>
                                  )}
                                </div>
                                <p className="font-semibold text-slate-900 text-sm">{ev.title}</p>
                                {ev.description && <p className="text-xs text-slate-500 mt-0.5">{ev.description}</p>}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-xs font-medium text-slate-600 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />{fmt(ev.date)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Footer disclaimer */}
            <div className="rounded-2xl p-4 border text-center"
              style={{ background: 'rgba(124,29,43,0.04)', borderColor: 'rgba(124,29,43,0.1)' }}>
              <p className="text-xs text-slate-500 leading-relaxed">
                This is a read-only public case tracker shared via NyayID. For full case management,{' '}
                <Link to="/login" className="font-semibold hover:opacity-80" style={{ color: '#7C1D2B' }}>
                  sign in to Gavel &amp; Brief
                </Link>.
              </p>
              <p className="text-xs text-slate-400 mt-1">© 2026 Gavel &amp; Brief. All rights reserved.</p>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
