import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, ExternalLink, ChevronRight, Wifi, WifiOff } from 'lucide-react';
import axios from 'axios';

const REFRESH_MS = 5 * 60 * 1000; // 5 min

function useNewsItems() {
  const [items, setItems] = useState([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchNews = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/legal-news', { timeout: 8000 });
      if (data?.items?.length) {
        setItems(data.items);
        setLive(true);
      }
    } catch {
      setLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const id = setInterval(fetchNews, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchNews]);

  return { items, live, loading };
}

const TICKER_SPEED = 38; // px/sec

export default function LegalNewsTicker() {
  const { items, live, loading } = useNewsItems();
  const trackRef  = useRef(null);
  const outerRef  = useRef(null);
  const animRef   = useRef(null);
  const posRef    = useRef(0);
  const pausedRef = useRef(false);
  const [activeIdx, setActiveIdx] = useState(null);
  const [_, forceRender] = useState(0);

  const startAnim = useCallback(() => {
    const track = trackRef.current;
    const outer = outerRef.current;
    if (!track || !outer) return;
    cancelAnimationFrame(animRef.current);

    let last = null;
    const totalW = track.scrollWidth / 2;

    const tick = (ts) => {
      if (!last) last = ts;
      const dt = ts - last;
      last = ts;
      if (!pausedRef.current) {
        posRef.current -= (TICKER_SPEED * dt) / 1000;
        if (posRef.current <= -totalW) posRef.current += totalW;
        track.style.transform = `translateX(${posRef.current}px)`;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (items.length > 0) {
      forceRender(n => n + 1);
      setTimeout(startAnim, 50);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [items, startAnim]);

  const displayed = items.length ? [...items, ...items] : [];

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        background: 'linear-gradient(90deg, var(--theme-surface) 0%, var(--theme-surface-2) 50%, var(--theme-surface) 100%)',
        borderTop:    '1px solid var(--theme-border-soft)',
        borderBottom: '1px solid var(--theme-border-soft)',
        height: 44,
        zIndex: 10,
      }}
    >
      {/* Left label badge */}
      <div
        className="absolute left-0 top-0 h-full z-20 flex items-center gap-2 px-4 shrink-0 select-none"
        style={{
          background: 'linear-gradient(90deg, var(--theme-primary) 0%, var(--theme-primary) 80%, transparent 100%)',
          minWidth: 140,
        }}
      >
        <AnimatePresence mode="wait">
          {live ? (
            <motion.span
              key="live"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5"
            >
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Radio size={12} className="text-white/90" />
              </motion.span>
              <span className="text-xs font-bold tracking-widest uppercase text-white/90">Live News</span>
            </motion.span>
          ) : (
            <motion.span
              key="offline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5"
            >
              <WifiOff size={12} className="text-white/60" />
              <span className="text-xs font-semibold tracking-wider uppercase text-white/60">Legal News</span>
            </motion.span>
          )}
        </AnimatePresence>

        {/* Edge fade from badge into ticker */}
        <div
          className="absolute right-0 top-0 h-full pointer-events-none"
          style={{
            width: 32,
            background: 'linear-gradient(90deg, var(--theme-primary) 0%, transparent 100%)',
          }}
        />
      </div>

      {/* Scrolling track */}
      <div
        ref={outerRef}
        className="absolute inset-0"
        style={{ left: 140, overflow: 'hidden' }}
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; setActiveIdx(null); }}
      >
        {loading ? (
          <div className="h-full flex items-center gap-2 px-4">
            {[0, 1, 2].map(i => (
              <motion.div key={i} className="h-3 rounded-full"
                style={{ width: [160, 220, 140][i], background: 'var(--theme-border-soft)' }}
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }} />
            ))}
          </div>
        ) : (
          <div
            ref={trackRef}
            className="flex items-center h-full gap-0"
            style={{ willChange: 'transform', whiteSpace: 'nowrap' }}
          >
            {displayed.map((item, idx) => (
              <a
                key={idx}
                href={item.url !== '#' ? item.url : undefined}
                target={item.url !== '#' ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="flex items-center gap-2 h-full px-5 shrink-0 group cursor-pointer no-underline"
                style={{ textDecoration: 'none' }}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
              >
                {/* Source tag */}
                <span
                  className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-sm shrink-0 transition-all duration-200"
                  style={{
                    background: activeIdx === idx ? 'var(--theme-primary)' : 'rgba(var(--theme-primary-rgb, 124,29,43),0.10)',
                    color: activeIdx === idx ? '#fff' : 'var(--theme-primary)',
                    border: '1px solid',
                    borderColor: activeIdx === idx ? 'var(--theme-primary)' : 'rgba(var(--theme-primary-rgb, 124,29,43),0.15)',
                  }}
                >
                  {item.source}
                </span>

                {/* Title */}
                <span
                  className="text-sm transition-colors duration-200"
                  style={{
                    color: activeIdx === idx ? 'var(--theme-primary)' : 'var(--theme-fg)',
                    fontWeight: activeIdx === idx ? 500 : 400,
                    maxWidth: 440,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.title}
                </span>

                {/* External link icon on hover */}
                <ExternalLink
                  size={11}
                  className="shrink-0 transition-all duration-200"
                  style={{
                    color: 'var(--theme-primary)',
                    opacity: activeIdx === idx ? 1 : 0,
                    transform: activeIdx === idx ? 'translateY(0)' : 'translateY(2px)',
                  }}
                />

                {/* Separator dot */}
                <span className="shrink-0 mx-1" style={{ color: 'var(--theme-border-soft)', fontSize: 18 }}>·</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Right fade */}
      <div
        className="absolute right-0 top-0 h-full pointer-events-none z-10"
        style={{
          width: 80,
          background: 'linear-gradient(90deg, transparent 0%, var(--theme-surface) 100%)',
        }}
      />
    </div>
  );
}
