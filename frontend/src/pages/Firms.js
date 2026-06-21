import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Building2, ChevronDown, ChevronRight, Loader2, Mail, MapPin, User } from 'lucide-react';
import API_URL from '../lib/api';

const Firms = () => {
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [lawyersCache, setLawyersCache] = useState({});
  const [loadingFirm, setLoadingFirm] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/firms`);
        setFirms(data);
      } catch (e) {
        toast.error('Could not load firms');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleFirm = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (lawyersCache[id]) return;
    setLoadingFirm(id);
    try {
      const { data } = await axios.get(`${API_URL}/api/firms/${id}/lawyers`);
      setLawyersCache((prev) => ({ ...prev, [id]: data }));
    } catch {
      toast.error('Could not load lawyers for this firm');
      setLawyersCache((prev) => ({ ...prev, [id]: [] }));
    } finally {
      setLoadingFirm(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" data-testid="firms-page">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 mb-8">
          <Building2 className="w-8 h-8 text-slate-800" />
          <div>
            <h1 className="font-heading text-3xl font-bold text-slate-900">Law Firms</h1>
            <p className="text-sm text-slate-500">Tap a firm to see its lawyers</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-slate-400 animate-spin" />
          </div>
        ) : firms.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-600">
            No firms listed yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {firms.map((f) => (
              <li key={f.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleFirm(f.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
                  data-testid={`firm-row-${f.id}`}
                >
                  <div>
                    <p className="font-semibold text-slate-900">{f.name || '—'}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-3 mt-1">
                      {f.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {f.email}
                        </span>
                      )}
                      {f.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {f.location}
                        </span>
                      )}
                    </p>
                  </div>
                  {expandedId === f.id ? (
                    <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                  )}
                </button>

                {expandedId === f.id && (
                  <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
                    {loadingFirm === f.id ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                      </div>
                    ) : (
                      <ul className="space-y-2" data-testid={`firm-lawyers-${f.id}`}>
                        {(lawyersCache[f.id] || []).length === 0 ? (
                          <li className="text-sm text-slate-500">No lawyers linked to this firm.</li>
                        ) : (
                          (lawyersCache[f.id] || []).map((l) => (
                            <li
                              key={l.id}
                              className="flex items-center gap-2 text-sm text-slate-700 py-1.5 border-b border-slate-100 last:border-0"
                            >
                              <User className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="font-medium">{l.name}</span>
                              <span className="text-slate-400">·</span>
                              <span>{l.specialization || '—'}</span>
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Firms;
