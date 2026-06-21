import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Calendar, Clock, Video, Phone, Building2, Loader2, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import API_URL from '../lib/api';

const MeetingIcon = ({ type }) => {
  if (type === 'video') return <Video className="w-4 h-4 text-blue-500" />;
  if (type === 'phone') return <Phone className="w-4 h-4 text-green-500" />;
  return <Building2 className="w-4 h-4 text-purple-500" />;
};

const StatusBadge = ({ status }) => {
  const map = {
    confirmed: 'bg-green-100 text-green-700',
    accepted: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-600',
    pending: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${map[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
};

const MyBookings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isLawyer = user?.role === 'lawyer';
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    axios.get(`${API_URL}/api/bookings`)
      .then(r => setBookings(r.data))
      .catch(() => toast.error('Failed to load bookings'))
      .finally(() => setLoading(false));
  }, []);

  const cancel = async (id) => {
    setActionLoading(id + '_cancel');
    try {
      await axios.put(`${API_URL}/api/bookings/${id}/cancel`);
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
      toast.success('Booking cancelled');
    } catch {
      toast.error('Failed to cancel');
    } finally {
      setActionLoading(null);
    }
  };

  const accept = async (id) => {
    setActionLoading(id + '_accept');
    try {
      await axios.put(`${API_URL}/api/bookings/${id}/accept`);
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'accepted' } : b));
      toast.success('Booking accepted — client has been notified!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to accept booking');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return new Date(y, m - 1, day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m} ${ampm}`;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 pt-4 pb-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isLawyer ? 'Client Appointments' : 'My Appointments'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isLawyer ? 'Manage your scheduled consultations' : 'All your booked consultations'}
            </p>
          </div>
          {!isLawyer && (
            <button onClick={() => navigate('/client/lawyers')}
              className="text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              style={{ background: '#7C1D2B' }}>
              + Book New
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-slate-300 animate-spin" /></div>
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
            <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-700 mb-1">
              {isLawyer ? 'No appointments yet' : 'No appointments yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              {isLawyer ? 'Client appointments will appear here' : 'Find a lawyer and book your first consultation'}
            </p>
            {!isLawyer && (
              <button onClick={() => navigate('/client/lawyers')} className="text-sm text-white px-5 py-2.5 rounded-xl"
                style={{ background: '#7C1D2B' }}>
                Find a Lawyer
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b, i) => (
              <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className={`bg-white rounded-xl border p-5 transition-all ${b.status === 'cancelled' ? 'border-slate-100 opacity-60' : 'border-slate-200 hover:shadow-md'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 text-white"
                      style={{ background: '#7C1D2B' }}>
                      {isLawyer
                        ? (b.client_name || 'C').charAt(0)
                        : (b.lawyer_name || 'L').split(' ').pop().charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">
                        {isLawyer ? b.client_name : b.lawyer_name}
                      </h3>
                      <p className="text-xs text-slate-500">{b.category}</p>
                    </div>
                  </div>
                  <StatusBadge status={b.status} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(b.scheduled_date)}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(b.scheduled_time)}</span>
                  <span className="flex items-center gap-1.5"><MeetingIcon type={b.meeting_type} />{b.meeting_type?.replace('_', ' ')}</span>
                  {b.consultation_fee && <span>₹{b.consultation_fee?.toLocaleString()}</span>}
                </div>

                {b.case_summary && <p className="mt-2 text-xs text-slate-500 line-clamp-1">{b.case_summary}</p>}

                {(b.status === 'confirmed' || b.status === 'accepted') && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {b.video_room_id && (
                      <button onClick={() => navigate(`/video/${b.video_room_id}`)}
                        className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-slate-800">
                        <Video className="w-3 h-3" /> Join Call
                      </button>
                    )}
                    {isLawyer && b.status === 'confirmed' && (
                      <button
                        onClick={() => accept(b.id)}
                        disabled={actionLoading === b.id + '_accept'}
                        className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-white transition-all disabled:opacity-50"
                        style={{ background: '#7C1D2B' }}
                      >
                        {actionLoading === b.id + '_accept'
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <CheckCircle className="w-3 h-3" />}
                        {actionLoading === b.id + '_accept' ? 'Accepting...' : 'Accept & Notify Client'}
                      </button>
                    )}
                    {b.status !== 'cancelled' && (
                      <button
                        onClick={() => cancel(b.id)}
                        disabled={actionLoading === b.id + '_cancel'}
                        className="text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50">
                        {actionLoading === b.id + '_cancel' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Cancel'}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyBookings;
