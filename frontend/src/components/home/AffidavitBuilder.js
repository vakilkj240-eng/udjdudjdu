import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

export default function AffidavitBuilder() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-80px' });

  return (
    <section className="py-32 px-6 md:px-12 bg-transparent relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 60% at 30% 50%, rgba(124,29,43,0.03) 0%, transparent 70%)' }} />

      <div className="max-w-7xl mx-auto flex flex-col-reverse lg:flex-row items-center gap-16" ref={sectionRef}>
        <div className="lg:w-1/2 w-full flex justify-center">
          <motion.div
            className="relative w-full max-w-md bg-white shadow-2xl rounded-sm overflow-visible"
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{ border: '1px solid rgba(124,29,43,0.1)', boxShadow: '0 25px 50px rgba(124,29,43,0.08)' }}
          >
            <div className="h-3 w-full bg-primary rounded-t-sm" />
            <div className="p-8 space-y-5">
              <motion.div
                className="px-3 py-2 rounded-sm flex items-center gap-3"
                style={{ background: 'rgba(124,29,43,0.08)', width: 'fit-content' }}
                initial={{ opacity: 0, scaleX: 0 }}
                animate={isInView ? { opacity: 1, scaleX: 1 } : {}}
                transition={{ duration: 0.7, delay: 0.35, ease: 'easeOut', transformOrigin: 'left' }}
              >
                <span className="font-serif font-bold text-primary text-sm tracking-widest">GAVEL &amp; BRIEF</span>
                <span className="text-foreground/30 text-xs">|</span>
                <span className="text-foreground/45 text-xs tracking-wider">Legal Intelligence</span>
              </motion.div>

              <div className="space-y-2.5 pt-1">
                {[100, 100, 100, 100, 100, 60].map((w, i) => (
                  <motion.div key={i} className="h-2.5 rounded-sm bg-foreground/[0.085]"
                    initial={{ scaleX: 0 }}
                    animate={isInView ? { scaleX: 1 } : {}}
                    transition={{ duration: 1.1, delay: 0.55 + i * 0.16, ease: 'easeOut', transformOrigin: 'left' }}
                    style={{ width: `${w}%` }} />
                ))}
              </div>

              <div className="space-y-2.5 pt-2">
                {[100, 100, 100, 42].map((w, i) => (
                  <motion.div key={i} className="h-2.5 rounded-sm bg-primary/[0.08]"
                    initial={{ scaleX: 0 }}
                    animate={isInView ? { scaleX: 1 } : {}}
                    transition={{ duration: 1.1, delay: 1.85 + i * 0.16, ease: 'easeOut', transformOrigin: 'left' }}
                    style={{ width: `${w}%` }} />
                ))}
              </div>

              <div className="pt-5 flex justify-end">
                <motion.div className="h-px bg-accent"
                  initial={{ scaleX: 0 }}
                  animate={isInView ? { scaleX: 1 } : {}}
                  transition={{ duration: 0.9, delay: 2.9, ease: 'easeInOut', transformOrigin: 'right' }}
                  style={{ width: '140px' }} />
              </div>
              <div className="h-4" />
            </div>

            <motion.div
              className="absolute -right-1 -bottom-5 text-white text-xs font-bold tracking-wider px-5 py-2.5 shadow-lg rounded-sm"
              style={{ background: '#b8913e', boxShadow: '0 8px 20px rgba(184,145,62,0.3)' }}
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ delay: 3.4, type: 'spring', stiffness: 220 }}
            >
              Draft Complete
            </motion.div>
          </motion.div>
        </div>

        <div className="lg:w-1/2">
          <motion.p initial={{ opacity: 0, y: 12 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}
            className="text-xs uppercase tracking-[0.25em] text-accent font-semibold mb-4">03 — Affidavit Builder</motion.p>

          <motion.h2 initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }} animate={isInView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
            Built for the Next<br />Generation of Law
          </motion.h2>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, delay: 0.25 }}
            className="text-lg text-foreground/65 font-light mb-8 leading-relaxed">
            Drafting affidavits and motions takes hours. Gavel &amp; Brief cuts it down to minutes. Input the raw facts, and watch our model structure legally sound, jurisdiction-compliant documents in real-time.
          </motion.p>
        </div>
      </div>
    </section>
  );
}
