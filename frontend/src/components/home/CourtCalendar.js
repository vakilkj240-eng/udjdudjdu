import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, Scale, Building2, ChevronRight, RefreshCw, Gavel } from 'lucide-react';
import axios from 'axios';

const STATUS_STYLE = {
  'Board':       { bg: 'rgba(212,175,55,0.12)', color: '#9A7B1A', border: 'rgba(212,175,55,0.3)' },
  'Part-Heard':  { bg: 'rgba(124,29,43,0.10)',  color: '#7C1D2B', border: 'rgba(124,29,43,0.25)' },
  'Fresh':       { bg: 'rgba(34,197,94,0.10)',   color: '#166534', border: 'rgba(34,197,94,0.25)' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE['Board'];
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`, letterSpacing: '0.05em',
    }}>
      {status}
    </span>
  );
}

export default function CourtCalendar() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(0);
  const [expanded, setExpanded] = useState(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data: d } = await axios.get('/api/court-calendar', { timeout: 8000 });
      setData(d);
    } catch { /* silently show skeleton */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const days    = data?.calendar || [];
  const current = days[activeDay];

  return (
    <section className="py-20 px-4 md:px-10 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 60%, rgba(212,175,55,0.04) 0%, transparent 70%)' }} />

      <div className="max-w-6xl mx-auto relative z-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8"
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Gavel size={18} style={{ color: 'var(--theme-primary)' }} />
              <span className="text-xs font-bold tracking-widest uppercase"
                style={{ color: 'var(--theme-primary)' }}>
                Supreme Court of India
              </span>
            </div>
            <h2 className="font-serif text-3xl md:text-4xl font-bold"
              style={{ color: 'var(--theme-fg)' }}>
              Upcoming Cause List
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--theme-fg-muted)' }}>
              Matters listed before the Hon'ble Supreme Court this week
            </p>
          </div>

          <button
            onClick={fetch}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 self-start sm:self-auto"
            style={{
              border: '1px solid var(--theme-border-soft)',
              color: 'var(--theme-fg-muted)',
              background: 'var(--theme-surface)',
            }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </motion.div>

        {/* Day selector tabs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
        >
          {loading
            ? Array(5).fill(0).map((_, i) => (
              <div key={i} className="shrink-0 rounded-xl h-16 w-24 animate-pulse"
                style={{ background: 'var(--theme-surface-2)' }} />
            ))
            : days.map((day, i) => (
              <motion.button
                key={day.date}
                onClick={() => { setActiveDay(i); setExpanded(null); }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="shrink-0 flex flex-col items-center justify-center px-4 py-3 rounded-xl transition-all duration-200 min-w-[80px]"
                style={{
                  background: activeDay === i
                    ? 'var(--theme-primary)'
                    : 'var(--theme-surface)',
                  border: `1px solid ${activeDay === i ? 'var(--theme-primary)' : 'var(--theme-border-soft)'}`,
                  boxShadow: activeDay === i ? '0 8px 24px rgba(124,29,43,0.22)' : 'none',
                }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: activeDay === i ? 'rgba(255,255,255,0.75)' : 'var(--theme-fg-muted)' }}>
                  {day.display.split(',')[0]}
                </span>
                <span className="text-lg font-bold leading-none mt-0.5"
                  style={{ color: activeDay === i ? '#fff' : 'var(--theme-fg)' }}>
                  {day.display.split(' ')[1]}
                </span>
                <span className="text-[10px] mt-0.5"
                  style={{ color: activeDay === i ? 'rgba(255,255,255,0.65)' : 'var(--theme-fg-muted)' }}>
                  {day.display.split(' ')[2]}
                </span>
                {day.is_today && (
                  <span className="text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded-full"
                    style={{ background: activeDay === i ? 'rgba(255,255,255,0.2)' : 'var(--theme-primary)', color: '#fff' }}>
                    Today
                  </span>
                )}
              </motion.button>
            ))
          }
        </motion.div>

        {/* Case list */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-3">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="rounded-2xl h-20 animate-pulse"
                  style={{ background: 'var(--theme-surface)', border: '1px solid var(--theme-border-soft)' }} />
              ))}
            </motion.div>
          ) : current ? (
            <motion.div
              key={activeDay}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-3"
            >
              {current.cases.map((c, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.055, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => setExpanded(expanded === i ? null : i)}
                  className="group cursor-pointer rounded-2xl p-4 transition-all duration-200"
                  style={{
                    background: 'var(--theme-surface)',
                    border: `1px solid ${expanded === i ? 'var(--theme-primary)' : 'var(--theme-border-soft)'}`,
                    boxShadow: expanded === i ? '0 8px 32px rgba(124,29,43,0.10)' : 'none',
                  }}
                  whileHover={{ y: -2, transition: { duration: 0.18 } }}
                >
                  {/* Row 1 */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-xs font-mono font-bold"
                          style={{ color: 'var(--theme-primary)' }}>
                          {c.case_no}
                        </span>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="font-semibold text-sm leading-snug truncate"
                        style={{ color: 'var(--theme-fg)' }}>
                        {c.title}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="shrink-0 mt-1 transition-transform duration-200"
                      style={{
                        color: 'var(--theme-fg-muted)',
                        transform: expanded === i ? 'rotate(90deg)' : 'rotate(0deg)',
                      }}
                    />
                  </div>

                  {/* Expanded detail */}
                  <AnimatePresence>
                    {expanded === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div className="mt-3 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3"
                          style={{ borderTop: '1px solid var(--theme-border-soft)' }}>
                          <div className="flex items-start gap-2">
                            <Scale size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--theme-gold)' }} />
                            <div>
                              <p className="text-[10px] uppercase tracking-wider font-semibold mb-0.5"
                                style={{ color: 'var(--theme-fg-muted)' }}>Bench</p>
                              <p className="text-xs leading-snug" style={{ color: 'var(--theme-fg)' }}>
                                {c.bench}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Building2 size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--theme-gold)' }} />
                            <div>
                              <p className="text-[10px] uppercase tracking-wider font-semibold mb-0.5"
                                style={{ color: 'var(--theme-fg-muted)' }}>Court No.</p>
                              <p className="text-xs font-bold" style={{ color: 'var(--theme-fg)' }}>
                                Court {c.court_no}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Clock size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--theme-gold)' }} />
                            <div>
                              <p className="text-[10px] uppercase tracking-wider font-semibold mb-0.5"
                                style={{ color: 'var(--theme-fg-muted)' }}>Scheduled</p>
                              <p className="text-xs font-bold" style={{ color: 'var(--theme-fg)' }}>
                                {c.time}
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}

              {/* Footer note */}
              <p className="text-center text-xs pt-2" style={{ color: 'var(--theme-fg-muted)' }}>
                * Cause list is indicative. Verify at{' '}
                <a href="https://main.sci.gov.in/causelist" target="_blank" rel="noopener noreferrer"
                  className="underline" style={{ color: 'var(--theme-primary)' }}>
                  sci.gov.in
                </a>
                {' '}before attending court.
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}
