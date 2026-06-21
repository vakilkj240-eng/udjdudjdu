import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, Send, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import API_URL from '../lib/api';

const SurveyModal = () => {
  const { user } = useAuth();
  const [surveys, setSurveys] = useState([]);
  const [current, setCurrent] = useState(null);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'client') return;
    const fetchSurveys = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/survey/pending`);
        if (data?.length > 0) {
          setSurveys(data);
          setCurrent(data[0]);
        }
      } catch {}
    };
    const timer = setTimeout(fetchSurveys, 5000);
    return () => clearTimeout(timer);
  }, [user]);

  const handleSubmit = async () => {
    if (!rating || !current) return;
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/survey/submit`, {
        survey_id: current.id,
        rating,
        comment,
      });
      setDone(true);
      setTimeout(() => {
        advanceToNext();
      }, 2200);
    } catch {
      setSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    if (!current) return;
    try {
      await axios.post(`${API_URL}/api/survey/dismiss`, { survey_id: current.id });
    } catch {}
    advanceToNext();
  };

  const advanceToNext = () => {
    const remaining = surveys.filter(s => s.id !== current?.id);
    setSurveys(remaining);
    setDone(false);
    setRating(0);
    setComment('');
    setSubmitting(false);
    setCurrent(remaining.length > 0 ? remaining[0] : null);
  };

  const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
  const starColor = (i) => (i <= (hovered || rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-200');

  if (!current) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="survey-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      >
        <motion.div
          key="survey-card"
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 24 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-400 to-orange-500 px-6 pt-6 pb-8">
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl bg-white/25 flex items-center justify-center">
                <Star className="w-5 h-5 text-white fill-white" />
              </div>
              <div>
                <p className="text-white/80 text-xs font-medium uppercase tracking-wider">Case Completed</p>
                <h2 className="text-white text-lg font-bold leading-tight">How did it go?</h2>
              </div>
            </div>
          </div>

          {/* Floating avatar */}
          <div className="flex justify-center -mt-6 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-lg font-bold shadow-lg border-2 border-white">
              {current.lawyer_name?.charAt(0) || 'L'}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="px-6 pb-8 text-center"
              >
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-lg font-bold text-slate-900">Thank you!</p>
                <p className="text-sm text-slate-500 mt-1">Your review helps improve legal services for everyone.</p>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-6 pb-6"
              >
                <div className="text-center mb-5">
                  <p className="font-semibold text-slate-900">{current.lawyer_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{current.case_type} Case</p>
                </div>

                {/* Star Rating */}
                <div className="flex justify-center gap-2 mb-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <button
                      key={i}
                      onMouseEnter={() => setHovered(i)}
                      onMouseLeave={() => setHovered(0)}
                      onClick={() => setRating(i)}
                      className="transition-transform hover:scale-110 active:scale-95"
                    >
                      <Star className={`w-9 h-9 transition-colors ${starColor(i)}`} />
                    </button>
                  ))}
                </div>
                <p className="text-center text-sm font-semibold text-amber-600 h-5 mb-4">
                  {labels[hovered || rating] || ''}
                </p>

                {/* Comment */}
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Share your experience (optional)..."
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-400 resize-none mb-4"
                />

                <div className="flex gap-3">
                  <button
                    onClick={handleDismiss}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    Skip for now
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!rating || submitting}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submitting ? 'Sending...' : 'Submit Review'}
                  </button>
                </div>

                {surveys.length > 1 && (
                  <p className="text-center text-[11px] text-slate-400 mt-3">
                    {surveys.length} pending review{surveys.length !== 1 ? 's' : ''}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SurveyModal;
