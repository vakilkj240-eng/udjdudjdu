import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Search, Scale, ChevronLeft, ChevronRight, Shield, ShieldOff, Eye } from 'lucide-react';
import API_URL from '../lib/api';

const Badge = ({ children, color }) => {
  const colors = {
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[color] || colors.slate}`}>
      {children}
    </span>
  );
};

const LawCard = ({ law }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
  >
    <div className="flex items-start justify-between mb-3">
      <div>
        <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
          {law.ipc_section}
        </span>
        <h3 className="mt-2 text-base font-semibold text-slate-900">{law.title}</h3>
      </div>
    </div>
    <p className="text-sm text-slate-600 leading-relaxed mb-3 line-clamp-3">{law.description}</p>
    {law.punishment && (
      <p className="text-xs text-slate-500 mb-3">
        <span className="font-medium text-slate-700">Punishment: </span>{law.punishment}
      </p>
    )}
    <div className="flex flex-wrap gap-1.5">
      {law.bailable !== undefined && law.bailable !== null && (
        law.bailable
          ? <Badge color="green"><Shield className="w-3 h-3" />Bailable</Badge>
          : <Badge color="red"><ShieldOff className="w-3 h-3" />Non-Bailable</Badge>
      )}
      {law.cognizable !== undefined && law.cognizable !== null && (
        law.cognizable
          ? <Badge color="red"><Eye className="w-3 h-3" />Cognizable</Badge>
          : <Badge color="slate">Non-Cognizable</Badge>
      )}
      {(law.keywords || []).slice(0, 3).map(k => (
        <Badge key={k} color="slate">{k}</Badge>
      ))}
    </div>
  </motion.div>
);

export default function IPCBrowser() {
  const [laws, setLaws] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLaws = useCallback(async (query, pg) => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/ipc-laws`, {
        params: { q: query, page: pg, limit: 12 }
      });
      setLaws(data.laws || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch {
      setLaws([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLaws(q, page); }, [fetchLaws, q, page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setQ(input.trim());
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-full text-xs font-medium mb-4">
            <Scale className="w-3.5 h-3.5" /> Indian Penal Code
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">IPC Sections Browser</h1>
          <p className="text-slate-500 text-sm max-w-xl mx-auto">
            Search and explore all sections of the Indian Penal Code. Understand offences, punishments, and your legal rights.
          </p>
        </div>

        <form onSubmit={handleSearch} className="mb-8 max-w-xl mx-auto">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Search by section, title, keyword…"
                className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              />
            </div>
            <button type="submit" className="px-5 py-3 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors">
              Search
            </button>
          </div>
        </form>

        {!loading && (
          <p className="text-center text-sm text-slate-400 mb-6">
            {total === 0 ? 'No sections found' : `Showing ${laws.length} of ${total} sections`}
            {q && <span> for "<strong className="text-slate-600">{q}</strong>"</span>}
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-1/4 mb-3" />
                <div className="h-5 bg-slate-100 rounded w-3/4 mb-2" />
                <div className="h-16 bg-slate-100 rounded mb-3" />
                <div className="flex gap-2">
                  <div className="h-5 bg-slate-100 rounded w-20" />
                  <div className="h-5 bg-slate-100 rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : laws.length === 0 ? (
          <div className="text-center py-16">
            <Scale className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400">No sections found. Try a different search term.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {laws.map(law => <LawCard key={law.id} law={law} />)}
          </div>
        )}

        {pages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-10">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {[...Array(pages)].map((_, i) => {
              const pg = i + 1;
              if (pg === 1 || pg === pages || Math.abs(pg - page) <= 1) {
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={`w-9 h-9 rounded-xl text-sm font-medium transition-colors ${page === pg ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {pg}
                  </button>
                );
              }
              if (Math.abs(pg - page) === 2) return <span key={pg} className="text-slate-400">…</span>;
              return null;
            })}
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
