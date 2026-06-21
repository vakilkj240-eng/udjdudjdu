import { useRef, useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';

function LissajousCanvas({ onDone }) {
  const canvasRef = useRef(null);
  const doneFired = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;

    const trail = [];
    const MAX_TRAIL = 300;
    let t = 0;
    const SPEED = 0.038;
    let fading = false;
    let fadeAlpha = 1;
    let raf;

    const cx = W / 2, cy = H / 2;
    const A = W * 0.44;
    const B = H * 0.40;

    const tick = () => {
      if (!fading) {
        t += SPEED;
        const x = cx + A * Math.sin(2 * t + Math.PI / 2);
        const y = cy + B * Math.sin(t);
        trail.push({ x, y });
        if (trail.length > MAX_TRAIL) trail.shift();
        if (t >= Math.PI * 2 && !doneFired.current) fading = true;
      } else {
        fadeAlpha -= 0.035;
        if (fadeAlpha <= 0 && !doneFired.current) {
          doneFired.current = true;
          cancelAnimationFrame(raf);
          onDone();
          return;
        }
      }

      ctx.clearRect(0, 0, W, H);

      for (let i = 1; i < trail.length; i++) {
        const prog = i / trail.length;
        const a = prog * 0.9 * (fading ? fadeAlpha : 1);
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = `rgba(201,168,76,${a})`;
        ctx.lineWidth = 0.8 + prog * 2.2;
        ctx.shadowColor = '#C9A84C';
        ctx.shadowBlur = 10 * prog;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      if (trail.length && !fading) {
        const last = trail[trail.length - 1];
        const g = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, 10);
        g.addColorStop(0, `rgba(255,230,80,${fading ? fadeAlpha : 1})`);
        g.addColorStop(0.4, `rgba(201,168,76,${0.6 * (fading ? fadeAlpha : 1)})`);
        g.addColorStop(1, 'rgba(201,168,76,0)');
        ctx.beginPath();
        ctx.arc(last.x, last.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 22;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return <canvas ref={canvasRef} className="w-full" style={{ height: '175px', display: 'block' }} />;
}

const BASE_HEIGHTS = [16, 28, 48, 65, 80, 92, 75, 96, 82, 68, 90, 76, 56, 88, 70, 50, 84, 94, 66, 78, 90, 60, 74, 86, 64, 56, 76, 92, 68, 62, 82, 88];

function EqualizerBars({ active }) {
  const [heights, setHeights] = useState(BASE_HEIGHTS.map(() => 0));
  const phaseRef = useRef('idle');
  const growRef = useRef(0);
  const tRef = useRef(0);
  const rafRef = useRef();

  useEffect(() => {
    if (!active) {
      phaseRef.current = 'idle';
      growRef.current = 0;
      tRef.current = 0;
      setHeights(BASE_HEIGHTS.map(() => 0));
      return;
    }

    // Short delay after phase switch, then grow all bars uniformly together
    const delay = setTimeout(() => {
      phaseRef.current = 'growing';
      growRef.current = 0;

      const animate = () => {
        if (phaseRef.current === 'growing') {
          growRef.current = Math.min(growRef.current + 0.022, 1);
          const e = 1 - Math.pow(1 - growRef.current, 3);
          // All bars grow uniformly — same progress applied to all
          setHeights(BASE_HEIGHTS.map(h => h * e));
          if (growRef.current >= 1) {
            phaseRef.current = 'oscillating';
          }
        } else if (phaseRef.current === 'oscillating') {
          tRef.current += 0.04;
          const t = tRef.current;
          setHeights(BASE_HEIGHTS.map((base, i) => {
            const wave = Math.sin(t * 2.2 + i * 0.45) * 14 + Math.sin(t * 1.4 + i * 0.8) * 8;
            return Math.max(6, Math.min(100, base + wave));
          }));
        }
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
    }, 120);

    return () => {
      clearTimeout(delay);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  return (
    <div className="flex items-end justify-center gap-[3px] px-3" style={{ height: '175px', paddingTop: '12px', paddingBottom: '12px' }}>
      {heights.map((h, i) => {
        const prog = i / (heights.length - 1);
        const hue = Math.round(0 + prog * 40);
        const sat = Math.round(55 + prog * 15);
        const light = Math.round(30 + prog * 28);
        return (
          <div key={i} className="flex-1 rounded-t-[2px]"
            style={{
              height: `${h}%`,
              background: `hsl(${hue},${sat}%,${light}%)`,
              minWidth: '5px', maxWidth: '22px',
              transition: 'height 60ms linear',
            }}
          />
        );
      })}
    </div>
  );
}

export default function VoiceAI() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-80px' });
  const [phase, setPhase] = useState('idle');

  useEffect(() => {
    if (isInView && phase === 'idle') setPhase('lissajous');
  }, [isInView, phase]);

  return (
    <section className="py-32 px-6 md:px-12 bg-transparent relative overflow-hidden" ref={sectionRef}>
      <div className="max-w-5xl mx-auto text-center relative z-10">
        <motion.p initial={{ opacity: 0, y: 12 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}
          className="text-xs uppercase tracking-[0.3em] text-accent font-semibold mb-6 flex items-center justify-center gap-3">
          <span className="block w-8 h-px bg-accent" />04 — Legal Voice AI<span className="block w-8 h-px bg-accent" />
        </motion.p>

        <motion.h2 initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }} animate={isInView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.9, delay: 0.1 }}
          className="font-serif text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-[1.1]">
          Your voice,{' '}
          <em style={{ fontStyle: 'italic', color: '#7C1D2B' }}>heard in chambers.</em>
        </motion.h2>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, delay: 0.3 }}
          className="text-lg text-foreground/65 font-light max-w-2xl mx-auto mb-14 leading-relaxed">
          Speak naturally. Gavel &amp; Brief's legal engine translates intent into argument, cross-examination drills, and oral motion prep — in twenty-two languages.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 1, delay: 0.5 }}
          className="bg-white rounded-xl shadow-xl overflow-hidden mx-auto max-w-3xl"
          style={{ border: '1px solid rgba(201,168,76,0.15)', boxShadow: '0 25px 50px rgba(124,29,43,0.08)' }}>

          <div className="relative bg-white" style={{ minHeight: '175px' }}>
            {phase === 'lissajous' && (
              <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                <LissajousCanvas onDone={() => setPhase('bars')} />
              </motion.div>
            )}
            <motion.div className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: phase === 'bars' ? 1 : 0 }}
              transition={{ duration: 0.5 }}>
              <EqualizerBars active={phase === 'bars'} />
            </motion.div>
          </div>

          <div className="flex items-center justify-center gap-6 px-6 py-4 border-t" style={{ borderColor: 'rgba(201,168,76,0.15)' }}>
            {['Listening', '22 Languages', 'Privileged'].map((label, i) => (
              <span key={i} className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-foreground/45 font-semibold">
                {i > 0 && <span className="w-1 h-1 rounded-full bg-accent opacity-60" />}{label}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
