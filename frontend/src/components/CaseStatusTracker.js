import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Radio, ChevronRight, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import API_URL from '../lib/api';

const PIPELINE = [
  { key: 'submitted',          label: 'Submitted',       short: 'Submitted' },
  { key: 'analyzed',           label: 'AI Analyzed',     short: 'Analyzed' },
  { key: 'open',               label: 'Open',            short: 'Open' },
  { key: 'accepted',           label: 'Lawyer Matched',  short: 'Matched' },
  { key: 'in_progress',        label: 'In Progress',     short: 'Active' },
  { key: 'awaiting_documents', label: 'Docs Needed',     short: 'Docs' },
  { key: 'in_court',           label: 'In Court',        short: 'Court' },
  { key: 'completed',          label: 'Completed',       short: 'Done' },
];

const ALIAS = { 'in-progress': 'in_progress', closed: 'completed', resolved: 'completed' };

function norm(s) {
  if (!s) return 'submitted';
  const l = s.toLowerCase().replace(/-/g, '_');
  return ALIAS[l] || l;
}

function stageIdx(s) {
  const n = norm(s);
  const i = PIPELINE.findIndex(p => p.key === n);
  return i === -1 ? 0 : i;
}

const StatusTracker = ({ caseData, compact = false }) => {
  const idx = stageIdx(caseData.status);
  const stage = PIPELINE[idx];

  if (compact) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <span className="relative flex h-2 w-2 flex-shrink-0">
          {idx < PIPELINE.length - 1 && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${
            idx >= PIPELINE.length - 1 ? 'bg-green-500' :
            idx === 0 ? 'bg-blue-400' : 'bg-amber-500'
          }`} />
        </span>
        <span className="text-xs font-semibold truncate" style={{ color: 'var(--theme-text)' }}>
          {stage?.label || caseData.status}
        </span>
        <span className="text-xs hidden sm:inline" style={{ color: 'var(--theme-text-muted)' }}>
          ({idx + 1}/{PIPELINE.length})
        </span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-center gap-0 min-w-max">
        {PIPELINE.map((step, i) => {
          const done = i < idx;
          const active = i === idx;
          const future = i > idx;
          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center gap-1 px-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  done ? 'bg-green-500 text-white' :
                  active ? 'bg-[#7C1D2B] text-white ring-2 ring-[#D4AF37]/40' :
                  'text-slate-400 border-2 border-slate-200 dark:border-slate-600'
                }`}
                style={future ? { background: 'var(--theme-surface)' } : {}}>
                  {done ? <CheckCircle className="w-3.5 h-3.5" /> :
                   active ? <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-white" /></span> :
                   <span className="text-[10px]">{i + 1}</span>}
                </div>
                <span className={`text-[9px] font-semibold whitespace-nowrap ${
                  done ? 'text-green-600' : active ? 'text-[#7C1D2B] dark:text-amber-400' : 'text-slate-400'
                }`}>
                  {step.short}
                </span>
              </div>
              {i < PIPELINE.length - 1 && (
                <div className={`h-0.5 w-5 flex-shrink-0 ${
                  i < idx ? 'bg-green-400' : 'bg-slate-200 dark:bg-slate-600'
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

const CaseStatusTracker = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const intervalRef = useRef(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/my-cases`);
      setCases((data || []).slice(0, 5));
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'client') return;
    load();
    intervalRef.current = setInterval(() => load(true), 15000);
    return () => clearInterval(intervalRef.current);
  }, [user]);

  if (!user || user.role !== 'client') return null;
  if (!loading && cases.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border mb-6 overflow-hidden"
      style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-amber-50/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4" style={{ color: '#D4AF37' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
              Live Case Status
            </span>
          </div>
          {refreshing && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
          {cases.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(124,29,43,0.1)', color: '#7C1D2B' }}>
              {cases.length} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs hidden sm:block" style={{ color: 'var(--theme-text-muted)' }}>
            Updates every 15s
          </span>
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
          {collapsed
            ? <ChevronRight className="w-4 h-4 text-slate-400" style={{ transform: 'rotate(90deg)' }} />
            : <ChevronRight className="w-4 h-4 text-slate-400" style={{ transform: 'rotate(-90deg)' }} />}
        </div>
      </button>

      {/* Cases */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="border-t px-5 divide-y" style={{ borderColor: 'var(--theme-border)' }}>
              {loading ? (
                <div className="py-5 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                </div>
              ) : (
                cases.map(c => (
                  <div
                    key={c.id}
                    className="py-3.5 cursor-pointer hover:bg-amber-50/10 -mx-5 px-5 transition-colors"
                    onClick={() => navigate(`/client/cases/${c.id}`)}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--theme-text)' }}>
                          {c.case_type || 'Case'}
                          {c.nyayId && <span className="ml-2 text-[10px] font-normal text-slate-400">#{c.nyayId}</span>}
                        </p>
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                          {c.description ? c.description.slice(0, 80) + (c.description.length > 80 ? '…' : '') : 'No description'}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 flex-shrink-0 text-slate-400" />
                    </div>
                    <StatusTracker caseData={c} />
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3 border-t flex items-center justify-between"
                 style={{ borderColor: 'var(--theme-border)' }}>
              <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                Showing your most recent cases
              </span>
              <button
                onClick={() => navigate('/client/cases')}
                className="text-xs font-semibold flex items-center gap-1 hover:underline"
                style={{ color: '#7C1D2B' }}
              >
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CaseStatusTracker;
export { StatusTracker };
