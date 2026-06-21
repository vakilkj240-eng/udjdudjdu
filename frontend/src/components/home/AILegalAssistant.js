import { motion } from 'framer-motion';
import { FileText, Search, FileEdit, Scale } from 'lucide-react';

const capabilities = [
  {
    icon: <FileText className="w-8 h-8 mb-4 text-primary" />,
    title: 'Document Analysis',
    description: 'Instantly process thousands of pages to extract key facts, entities, and timelines with 99.9% accuracy.',
  },
  {
    icon: <Search className="w-8 h-8 mb-4 text-accent" />,
    title: 'Case Research',
    description: 'Navigate decades of jurisprudence in seconds. Find the perfect precedent before opposing counsel even starts looking.',
  },
  {
    icon: <FileEdit className="w-8 h-8 mb-4 text-primary" />,
    title: 'Contract Review',
    description: 'Automatically highlight liabilities, missing clauses, and non-standard terms across complex agreements.',
  },
  {
    icon: <Scale className="w-8 h-8 mb-4 text-accent" />,
    title: 'Legal Drafting',
    description: 'Generate robust initial drafts for motions, briefs, and contracts tailored to your specific jurisdiction.',
  },
];

export default function AILegalAssistant() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 40, filter: 'blur(10px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.8, ease: 'easeOut' } },
  };

  return (
    <section id="features" className="py-32 px-6 md:px-12 bg-transparent relative">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4">AI Meets the Courtroom</h2>
          <p className="text-lg text-foreground/60 max-w-2xl mx-auto font-light">
            Gavel &amp; Brief doesn't replace lawyers; it elevates them. Our proprietary models are trained on millions of successful cases.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {capabilities.map((cap, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              whileHover={{ y: -10, transition: { duration: 0.3 } }}
              className="bg-white border border-border p-8 rounded-sm shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 relative overflow-hidden group"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
              {cap.icon}
              <h3 className="font-serif text-xl font-semibold mb-3">{cap.title}</h3>
              <p className="text-sm text-foreground/70 leading-relaxed">{cap.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
