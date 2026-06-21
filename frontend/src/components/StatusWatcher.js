import { useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import API_URL from '../lib/api';

const STORAGE_KEY = 'vs_case_statuses';
const POLL_MS = 15000;

const STATUS_LABELS = {
  submitted:          'Submitted',
  analyzed:           'AI Analyzed',
  open:               'Open for Assignment',
  accepted:           'Lawyer Assigned',
  in_progress:        'In Progress',
  'in-progress':      'In Progress',
  awaiting_documents: 'Documents Needed',
  in_court:           'In Court',
  completed:          'Completed',
  closed:             'Closed',
};

const STATUS_EMOJI = {
  submitted:          '📋',
  analyzed:           '🤖',
  open:               '📂',
  accepted:           '🤝',
  in_progress:        '⚙️',
  'in-progress':      '⚙️',
  awaiting_documents: '📄',
  in_court:           '⚖️',
  completed:          '✅',
  closed:             '🔒',
};

function normalize(s) {
  if (!s) return 'submitted';
  return s.toLowerCase().replace(/-/g, '_');
}

function readStored() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeStored(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function fireToast(caseType, oldStatus, newStatus) {
  const normNew = normalize(newStatus);
  const normOld = normalize(oldStatus);
  const label = STATUS_LABELS[normNew] || newStatus;
  const emoji = STATUS_EMOJI[normNew] || '🔔';
  const oldLabel = STATUS_LABELS[normOld] || oldStatus;

  toast.custom(
    (t) => (
      <div
        onClick={() => { toast.dismiss(t.id); window.location.href = '/client/cases'; }}
        className={`cursor-pointer max-w-sm w-full shadow-2xl rounded-2xl flex items-start gap-3 px-4 py-4 transition-all duration-300 ${
          t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        }`}
        style={{
          background: 'var(--theme-surface, #fff)',
          border: '1px solid var(--theme-border, #E5E5E5)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        <div className="text-2xl flex-shrink-0 mt-0.5">{emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--theme-text, #111)' }}>
              Case Status Updated
            </p>
            <span className="flex-shrink-0 flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-500">Live</span>
            </span>
          </div>
          <p className="text-xs truncate" style={{ color: 'var(--theme-text-muted, #666)' }}>
            {caseType || 'Your case'}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs line-through" style={{ color: 'var(--theme-text-muted, #999)' }}>{oldLabel}</span>
            <span style={{ color: 'var(--theme-text-muted, #ccc)' }}>→</span>
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md"
                  style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.35)', color: '#A08020' }}>
              {label}
            </span>
          </div>
          <p className="text-[10px] mt-1.5" style={{ color: 'var(--theme-text-muted, #aaa)' }}>Click to view your cases</p>
        </div>
      </div>
    ),
    {
      duration: 8000,
      position: 'top-right',
    }
  );
}

const StatusWatcher = () => {
  const { user } = useAuth();
  const casesRef = useRef([]);
  const storedRef = useRef(readStored());
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!user || user.role !== 'client') return;

    const pollStatuses = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/my-cases`);
        const cases = data || [];
        const stored = storedRef.current;

        cases.forEach(c => {
          const fresh = normalize(c.status);
          const prev = stored[c.id] ? normalize(stored[c.id]) : null;
          if (prev !== null && prev !== fresh) {
            fireToast(c.case_type, prev, fresh);
          }
          stored[c.id] = fresh;
        });

        storedRef.current = stored;
        writeStored(stored);
      } catch {}
    };

    pollStatuses();
    intervalRef.current = setInterval(pollStatuses, POLL_MS * 2);

    return () => clearInterval(intervalRef.current);
  }, [user]);

  return null;
};

export default StatusWatcher;
