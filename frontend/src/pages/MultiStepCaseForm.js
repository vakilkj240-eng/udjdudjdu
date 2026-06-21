import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, Loader2, FileText } from 'lucide-react';
import API_URL from '../lib/api';

const STEPS = ['Basics', 'Details'];

const MultiStepCaseForm = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    case_type: 'Civil',
    location: '',
    urgency: 'Medium',
    budget: 'To be discussed',
    description: '',
  });

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!form.description.trim()) {
      toast.error('Please add a case description');
      return;
    }
    if (!user) {
      toast.error('Please log in');
      navigate('/login');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(
        `${API_URL}/api/cases`,
        {
          case_type: form.case_type,
          description: form.description.trim(),
          location: form.location || 'Not specified',
          urgency: form.urgency,
          budget: form.budget,
        },
      );
      toast.success('Case submitted');
      navigate('/client/cases');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit case');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" data-testid="multistep-case-page">
      <Navbar />
      <div className="max-w-xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-7 h-7 text-slate-800" />
          <h1 className="font-heading text-2xl font-bold text-slate-900">New case</h1>
        </div>
        <p className="text-sm text-slate-500 mb-6">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>

        <div className="flex gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`flex-1 h-1.5 rounded-full ${i <= step ? 'bg-slate-900' : 'bg-slate-200'}`}
            />
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Case type</label>
                <select
                  value={form.case_type}
                  onChange={(e) => update('case_type', e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                >
                  <option value="Civil">Civil</option>
                  <option value="Criminal">Criminal</option>
                  <option value="Family">Family</option>
                  <option value="Property">Property</option>
                  <option value="Employment">Employment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                <input
                  value={form.location}
                  onChange={(e) => update('location', e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                  placeholder="City or state"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Urgency</label>
                <select
                  value={form.urgency}
                  onChange={(e) => update('urgency', e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Budget</label>
                <input
                  value={form.budget}
                  onChange={(e) => update('budget', e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                  placeholder="e.g. ₹10,000–25,000"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Case description</label>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={8}
                className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                placeholder="Describe your legal matter…"
              />
            </div>
          )}

          <div className="flex justify-between mt-8 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 disabled:opacity-40"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900 text-white font-medium"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900 text-white font-medium disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Submit case
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiStepCaseForm;
