import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const testimonials = [
  {
    quote: 'Gavel & Brief reduced our contract review time by 80%. What used to take days now takes minutes, with higher accuracy.',
    name: 'Sarah Chen',
    title: 'Corporate Lawyer',
  },
  {
    quote: 'The predictive analytics on judge rulings completely changed how we formulate our litigation strategy.',
    name: 'Raj Mehta',
    title: 'Senior Partner',
  },
  {
    quote: 'As a client, having transparent access to AI-driven case analysis gave me immense confidence in my legal team.',
    name: 'Priya Kapoor',
    title: 'Client',
  },
];

export default function Testimonials() {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: '-100px' });

  return (
    <section id="testimonials" className="py-32 px-6 md:px-12 bg-transparent relative">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="max-w-7xl mx-auto" ref={containerRef}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4">Trusted by the Elite</h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 50, filter: 'blur(10px)' }}
              animate={isInView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
              transition={{ duration: 0.8, delay: i * 0.2 }}
              whileHover={{ scale: 1.02, rotateX: 5, rotateY: -5, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08)' }}
              className="bg-white border border-border p-8 rounded-sm flex flex-col justify-between"
              style={{ transformPerspective: 1000 }}
            >
              <div className="mb-8">
                <svg className="w-8 h-8 text-accent/50 mb-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
                <p className="text-foreground/80 font-light leading-relaxed italic">"{t.quote}"</p>
              </div>
              <div>
                <div className="font-bold text-foreground">{t.name}</div>
                <div className="text-sm text-primary font-medium">{t.title}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
