import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Search, MapPin, Briefcase, ChevronRight, Users, Filter, Building2 } from 'lucide-react';
import API_URL from '../lib/api';

const SPECIALIZATIONS = ['All', 'Criminal', 'Family', 'Corporate', 'Property', 'Civil', 'Labour', 'Tax'];
const LOCATIONS = ['All', 'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Ahmedabad', 'Hyderabad', 'Kolkata'];

const StarRating = ({ rating }) => (
  <div className="flex items-center gap-1">
    {[1,2,3,4,5].map(i => (
      <svg key={i} className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? 'text-amber-400' : 'text-slate-200 dark:text-slate-700'}`} fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
    <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">{rating?.toFixed(1)}</span>
  </div>
);

const FindLawyers = () => {
  const navigate = useNavigate();
  const [lawyers, setLawyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');

  useEffect(() => {
    axios.get(`${API_URL}/api/lawyers`)
      .then(r => setLawyers(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = lawyers.filter(l => {
    const matchSearch = !search || l.name.toLowerCase().includes(search.toLowerCase()) || (l.specialization||'').toLowerCase().includes(search.toLowerCase()) || (l.location||'').toLowerCase().includes(search.toLowerCase());
    const matchSpec = selectedSpec === 'All' || l.specialization === selectedSpec;
    const matchLoc = selectedLocation === 'All' || l.location === selectedLocation;
    return matchSearch && matchSpec && matchLoc;
  });

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--theme-bg)', isolation: 'isolate' }}>
      <div aria-hidden="true" className="page-gold-pattern" style={{ position: 'fixed', inset: 0, zIndex: -1, backgroundImage: `url(${process.env.PUBLIC_URL}/gold-pattern.png)`, backgroundRepeat: 'repeat', backgroundSize: '320px 320px', opacity: 0.18, pointerEvents: 'none' }} />
      <div className="relative z-10">
      <Navbar />

      {/* Hero */}
      <div className="py-14 px-6" style={{ background: 'linear-gradient(135deg, #7C1D2B 0%, #9b2335 55%, #4a1118 100%)' }}>
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-xs font-semibold"
            style={{ background: 'rgba(201,168,76,0.2)', color: '#F0C84A', border: '1px solid rgba(201,168,76,0.3)' }}>
            <Users className="w-3.5 h-3.5" />
            500+ Verified Lawyers Across India
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Find Your Lawyer</h1>
          <p className="mb-8" style={{ color: 'rgba(255,255,255,0.65)' }}>Browse verified lawyers, check availability, and book an appointment</p>
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by name, specialisation, or city..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>
      </div>

      {/* Filters — sticky bar */}
      <div className="border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#141414] sticky top-0 z-10 shadow-sm dark:shadow-[0_1px_0_rgba(212,175,55,0.12)]">
        <div className="max-w-5xl mx-auto px-6 py-3 flex gap-4 overflow-x-auto no-scrollbar items-center">
          <Filter className="w-4 h-4 text-slate-400 dark:text-[#D4AF37] flex-shrink-0" />

          {/* Specialization chips */}
          <div className="flex gap-2">
            {SPECIALIZATIONS.map(s => (
              <button key={s} onClick={() => setSelectedSpec(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  selectedSpec === s
                    ? 'bg-slate-900 text-white dark:bg-[#D4AF37] dark:text-[#0d0d0d]'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/15'
                }`}>
                {s}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-white/10 flex-shrink-0" />

          {/* Location chips */}
          <div className="flex gap-2">
            {LOCATIONS.map(l => (
              <button key={l} onClick={() => setSelectedLocation(l)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  selectedLocation === l
                    ? 'bg-amber-500 text-white dark:bg-[#D4AF37] dark:text-[#0d0d0d]'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/15'
                }`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[1,2,3,4].map(i => <div key={i} className="h-52 rounded-2xl bg-slate-200 dark:bg-white/5 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400 dark:text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No lawyers found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{filtered.length} lawyer{filtered.length !== 1 ? 's' : ''} found</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filtered.map((lawyer, i) => (
                <motion.div key={lawyer.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white dark:bg-[#141414] rounded-2xl border border-slate-200 dark:border-white/10 p-6 hover:shadow-lg dark:hover:shadow-[0_8px_30px_rgba(212,175,55,0.1)] hover:border-slate-300 dark:hover:border-[rgba(212,175,55,0.3)] transition-all cursor-pointer group"
                  onClick={() => navigate(`/client/lawyers/${lawyer.id}`)}>
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                      {lawyer.name.split(' ').pop().charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-[#e8e8e8] group-hover:text-amber-600 dark:group-hover:text-[#D4AF37] transition-colors">{lawyer.name}</h3>
                          <p className="text-xs text-amber-600 dark:text-[#D4AF37] font-medium">{lawyer.specialization} Law</p>
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-[#e8e8e8]">₹{lawyer.consultation_fee?.toLocaleString() || '—'}<span className="text-xs font-normal text-slate-400 dark:text-slate-500">/hr</span></span>
                      </div>
                      <StarRating rating={lawyer.rating} />
                    </div>
                  </div>

                  {lawyer.firm_name && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-purple-700 dark:text-[#D4AF37] bg-purple-50 dark:bg-[rgba(212,175,55,0.08)] border border-purple-100 dark:border-[rgba(212,175,55,0.18)] rounded-full px-2.5 py-0.5 w-fit">
                      <Building2 className="w-3 h-3" />{lawyer.firm_name}
                    </div>
                  )}

                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{lawyer.bio || 'Experienced legal professional.'}</p>

                  <div className="mt-4 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lawyer.location}</span>
                    <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{lawyer.experience_years || '—'} yrs exp</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{lawyer.cases_handled || '—'} cases</span>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex gap-1 flex-wrap">
                      {(lawyer.languages || []).slice(0, 3).map(lang => (
                        <span key={lang} className="text-xs bg-slate-100 dark:bg-white/8 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{lang}</span>
                      ))}
                    </div>
                    <span className="text-xs text-amber-600 dark:text-[#D4AF37] font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                      Book Now <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
};

export default FindLawyers;
