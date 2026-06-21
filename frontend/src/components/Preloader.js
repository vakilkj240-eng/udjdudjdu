import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';

const Preloader = ({ onComplete }) => {
  const { isDark } = useTheme();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);

  const bg = isDark ? '#0d0d0d' : '#ffffff';
  const edgeFade = isDark ? '#0d0d0d' : '#ffffff';
  const titleColor = isDark ? '#D4AF37' : '#6D071A';
  const progressTrack = isDark ? 'rgba(212,175,55,0.1)' : 'rgba(109,7,26,0.09)';
  const progressText = isDark ? 'rgba(212,175,55,0.45)' : 'rgba(109,7,26,0.38)';
  const dotColor = isDark ? '#D4AF37' : '#C9A84C';
  const patternOpacity = isDark ? 0.06 : 0.22;

  useEffect(() => {
    const start = Date.now();
    const duration = 2200;
    let raf;
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / duration, 1);
      const eased = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      setProgress(Math.round(eased * 100));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          setVisible(false);
          setTimeout(onComplete, 550);
        }, 200);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="preloader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.015 }}
          transition={{ duration: 0.55, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex overflow-hidden"
          style={{ background: bg, transition: 'background 0.3s ease' }}
        >
          {/* Gold pattern backdrop */}
          <div
            className="absolute inset-0 pointer-events-none page-gold-pattern"
            style={{
              backgroundImage: `url(/gold-pattern.png)`,
              backgroundRepeat: 'repeat',
              backgroundSize: '68px 68px',
              opacity: patternOpacity,
            }}
          />

          {/* LEFT PANEL — Gold ribbon */}
          <div className="relative flex-shrink-0 h-full overflow-hidden" style={{ width: '43%' }}>
            <div className="absolute inset-0" style={{ background: bg }} />

            <motion.div
              className="absolute inset-0"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1], delay: 0 }}
            >
              <img src="/gold-ribbon.png" alt="" draggable={false}
                className="w-full h-full select-none"
                style={{ objectFit: 'cover', objectPosition: 'left center', filter: isDark ? 'brightness(0.8) saturate(1.3)' : 'none' }}
              />
            </motion.div>

            <motion.div
              className="absolute inset-0"
              initial={{ x: '-100%', scaleX: 0.6 }}
              animate={{ x: 0, scaleX: 1 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
              style={{ transformOrigin: 'left center' }}
            >
              <img src="/gold-ribbon.png" alt="" draggable={false}
                className="w-full h-full select-none"
                style={{
                  objectFit: 'cover', objectPosition: 'left center',
                  opacity: isDark ? 0.7 : 0.55,
                  mixBlendMode: isDark ? 'screen' : 'multiply',
                  filter: isDark ? 'brightness(0.9) saturate(1.4)' : 'brightness(1.08) saturate(1.1)',
                }}
              />
            </motion.div>

            <motion.div
              className="absolute inset-0"
              initial={{ x: '-100%', rotate: -8, scaleX: 0.4 }}
              animate={{ x: 0, rotate: 0, scaleX: 1 }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.24 }}
              style={{ transformOrigin: 'left bottom' }}
            >
              <img src="/gold-ribbon.png" alt="" draggable={false}
                className="w-full h-full select-none"
                style={{
                  objectFit: 'cover', objectPosition: 'left center',
                  opacity: isDark ? 0.5 : 0.35,
                  mixBlendMode: isDark ? 'screen' : 'overlay',
                  filter: isDark ? 'brightness(0.85) saturate(1.5)' : 'none',
                }}
              />
            </motion.div>

            {/* Shimmer sweep */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ background: isDark
                ? 'linear-gradient(105deg, transparent 15%, rgba(212,175,55,0.35) 48%, transparent 82%)'
                : 'linear-gradient(105deg, transparent 15%, rgba(255,255,255,0.65) 48%, transparent 82%)'
              }}
              initial={{ x: '-110%' }}
              animate={{ x: '110%' }}
              transition={{ duration: 0.75, ease: 'easeInOut', delay: 0.85 }}
            />

            {/* Edge fade */}
            <div
              className="absolute inset-y-0 right-0 pointer-events-none"
              style={{ width: '22%', background: `linear-gradient(to right, transparent, ${edgeFade})` }}
            />
          </div>

          {/* RIGHT PANEL — Logo + name + progress */}
          <div className="relative flex-1 flex flex-col items-center justify-center z-10 px-6">
            <motion.div
              initial={{ scale: 0.82, opacity: 0, y: 22 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
              className="flex flex-col items-center gap-5"
            >
              {/* Logo */}
              <motion.div
                animate={{ scale: [1, 1.04, 1], rotate: [0, -4, 4, -2, 0] }}
                transition={{ duration: 2.2, delay: 0.65, ease: 'easeInOut' }}
                className="w-28 h-28 rounded-full overflow-hidden flex items-center justify-center"
                style={{
                  boxShadow: isDark
                    ? '0 8px 40px rgba(212,175,55,0.45), 0 0 60px rgba(212,175,55,0.12)'
                    : '0 8px 40px rgba(201,168,76,0.38), 0 2px 14px rgba(109,7,26,0.16)',
                  border: '2.5px solid rgba(201,168,76,0.32)',
                  background: 'transparent',
                }}
              >
                <img src="/logo-circular.png" alt="Gavel & Brief" className="w-full h-full object-contain" />
              </motion.div>

              {/* Name */}
              <div className="text-center">
                <motion.h1
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.65 }}
                  className="font-serif font-bold mb-1.5"
                  style={{ color: titleColor, fontSize: '2.25rem', letterSpacing: '-0.02em', transition: 'color 0.3s ease' }}
                >
                  Gavel &amp; Brief
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.65, duration: 0.6 }}
                  className="text-xs font-light tracking-[0.22em] uppercase"
                  style={{ color: '#C9A84C' }}
                >
                  Legal Intelligence Platform
                </motion.p>
              </div>

              {/* Divider */}
              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ delay: 0.72, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  width: 260, height: 2,
                  background: 'linear-gradient(90deg, transparent, #C9A84C 30%, #e8c96a 60%, transparent)',
                  borderRadius: 999,
                }}
              />

              {/* Progress bar */}
              <div style={{ width: 260 }}>
                <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: progressTrack }}>
                  <div
                    className="h-full rounded-full transition-all duration-[80ms]"
                    style={{
                      width: `${progress}%`,
                      background: 'linear-gradient(90deg, #C9A84C, #e8c96a)',
                      boxShadow: isDark ? '0 0 12px rgba(212,175,55,0.7)' : '0 0 10px rgba(201,168,76,0.55)',
                    }}
                  />
                </div>
                <p className="text-center mt-2 text-xs" style={{ color: progressText, fontVariantNumeric: 'tabular-nums' }}>
                  {progress}%
                </p>
              </div>

              {/* Pulsing dots */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="flex gap-2.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="rounded-full"
                    style={{ width: 6, height: 6, background: dotColor }}
                    animate={{ scale: [1, 1.7, 1], opacity: [0.35, 1, 0.35] }}
                    transition={{ duration: 1.15, repeat: Infinity, delay: i * 0.24, ease: 'easeInOut' }}
                  />
                ))}
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Preloader;
