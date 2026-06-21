import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Loader2, Video, Calendar, Clock, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import API_URL from '../lib/api';

const Consultations = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConsultations();
  }, []);

  const fetchConsultations = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/consultations`, {  });
      setConsultations(data);
    } catch (err) {
      console.error('Failed to fetch consultations', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" data-testid="consultations-page">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-slate-900" data-testid="consultations-title">My Consultations</h1>
          <p className="text-sm text-slate-500 mt-1">Your booked video consultations</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-slate-400 animate-spin" />
          </div>
        ) : consultations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center" data-testid="no-consultations">
            <Video className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-800 mb-2">No consultations yet</h3>
            <p className="text-sm text-slate-500">Book a consultation through the Intelligence Engine</p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="consultations-list">
            {consultations.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
                data-testid={`consultation-item-${i}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900">{c.package_name}</h3>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Paid</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{c.duration}</span>
                      <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" />${c.amount}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-2">
                      {user?.role === 'client' ? `Lawyer: ${c.lawyer_name}` : `Client: ${c.client_name}`}
                    </p>
                  </div>
                  {c.video_room_id && (
                    <button
                      onClick={() => navigate(`/video/${c.video_room_id}`)}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                      data-testid={`join-consultation-${i}`}
                    >
                      <Video className="w-4 h-4" /> Join Room
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Consultations;
