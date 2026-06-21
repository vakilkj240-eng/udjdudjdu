import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Loader2, FileText, Plus, Trash2, Download, Eye, PenLine, Globe, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import API_URL from '../lib/api';

const AFFIDAVIT_LANGUAGES = [
  { code: 'English', label: 'English' },
  { code: 'Hindi', label: 'Hindi (हिन्दी)' },
  { code: 'Bengali', label: 'Bengali (বাংলা)' },
  { code: 'Telugu', label: 'Telugu (తెలుగు)' },
  { code: 'Marathi', label: 'Marathi (मराठी)' },
  { code: 'Tamil', label: 'Tamil (தமிழ்)' },
  { code: 'Gujarati', label: 'Gujarati (ગુજરાતી)' },
  { code: 'Kannada', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'Malayalam', label: 'Malayalam (മലയാളം)' },
  { code: 'Punjabi', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'Odia', label: 'Odia (ଓଡ଼ିଆ)' },
  { code: 'Assamese', label: 'Assamese (অসমীয়া)' },
  { code: 'Urdu', label: 'Urdu (اردو)' },
];

const AffidavitBuilder = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [formData, setFormData] = useState({
    affiant_name: user?.name || '',
    affiant_address: '',
    purpose: '',
    court_name: '',
    case_number: '',
  });
  const [facts, setFacts] = useState(['']);
  const [generatedText, setGeneratedText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [showWriterModal, setShowWriterModal] = useState(false);
  const [writerRequest, setWriterRequest] = useState({ title: '', description: '', budget: '' });
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const addFact = () => setFacts([...facts, '']);

  const removeFact = (index) => {
    if (facts.length > 1) setFacts(facts.filter((_, i) => i !== index));
  };

  const updateFact = (index, value) => {
    const updated = [...facts];
    updated[index] = value;
    setFacts(updated);
  };

  const handleGenerate = async () => {
    if (!formData.affiant_name || !formData.purpose || facts.filter(f => f.trim()).length === 0) {
      toast.error('Please fill in name, purpose, and at least one fact');
      return;
    }
    setGenerating(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/generate-affidavit`, {
        ...formData,
        facts: facts.filter(f => f.trim()),
        language: selectedLanguage,
      }, {});
      setGeneratedText(data.affidavit_text);
      setEditedText(data.affidavit_text);
      toast.success(`Affidavit generated in ${selectedLanguage}!`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate affidavit');
    } finally {
      setGenerating(false);
    }
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const text = editedText || generatedText;
    doc.setFillColor(124, 29, 43);
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('AFFIDAVIT', 105, 16, { align: 'center' });
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text, 180);
    let y = 35;
    lines.forEach(line => {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(line, 15, y);
      y += 5;
    });
    doc.save(`Affidavit-${formData.affiant_name.replace(/\s+/g, '_')}-${selectedLanguage}.pdf`);
  };

  const handleWriterRequest = async () => {
    if (!writerRequest.title || !writerRequest.description) {
      toast.error('Please provide a title and description for your request');
      return;
    }
    setSubmittingRequest(true);
    try {
      await axios.post(`${API_URL}/api/writing-requests`, {
        title: writerRequest.title,
        description: writerRequest.description,
        budget: writerRequest.budget || 'To be discussed',
        affidavit_details: { ...formData, facts: facts.filter(f => f.trim()), language: selectedLanguage },
        document_type: 'affidavit',
      }, {});
      toast.success('Your request has been sent to legal content writers!');
      setShowWriterModal(false);
      setWriterRequest({ title: '', description: '', budget: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit request');
    } finally {
      setSubmittingRequest(false);
    }
  };

  return (
    <div className="min-h-screen relative" style={{ background: '#FDFAF5', isolation: 'isolate' }} data-testid="affidavit-page">
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: -1, backgroundImage: `url(${process.env.PUBLIC_URL}/gold-pattern.png)`, backgroundRepeat: 'repeat', backgroundSize: '320px 320px', opacity: 0.18, pointerEvents: 'none' }} />
      <div className="relative z-10">
      <Navbar />

      {/* Brand page header */}
      <div className="pt-2">
        <div className="px-6 py-8" style={{ background: 'linear-gradient(135deg, #7C1D2B 0%, #9b2335 55%, #4a1118 100%)' }}>
          <div className="max-w-5xl mx-auto flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(201,168,76,0.2)' }}>
                  <FileText className="w-4.5 h-4.5" style={{ color: '#F0C84A' }} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(201,168,76,0.8)' }}>Document Tools</span>
                  <span style={{ color: 'rgba(201,168,76,0.4)' }}>›</span>
                  <span className="text-xs font-semibold uppercase tracking-widest text-white/60">Affidavit Builder</span>
                </div>
              </div>
              <h1 className="font-serif text-2xl font-bold text-white" data-testid="affidavit-title">Affidavit Generator</h1>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Generate a legally formatted affidavit in your preferred Indian language.</p>
            </div>
            <button
              onClick={() => setShowWriterModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90 shadow-lg self-center"
              style={{ background: 'rgba(201,168,76,0.2)', color: '#F0C84A', border: '1px solid rgba(201,168,76,0.35)', backdropFilter: 'blur(8px)' }}
            >
              <PenLine className="w-4 h-4" />
              Hire Legal Content Writer
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6" data-testid="affidavit-form">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Details</h2>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-slate-500" />
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 outline-none"
                  style={{ maxWidth: 160 }}
                >
                  {AFFIDAVIT_LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name (Affiant)</label>
                <input type="text" value={formData.affiant_name}
                  onChange={(e) => setFormData({ ...formData, affiant_name: e.target.value })}
                  className="w-full border-2 border-slate-200 focus:border-slate-800 rounded-lg p-3 outline-none transition-colors text-slate-900"
                  placeholder="Enter your full legal name" data-testid="affiant-name-input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input type="text" value={formData.affiant_address}
                  onChange={(e) => setFormData({ ...formData, affiant_address: e.target.value })}
                  className="w-full border-2 border-slate-200 focus:border-slate-800 rounded-lg p-3 outline-none transition-colors text-slate-900"
                  placeholder="Full residential address" data-testid="affiant-address-input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Purpose of Affidavit</label>
                <input type="text" value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full border-2 border-slate-200 focus:border-slate-800 rounded-lg p-3 outline-none transition-colors text-slate-900"
                  placeholder="e.g., Name change, property transfer, general" data-testid="purpose-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Court Name (optional)</label>
                  <input type="text" value={formData.court_name}
                    onChange={(e) => setFormData({ ...formData, court_name: e.target.value })}
                    className="w-full border-2 border-slate-200 focus:border-slate-800 rounded-lg p-3 outline-none transition-colors text-slate-900"
                    placeholder="Court name" data-testid="court-name-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Case Number (optional)</label>
                  <input type="text" value={formData.case_number}
                    onChange={(e) => setFormData({ ...formData, case_number: e.target.value })}
                    className="w-full border-2 border-slate-200 focus:border-slate-800 rounded-lg p-3 outline-none transition-colors text-slate-900"
                    placeholder="Case number" data-testid="case-number-input" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Facts (Statements)</label>
                <div className="space-y-2">
                  {facts.map((fact, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-sm text-slate-400 mt-3 w-6">{i + 1}.</span>
                      <input type="text" value={fact} onChange={(e) => updateFact(i, e.target.value)}
                        className="flex-1 border-2 border-slate-200 focus:border-slate-800 rounded-lg p-2.5 outline-none transition-colors text-sm text-slate-900"
                        placeholder={`Fact ${i + 1}...`} data-testid={`fact-input-${i}`} />
                      {facts.length > 1 && (
                        <button onClick={() => removeFact(i)} className="text-slate-400 hover:text-red-500" data-testid={`remove-fact-${i}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addFact}
                  className="mt-2 text-sm text-slate-600 hover:text-slate-800 flex items-center gap-1 font-medium"
                  data-testid="add-fact-btn">
                  <Plus className="w-4 h-4" /> Add Fact
                </button>
              </div>

              <button onClick={handleGenerate} disabled={generating}
                className="w-full text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: generating ? '#94a3b8' : '#7C1D2B' }}
                data-testid="generate-affidavit-btn">
                {generating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating in {selectedLanguage}...</>
                ) : (
                  <><FileText className="w-4 h-4" /> Generate in {selectedLanguage}</>
                )}
              </button>
            </div>
          </div>

          {/* Preview / Edit */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6" data-testid="affidavit-preview">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Eye className="w-5 h-5" /> Preview &amp; Edit
              </h2>
              {editedText && (
                <button onClick={downloadPDF}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-1"
                  data-testid="download-affidavit-pdf">
                  <Download className="w-4 h-4" /> Download PDF
                </button>
              )}
            </div>
            {editedText ? (
              <textarea value={editedText} onChange={(e) => setEditedText(e.target.value)}
                className="w-full h-[500px] border-2 border-slate-200 focus:border-slate-800 rounded-lg p-4 outline-none transition-colors text-sm text-slate-800 font-mono leading-relaxed resize-none"
                data-testid="affidavit-editor" />
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-slate-400 text-sm gap-3">
                <FileText className="w-10 h-10 opacity-30" />
                <p>Generated affidavit will appear here</p>
                <p className="text-xs text-center" style={{ color: '#C9A84C' }}>Select language above and click Generate</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hire Legal Content Writer Modal */}
      {showWriterModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowWriterModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,29,43,0.1)' }}>
                  <PenLine className="w-5 h-5" style={{ color: '#7C1D2B' }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Hire Legal Content Writer</h2>
                  <p className="text-xs text-slate-500">Expert writers will draft your affidavit professionally</p>
                </div>
              </div>
              <button onClick={() => setShowWriterModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Request Title</label>
                <input type="text" value={writerRequest.title}
                  onChange={e => setWriterRequest(r => ({ ...r, title: e.target.value }))}
                  className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none text-slate-900 text-sm"
                  onFocus={e => e.target.style.borderColor = '#7C1D2B'}
                  onBlur={e => e.target.style.borderColor = ''}
                  placeholder="e.g., Name change affidavit in Hindi" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
                <textarea value={writerRequest.description}
                  onChange={e => setWriterRequest(r => ({ ...r, description: e.target.value }))}
                  className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none text-slate-900 text-sm resize-none"
                  onFocus={e => e.target.style.borderColor = '#7C1D2B'}
                  onBlur={e => e.target.style.borderColor = ''}
                  rows={4}
                  placeholder="Describe what you need the legal writer to draft. Include any specific requirements, court details, or language preferences..." />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Budget (₹)</label>
                <input type="text" value={writerRequest.budget}
                  onChange={e => setWriterRequest(r => ({ ...r, budget: e.target.value }))}
                  className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none text-slate-900 text-sm"
                  onFocus={e => e.target.style.borderColor = '#7C1D2B'}
                  onBlur={e => e.target.style.borderColor = ''}
                  placeholder="e.g., ₹500 - ₹1000 (or leave blank for discussion)" />
              </div>
              <div className="p-3 rounded-lg text-xs" style={{ background: 'rgba(124,29,43,0.06)', color: '#7C1D2B' }}>
                📋 Your affidavit details and selected language ({selectedLanguage}) will be shared with the writer.
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowWriterModal(false)}
                className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleWriterRequest} disabled={submittingRequest}
                className="flex-1 py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
                style={{ background: '#7C1D2B' }}>
                {submittingRequest ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit Request'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </div>
    </div>
  );
};

export default AffidavitBuilder;
