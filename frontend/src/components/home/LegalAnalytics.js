import { useRef, useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';

function Counter({ to, suffix = '' }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let start;
    const dur = 2000;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      setVal(Math.floor(p * p * to));
      if (p < 1) requestAnimationFrame(step); else setVal(to);
    };
    requestAnimationFrame(step);
  }, [inView, to]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

const CHART_DATA = {
  civil:     [0.38, 0.50, 0.62, 0.55, 0.70, 0.65, 0.78, 0.72, 0.82, 0.75, 0.88, 0.92],
  criminal:  [0.45, 0.55, 0.48, 0.68, 0.60, 0.75, 0.65, 0.80, 0.70, 0.78, 0.72, 0.85],
  corporate: [0.32, 0.48, 0.58, 0.52, 0.68, 0.72, 0.65, 0.80, 0.75, 0.82, 0.78, 0.90],
};
const QUARTERS = ["Q1'21","Q2","Q3","Q4","Q1'22","Q2","Q3","Q4","Q1'23","Q2","Q3","Q4"];

function AreaChart({ isInView }) {
  const canvasRef = useRef(null);
  const [tab, setTab] = useState('civil');

  // Refs shared with the raf loop
  const progressRef = useRef(0);
  const tabDataRef = useRef(CHART_DATA['civil']);
  const isInViewRef = useRef(isInView);
  const rafRef = useRef(null);

  // Keep refs in sync
  useEffect(() => { isInViewRef.current = isInView; }, [isInView]);
  useEffect(() => {
    tabDataRef.current = CHART_DATA[tab];
    progressRef.current = 0; // reset draw progress on tab switch
  }, [tab]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      // Only advance progress when in view and not yet complete
      if (isInViewRef.current && progressRef.current < 1) {
        progressRef.current = Math.min(progressRef.current + 0.025, 1);
      }

      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const data = tabDataRef.current;
      const n = data.length;
      const padL = 14, padR = 14, padT = 12, padB = 22;
      const chartW = W - padL - padR;
      const chartH = H - padT - padB;
      const maxX = padL + chartW * progressRef.current;

      // Static positions — no t/wave offset, so the line stays still once drawn
      const getX = (i) => padL + (i / (n - 1)) * chartW;
      const getY = (i) => {
        const v = Math.max(0.05, Math.min(0.99, data[i]));
        return padT + chartH - v * chartH * 0.9;
      };

      // Clip to how far we've drawn
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, maxX + 2, H);
      ctx.clip();

      const drawCurve = () => {
        ctx.beginPath();
        ctx.moveTo(getX(0), getY(0));
        for (let i = 1; i < n; i++) {
          const px = getX(i - 1), py = getY(i - 1);
          const cx1 = px + (getX(i) - px) / 2.8;
          const cx2 = getX(i) - (getX(i) - px) / 2.8;
          ctx.bezierCurveTo(cx1, py, cx2, getY(i), getX(i), getY(i));
        }
      };

      // Area fill
      drawCurve();
      ctx.lineTo(maxX, padT + chartH);
      ctx.lineTo(padL, padT + chartH);
      ctx.closePath();
      const areaGrad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
      areaGrad.addColorStop(0, 'rgba(201,168,76,0.38)');
      areaGrad.addColorStop(0.55, 'rgba(201,168,76,0.10)');
      areaGrad.addColorStop(1, 'rgba(201,168,76,0.01)');
      ctx.fillStyle = areaGrad;
      ctx.fill();

      // Line stroke
      drawCurve();
      ctx.strokeStyle = '#C9A84C';
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#C9A84C';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Dots
      for (let i = 0; i < n; i++) {
        if (getX(i) > maxX + 1) break;
        ctx.beginPath();
        ctx.arc(getX(i), getY(i), 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#C9A84C';
        ctx.shadowColor = '#C9A84C';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.restore();

      // X-axis labels
      ctx.font = '10px Inter,sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.38)';
      ctx.textAlign = 'center';
      for (let i = 0; i < n; i += 3) {
        ctx.fillText(QUARTERS[i], getX(i), H - 4);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []); // Single loop — runs once, reads from refs

  const tabs = [
    { key: 'civil', label: 'Civil' },
    { key: 'criminal', label: 'Criminal' },
    { key: 'corporate', label: 'Corporate' },
  ];

  return (
    <div className="rounded-xl overflow-hidden h-full" style={{ background: '#100805', border: '1px solid rgba(201,168,76,0.15)' }}>
      <div className="flex items-start justify-between px-5 pt-5 pb-3">
        <div>
          <p className="text-white font-semibold text-sm tracking-wide leading-tight">Caseload momentum</p>
          <p className="text-white/35 text-[10px] uppercase tracking-[0.15em] mt-1">Last 12 quarters</p>
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          {tabs.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className="text-[10px] uppercase tracking-[0.12em] font-semibold px-3 py-1 rounded-full transition-all duration-300"
              style={{
                border: tab === key ? '1px solid #C9A84C' : '1px solid rgba(255,255,255,0.14)',
                color: tab === key ? '#C9A84C' : 'rgba(255,255,255,0.38)',
                background: tab === key ? 'rgba(201,168,76,0.08)' : 'transparent',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <canvas ref={canvasRef} className="w-full" style={{ height: '170px', display: 'block' }} />
    </div>
  );
}

const CONSOLE_ROWS = [
  { label: 'AI Analysis',      desc: 'Relevant laws, risk, and next actions', pct: 92 },
  { label: 'Lawyer Match',     desc: 'Specialisation and location fit',       pct: 78 },
  { label: 'Shared Workspace', desc: 'Notes, files, chat, and timeline',      pct: 86 },
];

function LiveCaseConsole({ isInView }) {
  return (
    <div className="rounded-xl overflow-hidden h-full flex flex-col"
      style={{ background: 'linear-gradient(145deg,#1a0a04 0%,#1f0c06 100%)', border: '1px solid rgba(201,168,76,0.13)' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <p className="text-white text-[11px] font-bold uppercase tracking-[0.22em]">Live Case Console</p>
        <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />AI Active
        </span>
      </div>
      <div className="px-5 py-4 space-y-5 flex-1">
        {CONSOLE_ROWS.map((row, i) => (
          <div key={i}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-white text-sm font-semibold">{row.label}</p>
                <p className="text-white/35 text-[11px] mt-0.5">{row.desc}</p>
              </div>
              <motion.span className="text-accent font-bold text-sm ml-4 flex-shrink-0"
                initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : {}} transition={{ delay: 0.8 + i * 0.3 }}>
                {row.pct}%
              </motion.span>
            </div>
            <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background: 'linear-gradient(to right, #7C1D2B 0%, #b86030 45%, #C9A84C 100%)',
                  boxShadow: '0 0 12px rgba(201,168,76,0.45)',
                }}
                initial={{ width: '0%' }}
                animate={isInView ? { width: [`0%`, `${row.pct + 9}%`, `${row.pct + 3}%`, `${row.pct}%`] } : {}}
                transition={{ duration: 2.0, times: [0, 0.72, 0.88, 1], ease: 'easeOut', delay: 0.5 + i * 0.28 }}
              />
              <motion.div
                className="absolute inset-y-0 w-3 rounded-full"
                style={{ background: 'rgba(255,220,100,0.55)', filter: 'blur(3px)' }}
                initial={{ left: '0%' }}
                animate={isInView ? { left: [`0%`, `${row.pct - 2}%`] } : {}}
                transition={{ duration: 2.0, delay: 0.5 + i * 0.28, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LegalAnalytics() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-80px' });

  const stats = [
    { label: 'Cases Handled',  value: 50000, suffix: '+' },
    { label: 'Success Rate',   value: 98,    suffix: '%' },
    { label: 'Expert Lawyers', value: 500,   suffix: '+' },
  ];

  return (
    <section id="analytics" className="py-32 px-6 md:px-12 bg-transparent relative" ref={sectionRef}>
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8 }} className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.25em] text-accent font-semibold mb-4">05 — Legal Analytics</p>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4">Precision Legal Intelligence</h2>
          <p className="text-lg text-foreground/60 max-w-2xl mx-auto font-light">
            Data doesn't lie. Gavel &amp; Brief provides predictive analytics on case outcomes, judge behaviours, and settlement probabilities.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {stats.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, delay: i * 0.15 }}
              className="bg-white border border-border p-8 rounded-xl shadow-sm flex flex-col items-center text-center">
              <div className="font-serif text-5xl font-bold text-primary mb-2"><Counter to={s.value} suffix={s.suffix} /></div>
              <div className="text-xs uppercase tracking-widest text-foreground/55 font-semibold">{s.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" style={{ minHeight: '270px' }}>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 1, delay: 0.5 }} className="h-full">
            <AreaChart isInView={isInView} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 1, delay: 0.7 }} className="h-full">
            <LiveCaseConsole isInView={isInView} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
