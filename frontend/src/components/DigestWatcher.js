import { useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import API_URL from '../lib/api';

const DIGEST_KEY = 'vs_digest_last_triggered'; // date string YYYY-MM-DD

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const DigestWatcher = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const lastTriggered = localStorage.getItem(DIGEST_KEY);
    if (lastTriggered === todayStr()) return; // already triggered today

    const fetchDigest = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/activity-digest`);
        localStorage.setItem(DIGEST_KEY, todayStr());

        // Only show toast if there's meaningful activity
        if (!data.summary || data.summary === 'No new activity this week') return;

        const statusChanges = data.status_changes || [];
        const msgsReceived = data.messages_received || 0;
        const totalCases = data.total_cases || 0;

        toast.custom(
          (t) => (
            <div
              onClick={() => { toast.dismiss(t.id); window.location.href = user.role === 'lawyer' ? '/lawyer/dashboard' : '/client/cases'; }}
              className={`cursor-pointer max-w-sm w-full bg-white shadow-xl rounded-2xl border border-violet-200 overflow-hidden transition-all duration-300 ${
                t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
              }`}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📊</span>
                  <div>
                    <p className="text-white text-sm font-bold leading-tight">Weekly Activity Digest</p>
                    <p className="text-violet-200 text-[10px]">Last 7 days · {totalCases} case{totalCases !== 1 ? 's' : ''} total</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id); }}
                  className="text-violet-300 hover:text-white text-lg leading-none"
                >×</button>
              </div>

              {/* Body */}
              <div className="px-4 py-3 space-y-2">
                {statusChanges.length > 0 && (
                  <div className="flex items-start gap-2.5">
                    <span className="text-base mt-0.5">⚖️</span>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{statusChanges.length} Status Update{statusChanges.length !== 1 ? 's' : ''}</p>
                      <p className="text-[11px] text-slate-500">
                        Latest: <span className="font-medium text-slate-700">{statusChanges[0]?.case_type}</span> →{' '}
                        <span className="font-medium text-violet-700">{statusChanges[0]?.status?.replace(/_/g, ' ')}</span>
                      </p>
                    </div>
                  </div>
                )}
                {msgsReceived > 0 && (
                  <div className="flex items-start gap-2.5">
                    <span className="text-base mt-0.5">💬</span>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{msgsReceived} Message{msgsReceived !== 1 ? 's' : ''} Received</p>
                      <p className="text-[11px] text-slate-500">You have unread case messages</p>
                    </div>
                  </div>
                )}
                {data.new_cases_this_week > 0 && (
                  <div className="flex items-start gap-2.5">
                    <span className="text-base mt-0.5">📋</span>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{data.new_cases_this_week} New Case{data.new_cases_this_week !== 1 ? 's' : ''} Filed</p>
                      <p className="text-[11px] text-slate-500">Cases submitted this week</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 px-4 py-2 flex items-center justify-between">
                <p className="text-[10px] text-slate-400">Also visible in your notifications bell</p>
                <p className="text-[10px] font-semibold text-violet-600 hover:underline">View all →</p>
              </div>
            </div>
          ),
          { duration: 12000, position: 'top-right' }
        );
      } catch (err) {
        // Silent fail — digest is non-critical
      }
    };

    // Slight delay so app fully loads first
    const timer = setTimeout(fetchDigest, 3000);
    return () => clearTimeout(timer);
  }, [user]);

  return null;
};

export default DigestWatcher;
