import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Footer from '../Footer';

export default function FinalCTA() {
  return (
    <>
      <section className="relative min-h-[70vh] flex items-center justify-center px-6 py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white to-primary/5" />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="font-serif text-5xl md:text-7xl font-bold text-foreground mb-8 leading-tight"
          >
            The Future of Law <br />
            <span className="text-primary italic">Is Here</span>
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mb-6"
          >
            <Link to="/login">
              <motion.button
                whileHover={{ scale: 1.06, boxShadow: '0 0 48px 12px rgba(201,168,76,0.55), 0 8px 32px rgba(201,168,76,0.4)' }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="px-14 py-5 rounded-sm font-bold text-xl relative overflow-hidden group"
                style={{
                  background: 'linear-gradient(135deg, #d4a832 0%, #f0c040 40%, #C9A84C 60%, #e8b830 100%)',
                  color: '#7C1D2B',
                  boxShadow: '0 0 28px 6px rgba(201,168,76,0.38), 0 4px 20px rgba(201,168,76,0.3)',
                  textShadow: '0 1px 2px rgba(124,29,43,0.2)',
                }}
              >
                <span className="relative z-10 flex items-center gap-2">
                  Get Started
                  <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </motion.button>
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.6 }}
            className="text-foreground/60 font-medium tracking-wide uppercase text-sm"
          >
            Join 50,000+ legal professionals already using Gavel &amp; Brief
          </motion.p>
        </div>
      </section>
      <Footer />
    </>
  );
}
