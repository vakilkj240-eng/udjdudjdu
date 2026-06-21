import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, MapPin, Calendar, DollarSign, AlertCircle, CheckCircle2, Loader2, Send, Users, ArrowRight, ChevronDown, ChevronUp, Shield, Briefcase, FileText, Clock, User, MessageCircle, TrendingUp, Star, Zap, Award, Upload, Download, Trash2, Paperclip, File as FileIcon, Image as ImageIcon, StickyNote, BookOpen, Database } from 'lucide-react';
import KnowledgeBase from '../components/KnowledgeBase';

import API_URL from '../lib/api';
import CaseChat from '../components/CaseChat';
import CaseNotes from '../components/CaseNotes';

const LawyerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('cases');
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    location: '',
    urgency: '',
    case_type: '',
    type: '',
    domain: '',
    category: '',
  });
  const [acceptingCase, setAcceptingCase] = useState(null);

  // My Active Cases
  const [myCases, setMyCases] = useState([]);
  const [loadingMyCases, setLoadingMyCases] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [expandedMyCase, setExpandedMyCase] = useState(null);
  const [openChatCase, setOpenChatCase] = useState(null);
  const [unreadByCase, setUnreadByCase] = useState({});

  // Referrals
  const [referrals, setReferrals] = useState({ sent: [], received: [] });
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [lawyers, setLawyers] = useState([]);
  const [showReferModal, setShowReferModal] = useState(null);
  const [referLawyerId, setReferLawyerId] = useState('');
  const [referNotes, setReferNotes] = useState('');

  // Performance
  const [perfData, setPerfData] = useState(null);
  const [loadingPerf, setLoadingPerf] = useState(false);

  // Documents per case
  const [docsByCaseId, setDocsByCaseId] = useState({});
  const [loadingDocsByCaseId, setLoadingDocsByCaseId] = useState({});
  const [uploadingByCaseId, setUploadingByCaseId] = useState({});
  const [openDocsCase, setOpenDocsCase] = useState(null);
  const [dragOverCase, setDragOverCase] = useState(null);
  const docInputRefs = useRef({});

  const fetchDocsForCase = useCallback(async (caseId) => {
    setLoadingDocsByCaseId(prev => ({ ...prev, [caseId]: true }));
    try {
      const { data } = await axios.get(`${API_URL}/api/cases/${caseId}/documents`);
      setDocsByCaseId(prev => ({ ...prev, [caseId]: data }));
    } catch {} finally {
      setLoadingDocsByCaseId(prev => ({ ...prev, [caseId]: false }));
    }
  }, []);

  const uploadDocForCase = async (caseId, file) => {
    if (!file) return;
    const allowed = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.txt', '.xlsx', '.xls'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) { toast.error(`File type not allowed: ${ext}`); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('File too large (max 10 MB)'); return; }
    setUploadingByCaseId(prev => ({ ...prev, [caseId]: true }));
    const form = new FormData(); form.append('file', file);
    try {
      const { data } = await axios.post(`${API_URL}/api/cases/${caseId}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDocsByCaseId(prev => ({ ...prev, [caseId]: [...(prev[caseId] || []), data] }));
      toast.success('Document uploaded');
    } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed'); }
    finally { setUploadingByCaseId(prev => ({ ...prev, [caseId]: false })); }
  };

  const deleteDocForCase = async (caseId, docId) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await axios.delete(`${API_URL}/api/documents/${docId}`);
      setDocsByCaseId(prev => ({ ...prev, [caseId]: (prev[caseId] || []).filter(d => d.id !== docId) }));
      toast.success('Document deleted');
    } catch (err) { toast.error(err.response?.data?.detail || 'Delete failed'); }
  };

  const downloadDoc = async (docId, name) => {
    try {
      const res = await axios.get(`${API_URL}/api/documents/${docId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = name; a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
  };

  const fmtDocSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  useEffect(() => {
    fetchCases();
    fetchLawyers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    if (activeTab === 'referrals') fetchReferrals();
    if (activeTab === 'mycases') fetchMyCases();
    if (activeTab === 'performance') fetchPerformance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/messages/unread-summary`);
        setUnreadByCase(data?.per_case || {});
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchCases = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.location) params.append('location', filters.location);
      if (filters.urgency) params.append('urgency', filters.urgency);
      if (filters.case_type) params.append('case_type', filters.case_type);
      if (filters.type) params.append('type', filters.type);
      if (filters.domain) params.append('domain', filters.domain);
      if (filters.category) params.append('category', filters.category);
      const { data } = await axios.get(`${API_URL}/api/cases?${params.toString()}`, {  });
      setCases(data);
    } catch {}
    finally { setLoading(false); }
  };

  const fetchLawyers = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/lawyers`);
      setLawyers(data.filter(l => l.id !== user?.id));
    } catch {}
  };

  const fetchReferrals = async () => {
    setLoadingReferrals(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/referrals`, {  });
      setReferrals(data);
    } catch {}
    finally { setLoadingReferrals(false); }
  };

  const handleAccept = async (caseId) => {
    setAcceptingCase(caseId);
    try {
      await axios.put(`${API_URL}/api/cases/${caseId}/accept`, {}, {  });
      toast.success('Case accepted! Find it in "My Active Cases".');
      fetchCases();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to accept case');
    } finally {
      setAcceptingCase(null);
    }
  };

  const fetchMyCases = async () => {
    setLoadingMyCases(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/lawyer/dashboard`);
      setMyCases(data);
    } catch (err) {
      toast.error('Failed to load your cases');
    } finally {
      setLoadingMyCases(false);
    }
  };

  const fetchPerformance = async () => {
    setLoadingPerf(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/lawyer/performance`);
      setPerfData(data);
    } catch (err) {
      toast.error('Failed to load performance data');
    } finally {
      setLoadingPerf(false);
    }
  };

  const handleUpdateStatus = async (caseId, newStatus) => {
    setUpdatingStatus(caseId);
    try {
      await axios.patch(`${API_URL}/api/lawyer/case/${caseId}/status`, {
        new_status: newStatus,
      });
      toast.success(`Case marked as "${newStatus}"`);
      fetchMyCases();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleRefer = async (caseId) => {
    if (!referLawyerId) { toast.error('Select a lawyer'); return; }
    try {
      await axios.post(`${API_URL}/api/referrals`, {
        case_id: caseId,
        referred_to_lawyer_id: referLawyerId,
        notes: referNotes
      }, {  });
      toast.success('Case referred!');
      setShowReferModal(null);
      setReferLawyerId('');
      setReferNotes('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to refer');
    }
  };

  const handleAcceptReferral = async (referralId) => {
    try {
      await axios.put(`${API_URL}/api/referrals/${referralId}/accept`, {}, {  });
      toast.success('Referral accepted!');
      fetchReferrals();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to accept referral');
    }
  };

  const getUrgencyConfig = (urgency) => {
    switch (urgency) {
      case 'Critical': return { color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle };
      case 'High': return { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertCircle };
      case 'Medium': return { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Calendar };
      default: return { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 };
    }
  };

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--theme-bg)', isolation: 'isolate' }} data-testid="lawyer-dashboard-page">
      <div aria-hidden="true" className="page-gold-pattern" style={{ position: 'fixed', inset: 0, zIndex: -1, backgroundImage: `url(${process.env.PUBLIC_URL}/gold-pattern.png)`, backgroundRepeat: 'repeat', backgroundSize: '320px 320px', opacity: 0.18, pointerEvents: 'none' }} />
      <div className="relative z-10">
      <Navbar />

      {/* Brand page header */}
      <div className="pt-2">
        <div className="px-6 py-8" style={{ background: 'linear-gradient(135deg, #7C1D2B 0%, #9b2335 55%, #4a1118 100%)' }}>
          <div className="max-w-7xl mx-auto flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(201,168,76,0.2)' }}>
                  <Briefcase className="w-4 h-4" style={{ color: '#F0C84A' }} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(201,168,76,0.8)' }}>Lawyer Portal</span>
                  <span style={{ color: 'rgba(201,168,76,0.4)' }}>›</span>
                  <span className="text-xs font-semibold uppercase tracking-widest text-white/60">Dashboard</span>
                </div>
              </div>
              <h1 className="font-serif text-2xl font-bold text-white" data-testid="dashboard-title">Lawyer Dashboard</h1>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Manage cases, referrals and track your performance</p>
            </div>
            {/* Tabs row — positioned in header */}
            <div className="flex gap-2 flex-wrap self-end" data-testid="dashboard-tabs">
              {[
                { id: 'cases', label: 'Available Cases', icon: FileText },
                { id: 'mycases', label: 'My Active Cases', icon: Briefcase },
                { id: 'referrals', label: 'Referrals', icon: Send },
                { id: 'performance', label: 'Performance', icon: TrendingUp },
                { id: 'knowledge', label: 'Knowledge Base', icon: Database },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === id ? 'text-[#7C1D2B] bg-white shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                  style={activeTab === id ? {} : { border: '1px solid rgba(255,255,255,0.2)' }}
                  data-testid={`tab-${id}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {activeTab === 'cases' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filters */}
            <aside className="lg:col-span-1" data-testid="filter-sidebar">
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 sticky top-24">
                <div className="flex items-center gap-2 mb-6">
                  <Filter className="w-5 h-5 text-slate-700" />
                  <h2 className="font-heading text-xl font-semibold text-slate-900">Filters</h2>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Case Type</label>
                    <select
                      value={filters.case_type}
                      onChange={(e) => setFilters({ ...filters, case_type: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 focus:outline-none text-slate-900 bg-white"
                      data-testid="filter-case-type"
                    >
                      <option value="">All Types</option>
                      <option value="Criminal">Criminal</option>
                      <option value="Civil">Civil</option>
                      <option value="Family">Family</option>
                      <option value="Property">Property</option>
                      <option value="Employment">Employment</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Location</label>
                    <input
                      type="text"
                      value={filters.location}
                      onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 focus:outline-none text-slate-900"
                      placeholder="e.g., Mumbai"
                      data-testid="filter-location"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Urgency</label>
                    <select
                      value={filters.urgency}
                      onChange={(e) => setFilters({ ...filters, urgency: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 focus:outline-none text-slate-900 bg-white"
                      data-testid="filter-urgency"
                    >
                      <option value="">All Levels</option>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Classification · type</label>
                    <select
                      value={filters.type}
                      onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 focus:outline-none text-slate-900 bg-white"
                      data-testid="filter-class-type"
                    >
                      <option value="">Any</option>
                      <option value="Non-Criminal">Non-Criminal</option>
                      <option value="Criminal">Criminal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Classification · domain</label>
                    <select
                      value={filters.domain}
                      onChange={(e) => setFilters({ ...filters, domain: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 focus:outline-none text-slate-900 bg-white"
                      data-testid="filter-class-domain"
                    >
                      <option value="">Any</option>
                      <option value="Non-Judicial">Non-Judicial</option>
                      <option value="Judicial">Judicial</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Classification · category</label>
                    <select
                      value={filters.category}
                      onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 focus:outline-none text-slate-900 bg-white"
                      data-testid="filter-class-category"
                    >
                      <option value="">Any</option>
                      <option value="General">General</option>
                      <option value="Tenant">Tenant</option>
                      <option value="Insurance">Insurance</option>
                    </select>
                  </div>
                  <button
                    onClick={() =>
                      setFilters({
                        location: '',
                        urgency: '',
                        case_type: '',
                        type: '',
                        domain: '',
                        category: '',
                      })
                    }
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-2 px-4 rounded-lg"
                    data-testid="clear-filters-button"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </aside>

            {/* Cases Feed */}
            <main className="lg:col-span-3" data-testid="case-feed">
              <div className="mb-4 bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-slate-600">
                    <span className="font-bold text-slate-900 text-2xl">{cases.length}</span> cases available
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20" data-testid="loading-indicator">
                  <Loader2 className="w-12 h-12 text-slate-400 animate-spin" />
                </div>
              ) : cases.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center" data-testid="no-cases-message">
                  <Filter className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">No cases found</h3>
                  <p className="text-slate-600">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cases.map((caseItem) => {
                    const urgencyConfig = getUrgencyConfig(caseItem.urgency);
                    const UrgencyIcon = urgencyConfig.icon;
                    return (
                      <div key={caseItem.id} className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all" data-testid={`case-card-${caseItem.id}`}>
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3 flex-wrap">
                              <h3 className="font-heading text-2xl font-bold text-slate-900">{caseItem.case_type} Law</h3>
                              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${urgencyConfig.color}`}>
                                <UrgencyIcon className="w-3 h-3" /> {caseItem.urgency}
                              </span>
                              {(caseItem.nyayId || caseItem.nyay_id) && (
                                <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold bg-slate-900 text-white px-2.5 py-1 rounded-full" data-testid={`nyay-${caseItem.id}`}>
                                  <Shield className="w-3 h-3" /> {caseItem.nyayId || caseItem.nyay_id}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 mb-2">
                              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{caseItem.location}</span>
                              <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" />{caseItem.budget}</span>
                              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(caseItem.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <p className="text-slate-700 leading-relaxed text-sm">{caseItem.description}</p>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                          <span className="text-sm text-slate-600">Client: <span className="font-semibold text-slate-900">{caseItem.client_name}</span></span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowReferModal(caseItem.id)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 text-sm"
                              data-testid={`refer-case-${caseItem.id}`}
                            >
                              <Send className="w-4 h-4" /> Refer
                            </button>
                            <button
                              onClick={() => handleAccept(caseItem.id)}
                              disabled={acceptingCase === caseItem.id}
                              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-6 py-2.5 rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                              data-testid={`accept-case-${caseItem.id}`}
                            >
                              {acceptingCase === caseItem.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                              Accept
                            </button>
                          </div>
                        </div>

                        {/* Refer Modal */}
                        {showReferModal === caseItem.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl"
                            data-testid={`refer-modal-${caseItem.id}`}
                          >
                            <h4 className="text-sm font-semibold text-slate-800 mb-3">Refer to Another Lawyer</h4>
                            <select
                              value={referLawyerId}
                              onChange={(e) => setReferLawyerId(e.target.value)}
                              className="w-full border border-slate-200 rounded-lg p-2 text-sm mb-2 bg-white"
                              data-testid="refer-lawyer-select"
                            >
                              <option value="">Select a lawyer...</option>
                              {lawyers.map(l => (
                                <option key={l.id} value={l.id}>{l.name} - {l.specialization} ({l.location})</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={referNotes}
                              onChange={(e) => setReferNotes(e.target.value)}
                              placeholder="Add notes (optional)"
                              className="w-full border border-slate-200 rounded-lg p-2 text-sm mb-3"
                              data-testid="refer-notes-input"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleRefer(caseItem.id)}
                                className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium py-2 px-4 rounded-lg"
                                data-testid="confirm-refer-btn"
                              >
                                Send Referral
                              </button>
                              <button
                                onClick={() => { setShowReferModal(null); setReferLawyerId(''); setReferNotes(''); }}
                                className="bg-slate-100 text-slate-600 text-sm font-medium py-2 px-4 rounded-lg"
                              >
                                Cancel
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </main>
          </div>
        )}

        {/* My Active Cases Tab */}
        {activeTab === 'mycases' && (
          <div data-testid="my-active-cases-section">
            <div className="mb-4 bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600">
                    <span className="font-bold text-slate-900 text-2xl">{myCases.length}</span> active case{myCases.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Cases you've accepted from clients</p>
                </div>
                <button
                  onClick={fetchMyCases}
                  className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium"
                >
                  Refresh
                </button>
              </div>
            </div>

            {loadingMyCases ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-12 h-12 text-slate-400 animate-spin" />
              </div>
            ) : myCases.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center" data-testid="no-active-cases">
                <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">No active cases yet</h3>
                <p className="text-slate-600 mb-4">Accept cases from the "Available Cases" tab to start working on them.</p>
                <button
                  onClick={() => setActiveTab('cases')}
                  className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Browse Available Cases <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myCases.map((c) => {
                  const isExpanded = expandedMyCase === c.id;
                  const statusColors = {
                    accepted: 'bg-blue-100 text-blue-700 border-blue-200',
                    in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
                    awaiting_documents: 'bg-purple-100 text-purple-700 border-purple-200',
                    in_court: 'bg-indigo-100 text-indigo-700 border-indigo-200',
                    completed: 'bg-green-100 text-green-700 border-green-200',
                    closed: 'bg-slate-200 text-slate-700 border-slate-300',
                  };
                  return (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
                      data-testid={`my-case-${c.id}`}
                    >
                      <div className="p-5">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <h3 className="font-heading text-xl font-bold text-slate-900">
                                {c.case_type || 'Case'} {c.case_type ? 'Law' : ''}
                              </h3>
                              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusColors[c.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                {c.status?.replace(/_/g, ' ')}
                              </span>
                              {c.nyayId && (
                                <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold bg-slate-900 text-white px-2.5 py-1 rounded-full">
                                  <Shield className="w-3 h-3" /> {c.nyayId}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                              {c.client_name && (
                                <span className="flex items-center gap-1"><User className="w-3 h-3" />{c.client_name}</span>
                              )}
                              {c.location && (
                                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location}</span>
                              )}
                              {c.urgency && (
                                <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" />{c.urgency}</span>
                              )}
                              {c.budget && (
                                <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{c.budget}</span>
                              )}
                              {c.created_at && (
                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => setExpandedMyCase(isExpanded ? null : c.id)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-3 mb-3">
                          <p className={`text-sm text-slate-700 ${isExpanded ? '' : 'line-clamp-2'}`}>{c.caseDescription}</p>
                        </div>

                        {/* Workspace actions */}
                        <div className="flex flex-wrap items-center justify-end gap-2 mb-3">
                          <button
                            onClick={() => navigate(`/lawyer/cases/${c.id}`)}
                            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#6D071A] hover:bg-[#800020] text-white shadow-lg shadow-[#6D071A]/15 transition-colors"
                          >
                            <StickyNote className="w-3.5 h-3.5" />
                            Open Workspace
                          </button>
                          <button
                            onClick={() => {
                              setOpenChatCase(openChatCase === c.id ? null : c.id);
                              if (openChatCase !== c.id) {
                                setUnreadByCase((prev) => ({ ...prev, [c.id]: 0 }));
                              }
                            }}
                            className={`relative flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                              openChatCase === c.id
                                ? 'bg-slate-900 text-white'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                            }`}
                            data-testid={`chat-toggle-${c.id}`}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            {openChatCase === c.id ? 'Close Chat' : 'Message Client'}
                            {unreadByCase[c.id] > 0 && openChatCase !== c.id && (
                              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1" data-testid={`chat-badge-${c.id}`}>
                                {unreadByCase[c.id] > 9 ? '9+' : unreadByCase[c.id]}
                              </span>
                            )}
                          </button>
                        </div>

                        {openChatCase === c.id && (
                          <div className="mb-4">
                            <CaseChat
                              caseId={c.id}
                              currentUserId={user?.id}
                              currentUserName={user?.name}
                              otherPartyName={c.client_name}
                            />
                          </div>
                        )}

                        {isExpanded && (
                          <div className="mb-4 rounded-2xl border border-[#EFE7D6] bg-white p-4">
                            <CaseNotes caseId={c.id} compact />
                          </div>
                        )}

                        {/* Documents section */}
                        <div className="mb-3">
                          <button
                            onClick={() => {
                              const next = openDocsCase === c.id ? null : c.id;
                              setOpenDocsCase(next);
                              if (next && !docsByCaseId[c.id]) fetchDocsForCase(c.id);
                            }}
                            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 transition-colors"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            Documents
                            {(docsByCaseId[c.id] || []).length > 0 && (
                              <span className="ml-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {docsByCaseId[c.id].length}
                              </span>
                            )}
                            {openDocsCase === c.id ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                          </button>

                          <AnimatePresence initial={false}>
                            {openDocsCase === c.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden mt-2"
                              >
                                {/* Drop zone */}
                                <div
                                  onDragOver={(e) => { e.preventDefault(); setDragOverCase(c.id); }}
                                  onDragLeave={() => setDragOverCase(null)}
                                  onDrop={(e) => {
                                    e.preventDefault(); setDragOverCase(null);
                                    const f = e.dataTransfer.files[0];
                                    if (f) uploadDocForCase(c.id, f);
                                  }}
                                  onClick={() => docInputRefs.current[c.id]?.click()}
                                  className={`border-2 border-dashed rounded-xl px-4 py-3 flex items-center justify-center gap-2 cursor-pointer transition-colors mb-2 ${
                                    dragOverCase === c.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                                  }`}
                                >
                                  <input
                                    ref={el => docInputRefs.current[c.id] = el}
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,.xlsx,.xls"
                                    onChange={e => { if (e.target.files[0]) uploadDocForCase(c.id, e.target.files[0]); e.target.value = ''; }}
                                  />
                                  {uploadingByCaseId[c.id] ? (
                                    <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                                  ) : (
                                    <Upload className="w-4 h-4 text-slate-400" />
                                  )}
                                  <span className="text-xs text-slate-500">
                                    {uploadingByCaseId[c.id] ? 'Uploading…' : 'Drop or click to upload'}
                                  </span>
                                </div>

                                {/* File list */}
                                {loadingDocsByCaseId[c.id] ? (
                                  <div className="flex justify-center py-2">
                                    <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
                                  </div>
                                ) : (docsByCaseId[c.id] || []).length === 0 ? (
                                  <p className="text-xs text-slate-400 text-center py-2">No documents yet</p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {(docsByCaseId[c.id] || []).map(doc => {
                                      const isOwner = doc.uploader_id === user?.id;
                                      return (
                                        <div key={doc.id} className="flex items-center gap-2 bg-white border border-slate-100 rounded-lg px-2.5 py-2 hover:border-indigo-200 transition-colors">
                                          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                            {['.png','.jpg','.jpeg'].includes(doc.extension)
                                              ? <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                                              : <FileIcon className="w-3.5 h-3.5 text-indigo-500" />
                                            }
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-slate-800 truncate">{doc.original_name}</p>
                                            <p className="text-[10px] text-slate-400">
                                              {fmtDocSize(doc.size_bytes)} ·{' '}
                                              <span className={`px-1 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                                doc.uploader_role === 'lawyer' ? 'bg-violet-100 text-violet-600' : 'bg-blue-100 text-blue-600'
                                              }`}>{doc.uploader_role}</span>
                                              {' '}· {doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                                            </p>
                                          </div>
                                          <div className="flex gap-1 flex-shrink-0">
                                            <button
                                              onClick={() => downloadDoc(doc.id, doc.original_name)}
                                              className="w-6 h-6 rounded-md bg-slate-50 hover:bg-indigo-50 flex items-center justify-center transition-colors"
                                              title="Download"
                                            >
                                              <Download className="w-3 h-3 text-slate-500 hover:text-indigo-600" />
                                            </button>
                                            {isOwner && (
                                              <button
                                                onClick={() => deleteDocForCase(c.id, doc.id)}
                                                className="w-6 h-6 rounded-md bg-slate-50 hover:bg-red-50 flex items-center justify-center transition-colors"
                                                title="Delete"
                                              >
                                                <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Status update actions */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                          <span className="text-xs text-slate-500 self-center mr-2 font-medium">Update status:</span>
                          {[
                            { label: 'In Progress', value: 'in_progress' },
                            { label: 'Awaiting Docs', value: 'awaiting_documents' },
                            { label: 'In Court', value: 'in_court' },
                            { label: 'Completed', value: 'completed' },
                            { label: 'Close Case', value: 'closed' },
                          ].map(({ label, value }) => (
                            <button
                              key={value}
                              onClick={() => handleUpdateStatus(c.id, value)}
                              disabled={updatingStatus === c.id || c.status === value}
                              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                c.status === value
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                              data-testid={`status-${value}-${c.id}`}
                            >
                              {updatingStatus === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : label}
                            </button>
                          ))}
                        </div>

                        {/* Status history (expanded) */}
                        {isExpanded && c.status_history?.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-100">
                            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                              <Clock className="w-4 h-4" /> Status History
                            </h4>
                            <div className="space-y-2">
                              {c.status_history.slice().reverse().map((h, i) => (
                                <div key={i} className="flex items-start gap-3 text-xs">
                                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-1.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-slate-800">{h.status?.replace(/_/g, ' ')}</span>
                                      <span className="text-slate-400">·</span>
                                      <span className="text-slate-500">{h.timestamp ? new Date(h.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</span>
                                    </div>
                                    {h.notes && <p className="text-slate-600 mt-0.5">{h.notes}</p>}
                                    {h.updated_by && <p className="text-slate-400 mt-0.5">by {h.updated_by}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <div data-testid="performance-section">
            {loadingPerf ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-12 h-12 text-slate-400 animate-spin" />
              </div>
            ) : !perfData ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No performance data available yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      label: 'Total Cases',
                      value: perfData.total_cases,
                      sub: `${perfData.this_month_cases} this month`,
                      icon: Briefcase,
                      color: 'from-blue-500 to-indigo-600',
                      light: 'bg-blue-50 text-blue-700',
                    },
                    {
                      label: 'Avg Rating',
                      value: perfData.avg_rating != null ? `${perfData.avg_rating} ★` : '—',
                      sub: `${perfData.total_reviews} review${perfData.total_reviews !== 1 ? 's' : ''}`,
                      icon: Star,
                      color: 'from-amber-400 to-orange-500',
                      light: 'bg-amber-50 text-amber-700',
                    },
                    {
                      label: 'Avg Response',
                      value: perfData.avg_response_hrs != null
                        ? perfData.avg_response_hrs < 1
                          ? `${Math.round(perfData.avg_response_hrs * 60)} min`
                          : `${perfData.avg_response_hrs} hrs`
                        : '—',
                      sub: 'time to first action',
                      icon: Zap,
                      color: 'from-green-500 to-emerald-600',
                      light: 'bg-green-50 text-green-700',
                    },
                    {
                      label: 'Est. Earnings',
                      value: perfData.est_earnings > 0
                        ? `₹${perfData.est_earnings.toLocaleString('en-IN')}`
                        : '—',
                      sub: `${perfData.completed_cases} completed case${perfData.completed_cases !== 1 ? 's' : ''}`,
                      icon: Award,
                      color: 'from-violet-500 to-purple-600',
                      light: 'bg-violet-50 text-violet-700',
                    },
                  ].map(({ label, value, sub, icon: Icon, color, light }) => (
                    <motion.div
                      key={label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3"
                    >
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-900">{value}</p>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
                        <p className={`text-[11px] font-medium mt-1 px-2 py-0.5 rounded-full inline-block ${light}`}>{sub}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Weekly Activity Bar Chart */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-indigo-500" /> Weekly Case Activity
                    </h3>
                    {(() => {
                      const weekly = perfData.weekly_activity || [];
                      const maxCount = Math.max(...weekly.map(w => w.count), 1);
                      return (
                        <div className="flex items-end gap-3 h-32">
                          {weekly.map((w, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              <span className="text-[11px] font-bold text-slate-700">{w.count}</span>
                              <div className="w-full relative rounded-t-lg overflow-hidden bg-slate-100" style={{ height: '80px' }}>
                                <motion.div
                                  initial={{ height: 0 }}
                                  animate={{ height: `${(w.count / maxCount) * 100}%` }}
                                  transition={{ duration: 0.6, delay: i * 0.1 }}
                                  className="absolute bottom-0 w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg"
                                />
                              </div>
                              <span className="text-[10px] text-slate-500 font-medium">{w.label}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Status Breakdown */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-violet-500" /> Cases by Status
                    </h3>
                    {(() => {
                      const entries = Object.entries(perfData.status_breakdown || {}).sort((a, b) => b[1] - a[1]);
                      const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
                      const palette = ['bg-indigo-500', 'bg-amber-500', 'bg-green-500', 'bg-violet-500', 'bg-rose-500', 'bg-slate-400'];
                      return entries.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">No cases yet</p>
                      ) : (
                        <div className="space-y-3">
                          {entries.map(([status, count], i) => (
                            <div key={status}>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="font-medium text-slate-700 capitalize">{status.replace(/_/g, ' ')}</span>
                                <span className="text-slate-500 font-semibold">{count}</span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(count / total) * 100}%` }}
                                  transition={{ duration: 0.7, delay: i * 0.08 }}
                                  className={`h-full rounded-full ${palette[i % palette.length]}`}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Case Type Distribution */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-green-500" /> Case Types
                    </h3>
                    {(() => {
                      const entries = Object.entries(perfData.case_type_breakdown || {}).sort((a, b) => b[1] - a[1]);
                      const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
                      const palette = ['bg-emerald-500', 'bg-sky-500', 'bg-rose-500', 'bg-orange-500', 'bg-purple-500', 'bg-teal-500'];
                      return entries.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">No data</p>
                      ) : (
                        <div className="space-y-3">
                          {entries.map(([ct, count], i) => (
                            <div key={ct}>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="font-medium text-slate-700">{ct}</span>
                                <span className="text-slate-500 font-semibold">{Math.round((count / total) * 100)}%</span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(count / total) * 100}%` }}
                                  transition={{ duration: 0.7, delay: i * 0.08 }}
                                  className={`h-full rounded-full ${palette[i % palette.length]}`}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Recent Reviews */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" /> Recent Client Reviews
                    </h3>
                    {perfData.recent_reviews?.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-8">No reviews yet</p>
                    ) : (
                      <div className="space-y-3">
                        {(perfData.recent_reviews || []).map((r, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-100"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-slate-800">{r.client_name}</span>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map(star => (
                                  <Star
                                    key={star}
                                    className={`w-3 h-3 ${star <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-600 line-clamp-2">{r.comment}</p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                            </p>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={fetchPerformance}
                    className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                  >
                    <Loader2 className={`w-3.5 h-3.5 ${loadingPerf ? 'animate-spin' : 'hidden'}`} />
                    Refresh Stats
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Referrals Tab */}
        {activeTab === 'referrals' && (
          <div data-testid="referrals-section">
            {loadingReferrals ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-slate-400 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Received */}
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5" /> Received Referrals ({referrals.received.length})
                  </h2>
                  <div className="space-y-3">
                    {referrals.received.length === 0 ? (
                      <p className="text-sm text-slate-400 bg-white p-6 rounded-xl border border-slate-200 text-center">No received referrals</p>
                    ) : referrals.received.map(r => (
                      <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4" data-testid={`received-referral-${r.id}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{r.case_type} Case</p>
                            <p className="text-xs text-slate-500">From: {r.referred_by_name}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {r.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mb-2">{r.case_description}</p>
                        {r.notes && <p className="text-xs text-slate-500 italic mb-2">Notes: {r.notes}</p>}
                        {r.status === 'pending' && (
                          <button
                            onClick={() => handleAcceptReferral(r.id)}
                            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium py-1.5 px-3 rounded-lg"
                            data-testid={`accept-referral-${r.id}`}
                          >
                            Accept Referral
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Sent */}
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Send className="w-5 h-5" /> Sent Referrals ({referrals.sent.length})
                  </h2>
                  <div className="space-y-3">
                    {referrals.sent.length === 0 ? (
                      <p className="text-sm text-slate-400 bg-white p-6 rounded-xl border border-slate-200 text-center">No sent referrals</p>
                    ) : referrals.sent.map(r => (
                      <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4" data-testid={`sent-referral-${r.id}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{r.case_type} Case</p>
                            <p className="text-xs text-slate-500">To: {r.referred_to_name}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {r.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{r.case_description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'knowledge' && (
          <KnowledgeBase />
        )}
      </div>
      </div>
    </div>
  );
};

export default LawyerDashboard;
