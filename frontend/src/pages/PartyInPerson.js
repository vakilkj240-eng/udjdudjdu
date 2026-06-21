import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, Circle, ChevronRight, Upload, AlertTriangle,
  Scale, FileText, ArrowLeft, Loader2, User, Phone,
  Shield, BookOpen, Home, Info, X, RefreshCw
} from 'lucide-react';
import API_URL from '../lib/api';

const WORKFLOW_LABELS = {
  consumer_complaint: 'Consumer Complaint',
  rental_dispute: 'Rental Dispute',
  affidavit_filing: 'Affidavit Filing',
};

const WORKFLOW_ICONS = {
  consumer_complaint: '🛒',
  rental_dispute: '🏠',
  affidavit_filing: '📄',
};

const WORKFLOW_OPTIONS = [
  {
    key: 'consumer_complaint',
    label: 'Consumer Complaint',
    description: 'File against a seller or service provider',
    icon: '🛒',
    examples: 'Defective product, service not rendered, overcharging',
  },
  {
    key: 'rental_dispute',
    label: 'Rental Dispute',
    description: 'Landlord-tenant disagreements',
    icon: '🏠',
    examples: 'Deposit not returned, illegal eviction, maintenance issues',
  },
  {
    key: 'affidavit_filing',
    label: 'Affidavit Filing',
    description: 'Prepare a legal sworn statement',
    icon: '📄',
    examples: 'Name change, address proof, financial declaration',
  },
];

const StepIndicator = ({ steps, currentStage }) => (
  <div className="flex items-center gap-0">
    {steps.map((step, i) => {
      const done = i < currentStage;
      const active = i === currentStage;
      const pending = i > currentStage;
      return (
        <React.Fragment key={step.step}>
          <div className="flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all
                ${done ? 'bg-green-500 text-white' : active ? 'bg-amber-500 text-white ring-4 ring-amber-100' : 'bg-slate-200 text-slate-400'}`}
            >
              {done ? <CheckCircle className="w-5 h-5" /> : step.step}
            </div>
            <span
              className={`mt-1 text-xs font-medium max-w-[70px] text-center leading-tight
                ${done ? 'text-green-700' : active ? 'text-amber-700' : 'text-slate-400'}`}
            >
              {step.title}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-0.5 flex-1 mx-1 mb-5 transition-all ${done ? 'bg-green-400' : 'bg-slate-200'}`}
            />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

const DocBadge = ({ doc }) => (
  <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2.5 py-1 rounded-full">
    <FileText className="w-3 h-3" />
    {doc}
  </span>
);

const UploadZone = ({ stepTitle, onUpload }) => {
  const [dragging, setDragging] = useState(false);
  const [uploaded, setUploaded] = useState([]);

  const handleFiles = (files) => {
    const names = Array.from(files).map((f) => f.name);
    setUploaded((prev) => [...prev, ...names]);
    if (onUpload) onUpload(names);
    toast.success(`${names.length} file(s) noted`);
  };

  return (
    <div className="mt-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
          ${dragging ? 'border-amber-400 bg-amber-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50'}`}
        onClick={() => document.getElementById(`file-upload-${stepTitle}`)?.click()}
      >
        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-600 font-medium">Drag files here or click to upload</p>
        <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG supported</p>
        <input
          id={`file-upload-${stepTitle}`}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          accept=".pdf,.jpg,.jpeg,.png"
        />
      </div>
      {uploaded.length > 0 && (
        <div className="mt-3 space-y-1">
          {uploaded.map((name, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SwitchToLawyerModal = ({ onConfirm, onCancel, loading }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
  >
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
          <Scale className="w-6 h-6 text-amber-600" />
        </div>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">Connect with a Lawyer?</h3>
      <p className="text-sm text-slate-600 mb-5">
        Your progress will be saved. A lawyer will review your case and contact you to provide professional assistance. You can always return to handle it yourself.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-xl transition-colors"
        >
          Continue Myself
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
          Get a Lawyer
        </button>
      </div>
    </motion.div>
  </motion.div>
);

const CompletionScreen = ({ workflowType, onStartNew, onGoToCases }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="text-center py-12 px-8"
  >
    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
      <CheckCircle className="w-10 h-10 text-green-500" />
    </div>
    <h2 className="text-2xl font-bold text-slate-900 mb-3">All Steps Completed!</h2>
    <p className="text-slate-600 mb-2">
      You have successfully completed your self-representation guide for{' '}
      <strong>{WORKFLOW_LABELS[workflowType] || workflowType}</strong>.
    </p>
    <p className="text-sm text-slate-500 mb-8">
      Your documentation status is now marked as <span className="font-semibold text-green-700">Completed</span>. Check your case dashboard for full details.
    </p>
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <button
        onClick={onGoToCases}
        className="flex items-center justify-center gap-2 bg-slate-900 text-white font-medium px-6 py-3 rounded-xl hover:bg-slate-800 transition-colors"
      >
        <BookOpen className="w-4 h-4" /> View My Cases
      </button>
      <button
        onClick={onStartNew}
        className="flex items-center justify-center gap-2 bg-slate-100 text-slate-700 font-medium px-6 py-3 rounded-xl hover:bg-slate-200 transition-colors"
      >
        <RefreshCw className="w-4 h-4" /> Start Another Case
      </button>
    </div>
  </motion.div>
);

const PartyInPerson = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const passedState = location.state || {};

  const [view, setView] = useState('select');
  const [selectedWorkflow, setSelectedWorkflow] = useState(passedState.workflowType || '');
  const [description, setDescription] = useState(passedState.description || '');
  const [riskLevel] = useState(passedState.riskLevel || 'Low');
  const [caseType] = useState(passedState.caseType || '');

  const [initiating, setInitiating] = useState(false);
  const [caseId, setCaseId] = useState(null);
  const [workflowData, setWorkflowData] = useState(null);
  const [loadingWorkflow, setLoadingWorkflow] = useState(false);

  const [advancing, setAdvancing] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switchingToLawyer, setSwitchingToLawyer] = useState(false);

  const isComplete =
    workflowData && workflowData.workflow_stage >= workflowData.total_steps;

  const fetchWorkflow = useCallback(async (id) => {
    setLoadingWorkflow(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/pip/workflow/${id}`);
      setWorkflowData(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load workflow');
    } finally {
      setLoadingWorkflow(false);
    }
  }, []);

  useEffect(() => {
    if (passedState.caseId) {
      setCaseId(passedState.caseId);
      fetchWorkflow(passedState.caseId);
      setView('workflow');
    }
  }, [passedState.caseId, fetchWorkflow]);

  const handleInitiate = async () => {
    if (!selectedWorkflow) {
      toast.error('Please select a case type');
      return;
    }
    if (!description.trim()) {
      toast.error('Please describe your case briefly');
      return;
    }
    if (!user) {
      toast.error('Please log in to continue');
      navigate('/login');
      return;
    }

    setInitiating(true);
    try {
      const resolvedCaseType = caseType || selectedWorkflow;
      const { data } = await axios.post(`${API_URL}/api/pip/initiate`, {
        case_type: resolvedCaseType,
        description: description.trim(),
        risk_level: riskLevel,
      });
      setCaseId(data.case_id);
      toast.success('Case initiated! Follow the steps below.');
      await fetchWorkflow(data.case_id);
      setView('workflow');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to initiate case';
      toast.error(msg);
      if (msg.toLowerCase().includes('only available for low')) {
        setTimeout(() => navigate('/client/lawyers'), 2000);
      }
    } finally {
      setInitiating(false);
    }
  };

  const handleNextStep = async () => {
    if (!caseId) return;
    setAdvancing(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/pip/next-step`, { case_id: caseId });
      toast.success(data.message);
      await fetchWorkflow(caseId);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to advance step');
    } finally {
      setAdvancing(false);
    }
  };

  const handleSwitchToLawyer = async () => {
    setSwitchingToLawyer(true);
    try {
      await axios.post(`${API_URL}/api/pip/request-doc`, {
        case_id: caseId,
        notes: 'Client requested lawyer assistance from self-representation workflow',
      });
      toast.success('Request sent! A lawyer will contact you shortly.');
      setShowSwitchModal(false);
      setTimeout(() => navigate('/client/lawyers'), 1500);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to request lawyer assistance');
    } finally {
      setSwitchingToLawyer(false);
    }
  };

  const currentStep =
    workflowData && !isComplete ? workflowData.steps[workflowData.workflow_stage] : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <AnimatePresence>
        {showSwitchModal && (
          <SwitchToLawyerModal
            onConfirm={handleSwitchToLawyer}
            onCancel={() => setShowSwitchModal(false)}
            loading={switchingToLawyer}
          />
        )}
      </AnimatePresence>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/client/dashboard')}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
              <User className="w-7 h-7 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Party in Person</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Handle your low-risk case independently with our step-by-step guide
              </p>
            </div>
          </div>
        </div>

        {/* Low-risk notice */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3 mb-6">
          <Shield className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">You qualify for self-representation</p>
            <p className="text-xs text-green-700 mt-0.5">
              Your case has been assessed as <strong>Low risk</strong>. You can handle this independently with our guided workflow. A lawyer is always available if you change your mind.
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">

          {/* ── VIEW: SELECT WORKFLOW ── */}
          {view === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-1">Choose Your Case Type</h2>
                <p className="text-sm text-slate-500 mb-5">Select the category that best describes your situation</p>

                <div className="space-y-3">
                  {WORKFLOW_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setSelectedWorkflow(opt.key)}
                      className={`w-full text-left rounded-xl border-2 p-4 transition-all
                        ${selectedWorkflow === opt.key
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{opt.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-slate-900">{opt.label}</p>
                            {selectedWorkflow === opt.key && (
                              <CheckCircle className="w-5 h-5 text-amber-500" />
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">{opt.description}</p>
                          <p className="text-xs text-slate-400 mt-1">e.g. {opt.examples}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-5">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Brief Description of Your Case
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Describe your situation in a few sentences..."
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  />
                </div>

                <div className="mt-5 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleInitiate}
                    disabled={initiating || !selectedWorkflow || !description.trim()}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {initiating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</>
                    ) : (
                      <><ChevronRight className="w-4 h-4" /> Start Self-Representation</>
                    )}
                  </button>
                  <button
                    onClick={() => navigate('/client/lawyers')}
                    className="flex items-center justify-center gap-2 border border-slate-200 text-slate-600 font-medium py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors text-sm"
                  >
                    <Scale className="w-4 h-4" /> I want a Lawyer
                  </button>
                </div>
              </div>

              {/* Info box */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">How Party in Person works</p>
                  <ul className="space-y-1 text-xs text-blue-700 list-disc list-inside">
                    <li>Follow 4 simple guided steps tailored to your case type</li>
                    <li>Upload your documents at each stage</li>
                    <li>Get notified as you progress</li>
                    <li>Switch to a lawyer at any time with one click</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── VIEW: WORKFLOW ── */}
          {view === 'workflow' && (
            <motion.div
              key="workflow"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="space-y-6"
            >
              {loadingWorkflow && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                </div>
              )}

              {!loadingWorkflow && workflowData && (
                <>
                  {/* Completion screen */}
                  {isComplete ? (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <CompletionScreen
                        workflowType={workflowData.workflow_type}
                        onStartNew={() => { setView('select'); setCaseId(null); setWorkflowData(null); setSelectedWorkflow(''); setDescription(''); }}
                        onGoToCases={() => navigate('/client/cases')}
                      />
                    </div>
                  ) : (
                    <>
                      {/* Progress card */}
                      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{WORKFLOW_ICONS[workflowData.workflow_type] || '⚖️'}</span>
                              <h2 className="font-bold text-slate-900">
                                {WORKFLOW_LABELS[workflowData.workflow_type] || workflowData.workflow_type}
                              </h2>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Step {workflowData.workflow_stage + 1} of {workflowData.total_steps} &bull;{' '}
                              <span className={`font-medium ${workflowData.documentation_status === 'Completed' ? 'text-green-600' : 'text-amber-600'}`}>
                                {workflowData.documentation_status}
                              </span>
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-amber-600">
                              {Math.round((workflowData.workflow_stage / workflowData.total_steps) * 100)}%
                            </div>
                            <div className="text-xs text-slate-400">Complete</div>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full bg-slate-100 rounded-full h-2 mb-5">
                          <motion.div
                            className="bg-amber-500 h-2 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${(workflowData.workflow_stage / workflowData.total_steps) * 100}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>

                        <StepIndicator steps={workflowData.steps} currentStage={workflowData.workflow_stage} />
                      </div>

                      {/* Current step card */}
                      {currentStep && (
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={currentStep.step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                          >
                            {/* Step header */}
                            <div className="bg-gradient-to-r from-amber-500 to-amber-400 px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                  <span className="text-white font-bold text-lg">{currentStep.step}</span>
                                </div>
                                <div>
                                  <p className="text-amber-100 text-xs font-medium uppercase tracking-wide">
                                    Current Step
                                  </p>
                                  <h3 className="text-white font-bold text-xl">{currentStep.title}</h3>
                                </div>
                              </div>
                            </div>

                            <div className="p-6 space-y-5">
                              {/* Instructions */}
                              <div>
                                <p className="text-sm font-semibold text-slate-700 mb-2">What to do</p>
                                <p className="text-sm text-slate-600 leading-relaxed">{currentStep.description}</p>
                              </div>

                              {/* Required docs */}
                              {currentStep.required_docs?.length > 0 && (
                                <div>
                                  <p className="text-sm font-semibold text-slate-700 mb-2">Required Documents</p>
                                  <div className="flex flex-wrap gap-2">
                                    {currentStep.required_docs.map((doc, i) => (
                                      <DocBadge key={i} doc={doc} />
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Upload zone */}
                              <div>
                                <p className="text-sm font-semibold text-slate-700 mb-1">Upload Your Documents</p>
                                <UploadZone stepTitle={currentStep.title} />
                              </div>

                              {/* Action buttons */}
                              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                                <button
                                  onClick={handleNextStep}
                                  disabled={advancing}
                                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                  {advancing ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-4 h-4" />
                                      {currentStep.action} &amp; Continue
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => setShowSwitchModal(true)}
                                  className="flex items-center justify-center gap-2 border border-slate-200 text-slate-600 font-medium py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors text-sm"
                                >
                                  <Scale className="w-4 h-4" /> Switch to Lawyer
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      )}

                      {/* All steps overview */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <h3 className="font-semibold text-slate-800 mb-4 text-sm uppercase tracking-wide">All Steps Overview</h3>
                        <div className="space-y-3">
                          {workflowData.steps.map((step, i) => {
                            const done = i < workflowData.workflow_stage;
                            const active = i === workflowData.workflow_stage;
                            return (
                              <div
                                key={step.step}
                                className={`flex items-start gap-3 p-3 rounded-xl transition-all
                                  ${active ? 'bg-amber-50 border border-amber-200' : done ? 'bg-green-50 border border-green-100' : 'bg-slate-50 border border-transparent'}`}
                              >
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
                                  ${done ? 'bg-green-500' : active ? 'bg-amber-500' : 'bg-slate-200'}`}>
                                  {done ? (
                                    <CheckCircle className="w-4 h-4 text-white" />
                                  ) : (
                                    <Circle className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                                  )}
                                </div>
                                <div>
                                  <p className={`text-sm font-medium ${done ? 'text-green-700' : active ? 'text-amber-700' : 'text-slate-400'}`}>
                                    Step {step.step}: {step.title}
                                  </p>
                                  <p className={`text-xs mt-0.5 ${done ? 'text-green-600' : active ? 'text-amber-600' : 'text-slate-400'}`}>
                                    {done ? 'Completed' : active ? 'In Progress' : 'Pending'}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Disclaimer */}
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800">
                          <strong>Disclaimer:</strong> This guide is for informational purposes only. For complex legal matters, always consult a qualified lawyer. You can switch to a lawyer at any step.
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PartyInPerson;
