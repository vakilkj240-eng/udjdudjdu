import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Star, Briefcase, Users, Languages, Clock, ChevronLeft,
  ChevronRight, Video, Phone, Building2, CheckCircle, Loader2,
  Calendar, IndianRupee, ArrowLeft, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import API_URL from '../lib/api';

const ALL_MEETING_TYPES = [
  { id: 'video', label: 'Video Call', icon: Video, desc: 'Meet via secure video call', color: 'blue' },
  { id: 'phone', label: 'Phone Call', icon: Phone, desc: 'Talk over the phone', color: 'green' },
  { id: 'in_person', label: 'In Person', icon: Building2, desc: 'Visit the office', color: 'purple' },
];

const getMeetingTypes = (category) =>
  category?.toLowerCase() === 'criminal'
    ? ALL_MEETING_TYPES.filter(m => m.id !== 'in_person')
    : ALL_MEETING_TYPES;

const CATEGORIES = ['Criminal', 'Family', 'Property', 'Corporate', 'Civil', 'Labour', 'Tax', 'Other'];

const StarRating = ({ rating }) => (
  <div className="flex items-center gap-1">
    {[1,2,3,4,5].map(i => (
      <svg key={i} className={`w-4 h-4 ${i <= Math.round(rating) ? 'text-amber-400' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
    <span className="text-sm font-medium text-slate-600 ml-1">{rating?.toFixed(1)}</span>
  </div>
);

const MiniCalendar = ({ selectedDate, onSelect, availableDays }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        </button>
        <span className="font-semibold text-slate-900 text-sm">{monthName}</span>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map(d => <div key={d} className="text-center text-xs text-slate-400 font-medium py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array(firstDay).fill(null).map((_, i) => <div key={`e-${i}`} />)}
        {Array(daysInMonth).fill(null).map((_, i) => {
          const day = i + 1;
          const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
          const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const isPast = date < today;
          const dayName = fullDayNames[date.getDay()];
          const isAvailable = availableDays.includes(dayName) && !isPast;
          const isSelected = selectedDate === dateStr;
          const isToday = date.getTime() === today.getTime();

          return (
            <button
              key={day}
              onClick={() => isAvailable && onSelect(dateStr)}
              disabled={!isAvailable}
              className={`
                aspect-square flex items-center justify-center text-xs rounded-lg font-medium transition-all
                ${isSelected ? 'bg-slate-900 text-white shadow-sm' : ''}
                ${isAvailable && !isSelected ? 'hover:bg-amber-50 hover:text-amber-700 text-slate-700 cursor-pointer' : ''}
                ${!isAvailable ? 'text-slate-300 cursor-not-allowed' : ''}
                ${isToday && !isSelected ? 'ring-1 ring-amber-400 text-amber-600' : ''}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-900 inline-block" />Selected</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm ring-1 ring-amber-400 inline-block" />Today</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-200 inline-block" />Unavailable</span>
      </div>
    </div>
  );
};

const LawyerBooking = () => {
  const { lawyerId } = useParams();
  const navigate = useNavigate();

  const [lawyer, setLawyer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1); // 1=date, 2=time, 3=details, 4=confirm, 5=success

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState('');
  const [category, setCategory] = useState('');
  const [caseSummary, setCaseSummary] = useState('');

  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);

  useEffect(() => {
    axios.get(`${API_URL}/api/lawyers/${lawyerId}`)
      .then(r => setLawyer(r.data))
      .catch(() => toast.error('Failed to load lawyer profile'))
      .finally(() => setLoading(false));
  }, [lawyerId]);

  const fetchSlots = useCallback(async (date) => {
    setSlotsLoading(true);
    setSelectedTime('');
    try {
      const { data } = await axios.get(`${API_URL}/api/lawyers/${lawyerId}/slots?date=${date}`);
      setSlots(data.slots || []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [lawyerId]);

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    fetchSlots(date);
    setStep(2);
  };

  const handleTimeSelect = (time) => {
    setSelectedTime(time);
    setStep(3);
  };

  const handleBook = async () => {
    if (!category || !caseSummary.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    setBooking(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/bookings`, {
        lawyer_id: lawyerId,
        scheduled_date: selectedDate,
        scheduled_time: selectedTime,
        meeting_type: selectedMeeting,
        case_summary: caseSummary,
        category,
      });
      setBookingResult(data);
      setStep(5);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Booking failed');
    } finally {
      setBooking(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return new Date(y, m - 1, day).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m} ${ampm}`;
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex items-center justify-center py-40">
        <Loader2 className="w-10 h-10 text-slate-300 animate-spin" />
      </div>
    </div>
  );

  if (!lawyer) return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex flex-col items-center justify-center py-40 gap-3 text-slate-400">
        <AlertCircle className="w-12 h-12" />
        <p>Lawyer not found</p>
        <button onClick={() => navigate('/client/lawyers')} className="text-amber-600 hover:underline text-sm">← Back to lawyers</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: '#FDFAF5' }}>
      <Navbar />

      {/* Brand page header */}
      <div className="pt-2">
        <div className="px-6 py-6" style={{ background: 'linear-gradient(135deg, #7C1D2B 0%, #9b2335 55%, #4a1118 100%)' }}>
          <div className="max-w-6xl mx-auto flex items-center gap-4">
            <button onClick={() => navigate('/client/lawyers')}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <ArrowLeft className="w-3.5 h-3.5" /> All Lawyers
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(201,168,76,0.8)' }}>Book a Consultation</span>
              </div>
              <h1 className="font-serif text-xl font-bold text-white mt-0.5">
                {lawyer?.name || 'Lawyer Booking'}
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left — Lawyer Profile */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                  {lawyer.name.split(' ').pop().charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{lawyer.name}</h2>
                  <p className="text-sm text-amber-600 font-medium">{lawyer.specialization} Law</p>
                  <StarRating rating={lawyer.rating} />
                </div>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">{lawyer.bio}</p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-slate-900">{lawyer.experience_years}</p>
                  <p className="text-xs text-slate-500">Years Exp.</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-slate-900">{lawyer.cases_handled}</p>
                  <p className="text-xs text-slate-500">Cases</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span>{lawyer.location}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Languages className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span>{(lawyer.languages || []).join(', ')}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span>{lawyer.start_time} – {lawyer.end_time}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Calendar className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span>{(lawyer.available_days || []).map(d => d.slice(0,3)).join(', ')}</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-2xl p-5">
              <p className="text-xs text-amber-700 font-medium uppercase tracking-wide mb-1">Consultation Fee</p>
              <div className="flex items-end gap-1">
                <IndianRupee className="w-5 h-5 text-amber-600 mb-0.5" />
                <span className="text-3xl font-bold text-amber-700">{lawyer.consultation_fee?.toLocaleString()}</span>
                <span className="text-amber-600 text-sm mb-1">/ session</span>
              </div>
              <p className="text-xs text-amber-600 mt-1">1-hour consultation</p>
            </div>
          </div>

          {/* Right — Booking Flow */}
          <div className="lg:col-span-3">
            {step === 5 ? (
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Appointment Confirmed!</h3>
                <p className="text-slate-500 text-sm mb-6">Your consultation has been booked successfully.</p>

                <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 mb-6 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Lawyer</span><span className="font-medium">{lawyer.name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-medium">{formatDate(selectedDate)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Time</span><span className="font-medium">{formatTime(selectedTime)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Mode</span><span className="font-medium capitalize">{selectedMeeting.replace('_',' ')}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Fee</span><span className="font-medium">₹{lawyer.consultation_fee?.toLocaleString()}</span></div>
                </div>

                <div className="flex gap-3 justify-center">
                  {bookingResult?.video_room_id && (
                    <button onClick={() => navigate(`/video/${bookingResult.video_room_id}`)}
                      className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
                      <Video className="w-4 h-4" /> Join Video Room
                    </button>
                  )}
                  <button onClick={() => navigate('/client/bookings')}
                    className="border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50">
                    View My Bookings
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {/* Step indicator */}
                <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    {['Select Date', 'Pick Time', 'Details', 'Confirm'].map((label, i) => (
                      <React.Fragment key={label}>
                        <div className={`flex items-center gap-1.5 text-xs font-medium ${step > i + 1 ? 'text-green-600' : step === i + 1 ? 'text-slate-900' : 'text-slate-400'}`}>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step > i + 1 ? 'bg-green-100 text-green-600' : step === i + 1 ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>
                            {step > i + 1 ? '✓' : i + 1}
                          </div>
                          <span className="hidden sm:inline">{label}</span>
                        </div>
                        {i < 3 && <div className={`flex-1 h-px ${step > i + 1 ? 'bg-green-200' : 'bg-slate-100'}`} />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <div className="p-6">
                  <AnimatePresence mode="wait">

                    {/* Step 1 — Date */}
                    {step === 1 && (
                      <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <h3 className="font-semibold text-slate-900 mb-1">Select a Date</h3>
                        <p className="text-xs text-slate-400 mb-4">Available: {(lawyer.available_days || []).map(d => d.slice(0,3)).join(', ')}</p>
                        <MiniCalendar
                          selectedDate={selectedDate}
                          onSelect={handleDateSelect}
                          availableDays={lawyer.available_days || ['Monday','Tuesday','Wednesday','Thursday','Friday']}
                        />
                      </motion.div>
                    )}

                    {/* Step 2 — Time Slots */}
                    {step === 2 && (
                      <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="font-semibold text-slate-900">Pick a Time Slot</h3>
                            <p className="text-xs text-slate-400">{formatDate(selectedDate)}</p>
                          </div>
                          <button onClick={() => setStep(1)} className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1">
                            <ChevronLeft className="w-3 h-3" /> Change date
                          </button>
                        </div>
                        {slotsLoading ? (
                          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>
                        ) : slots.length === 0 ? (
                          <div className="text-center py-12 text-slate-400">
                            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="text-sm">No available slots for this date</p>
                            <button onClick={() => setStep(1)} className="text-xs text-amber-600 hover:underline mt-1">Pick another date</button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2.5">
                            {slots.map(slot => (
                              <button key={slot} onClick={() => handleTimeSelect(slot)}
                                className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition-all ${selectedTime === slot ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-700 hover:border-amber-400 hover:text-amber-600'}`}>
                                {formatTime(slot)}
                              </button>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Step 3 — Meeting Type + Details */}
                    {step === 3 && (
                      <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-slate-900">Meeting Details</h3>
                          <button onClick={() => setStep(2)} className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1">
                            <ChevronLeft className="w-3 h-3" /> Change time
                          </button>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-slate-700 mb-2">How would you like to meet?</p>
                          <div className={`grid gap-3 ${category?.toLowerCase() === 'criminal' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                            {getMeetingTypes(category).map(({ id, label, icon: Icon, desc, color }) => (
                              <button key={id} onClick={() => setSelectedMeeting(id)}
                                className={`p-3 rounded-xl border text-center transition-all ${selectedMeeting === id ? 'border-slate-900 bg-slate-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                                <Icon className={`w-5 h-5 mx-auto mb-1.5 ${selectedMeeting === id ? 'text-slate-900' : 'text-slate-400'}`} />
                                <p className={`text-xs font-semibold ${selectedMeeting === id ? 'text-slate-900' : 'text-slate-600'}`}>{label}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
                          <select value={category} onChange={e => setCategory(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                            <option value="">Select category</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">Brief description of your issue</label>
                          <textarea value={caseSummary} onChange={e => setCaseSummary(e.target.value)}
                            rows={4} placeholder="Describe your legal issue in a few sentences so the lawyer can prepare..."
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
                        </div>

                        <button onClick={() => selectedMeeting && category && caseSummary.trim() ? setStep(4) : toast.error('Please complete all fields')}
                          className="w-full bg-slate-900 text-white py-3 rounded-xl font-medium text-sm hover:bg-slate-800 transition-colors">
                          Continue to Review →
                        </button>
                      </motion.div>
                    )}

                    {/* Step 4 — Confirm */}
                    {step === 4 && (
                      <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-slate-900">Review & Confirm</h3>
                          <button onClick={() => setStep(3)} className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1">
                            <ChevronLeft className="w-3 h-3" /> Edit details
                          </button>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 space-y-3 mb-5 text-sm">
                          <div className="flex justify-between"><span className="text-slate-500">Lawyer</span><span className="font-medium">{lawyer.name}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-medium">{formatDate(selectedDate)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Time</span><span className="font-medium">{formatTime(selectedTime)}</span></div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Mode</span>
                            <span className="font-medium capitalize flex items-center gap-1.5">
                              {selectedMeeting === 'video' && <Video className="w-3.5 h-3.5 text-blue-500" />}
                              {selectedMeeting === 'phone' && <Phone className="w-3.5 h-3.5 text-green-500" />}
                              {selectedMeeting === 'in_person' && <Building2 className="w-3.5 h-3.5 text-purple-500" />}
                              {selectedMeeting.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex justify-between"><span className="text-slate-500">Category</span><span className="font-medium">{category}</span></div>
                          <div className="border-t border-slate-200 pt-3 flex justify-between">
                            <span className="text-slate-500">Consultation Fee</span>
                            <span className="font-bold text-slate-900">₹{lawyer.consultation_fee?.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 mb-5">
                          <p className="text-xs text-slate-500 font-medium mb-1">Your message</p>
                          <p className="text-sm text-slate-700">{caseSummary}</p>
                        </div>

                        <button onClick={handleBook} disabled={booking}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                          {booking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          {booking ? 'Booking...' : 'Confirm Appointment'}
                        </button>
                      </motion.div>
                    )}

                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LawyerBooking;
