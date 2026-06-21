import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import DocumentUpload from '../components/DocumentUpload';
import NyayIDCard from '../components/NyayIDCard';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, Scale, FileText, CheckCircle, ArrowRight, ArrowLeft,
  ExternalLink, Award, MapPin, Star, AlertTriangle, Info,
  Search, Brain, MessageSquare, Shield, Phone, Mail,
  ChevronRight, Stamp, BookOpen, CreditCard
} from 'lucide-react';

import API_URL from '../lib/api';

const PHASES = {
  DESCRIBE: 'describe',
  ANALYZE: 'analyze',
  QUESTIONS: 'questions',
  RESULTS: 'results',
  NYAYID: 'nyayid'
};

const TextAnswer = ({ onSubmit }) => {
  const [value, setValue] = React.useState('');
  return (
    <div className="space-y-3">
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        rows={3}
        placeholder="Type your answer here..."
        className="w-full border-2 border-slate-200 focus:border-slate-400 rounded-lg p-3 text-slate-800 text-sm resize-none outline-none transition-all"
        data-testid="text-answer-input"
      />
      <button
        onClick={() => { if (value.trim()) { onSubmit(value.trim()); setValue(''); } }}
        disabled={!value.trim()}
        className="bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white font-medium py-2.5 px-6 rounded-lg transition-all"
        data-testid="text-answer-submit"
      >
        Submit Answer
      </button>
    </div>
  );
};

const ClientHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Phase management
  const [phase, setPhase] = useState(PHASES.DESCRIBE);

  // Describe phase
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [urgency, setUrgency] = useState('Medium');

  // Analysis phase
  const [keywords, setKeywords] = useState([]);
  const [category, setCategory] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [reasoning, setReasoning] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  // Questions phase
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answers, setAnswers] = useState({});
  const [questionHistory, setQuestionHistory] = useState([]);
  const [loadingQuestion, setLoadingQuestion] = useState(false);

  // Results phase
  const [analysisResult, setAnalysisResult] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [plainSummary, setPlainSummary] = useState(null);

  // NyayID phase
  const [nyayData, setNyayData] = useState(null);
  const [loadingNyayID, setLoadingNyayID] = useState(false);

  // Stamp paper
  const [showStampDiagnostic, setShowStampDiagnostic] = useState(false);
  const [stampResult, setStampResult] = useState(null);

  // Consultation
  const [connectingLawyer, setConnectingLawyer] = useState(null);

  // Saving
  const [savingCase, setSavingCase] = useState(false);

  // Translation
  const [translating, setTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState('');
  const [translateLang, setTranslateLang] = useState('');

  const phaseOrder = [PHASES.DESCRIBE, PHASES.ANALYZE, PHASES.QUESTIONS, PHASES.RESULTS, PHASES.NYAYID];
  const phaseIndex = phaseOrder.indexOf(phase);

  // ─── Phase 1: Extract Keywords & Detect Category ───
  const handleAnalyze = async (overrideText) => {
    const textToAnalyze = (typeof overrideText === 'string' ? overrideText : '') || description;
    if (!textToAnalyze.trim()) {
      toast.error('Please describe your legal matter');
      return;
    }
    if (typeof overrideText === 'string' && overrideText) setDescription(overrideText);
    setAnalyzing(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/extract-keywords`, { text: textToAnalyze });
      setKeywords(data.keywords || []);
      setCategory(data.suggested_category || 'Civil');
      setConfidence(data.confidence || 70);
      setReasoning(data.reasoning || '');
      setPhase(PHASES.ANALYZE);
      toast.success('Keywords extracted and category detected!');
    } catch (err) {
      toast.error('Failed to analyze text. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  // ─── Phase 2: Start Decision Tree Questions ───
  const startQuestions = async () => {
    setLoadingQuestion(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/get-questions`, {
        category,
        description,
        question_id: null,
        previous_answers: {}
      });
      if (data.question) {
        setCurrentQuestion(data.question);
        setQuestionHistory([data.question]);
        setPhase(PHASES.QUESTIONS);
      } else {
        toast.error('No questions available for this category');
      }
    } catch (err) {
      toast.error('Failed to load questions');
    } finally {
      setLoadingQuestion(false);
    }
  };

  // ─── Phase 3: Answer Question & Get Next ───
  const handleAnswer = async (answer) => {
    if (!currentQuestion) return;

    const updatedAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(updatedAnswers);
    setLoadingQuestion(true);

    try {
      const { data } = await axios.post(`${API_URL}/api/get-questions`, {
        category,
        description,
        question_id: currentQuestion.id,
        previous_answers: updatedAnswers
      });

      if (data.question) {
        setCurrentQuestion(data.question);
        setQuestionHistory(prev => [...prev, data.question]);
      } else {
        // No more questions - proceed to results
        await fetchResults(updatedAnswers);
      }
    } catch (err) {
      toast.error('Failed to load next question');
    } finally {
      setLoadingQuestion(false);
    }
  };

  // ─── Phase 4: Get Analysis Results ───
  const fetchResults = async (finalAnswers) => {
    setLoadingResults(true);
    setPlainSummary(null);
    setPhase(PHASES.RESULTS);

    try {
      const [analysisRes, riskRes] = await Promise.all([
        axios.post(`${API_URL}/api/analyze-case`, {
          case_type: category,
          description,
          location: location || 'India',
          urgency
        }),
        axios.post(`${API_URL}/api/risk-analysis`, {
          category,
          answers: finalAnswers,
          description
        })
      ]);

      setAnalysisResult(analysisRes.data);
      setRiskData(riskRes.data);

      // Fetch plain-language summary in background (non-blocking)
      axios.post(`${API_URL}/api/plain-summary`, {
        description,
        case_type: category,
        location: location || 'India',
        answers: finalAnswers,
        relevant_laws: analysisRes.data?.relevant_laws?.slice(0, 3) || []
      }).then(r => setPlainSummary(r.data?.summary || null)).catch(() => {});

    } catch (err) {
      toast.error('Failed to generate analysis. Please try again.');
    } finally {
      setLoadingResults(false);
    }
  };

  // ─── Phase 5: Generate NyayID ───
  const generateNyayID = async () => {
    setLoadingNyayID(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/generate-nyayid`, {
        case_data: { category, description, location, urgency },
        analysis_result: analysisResult || {},
        answers
      });
      setNyayData(data);
      setPhase(PHASES.NYAYID);
    } catch (err) {
      toast.error('Failed to generate NyayID');
    } finally {
      setLoadingNyayID(false);
    }
  };

  // ─── Connect with Lawyer ───
  const handleConnect = async (lawyer) => {
    if (!user) {
      toast.error('Please login to connect with a lawyer');
      navigate('/login');
      return;
    }
    setConnectingLawyer(lawyer.id);
    try {
      await axios.post(`${API_URL}/api/consultation-request`, {
        lawyer_id: lawyer.id,
        case_summary: description.slice(0, 200),
        category,
        urgency,
        contact_preference: 'email'
      }, {  });
      toast.success(`Consultation request sent to ${lawyer.name}!`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send request');
    } finally {
      setConnectingLawyer(null);
    }
  };

  // ─── Save Case ───
  const handleSaveCase = async () => {
    if (!user) {
      toast.error('Please login to save your case');
      navigate('/login');
      return;
    }
    setSavingCase(true);
    try {
      await axios.post(`${API_URL}/api/save-case-with-nyayid`, {
        category,
        description,
        location,
        urgency,
        nyay_id: nyayData?.nyay_id,
        analysis_summary: analysisResult?.analysis?.slice(0, 500),
        risk_level: riskData?.risk_level,
        complexity: riskData?.level
      }, {  });
      toast.success('Case saved to your dashboard!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save case');
    } finally {
      setSavingCase(false);
    }
  };

  // ─── Stamp Paper Diagnostic ───
  const handleStampDiagnostic = async (inputs) => {
    try {
      const { data } = await axios.post(`${API_URL}/api/stamp-paper-diagnostic`, inputs);
      setStampResult(data);
    } catch (err) {
      toast.error('Failed to diagnose stamp paper type');
    }
  };

  // ─── Translate ───
  const handleTranslate = async (text, lang) => {
    setTranslating(true);
    setTranslateLang(lang);
    try {
      const { data } = await axios.post(`${API_URL}/api/translate`, {
        text,
        target_language: lang
      });
      setTranslatedText(data.translated_text);
    } catch (err) {
      toast.error('Translation failed');
    } finally {
      setTranslating(false);
    }
  };

  // ─── Reset ───
  const resetAll = () => {
    setPhase(PHASES.DESCRIBE);
    setDescription('');
    setLocation('');
    setUrgency('Medium');
    setKeywords([]);
    setCategory('');
    setConfidence(0);
    setReasoning('');
    setCurrentQuestion(null);
    setAnswers({});
    setQuestionHistory([]);
    setAnalysisResult(null);
    setRiskData(null);
    setPlainSummary(null);
    setNyayData(null);
    setStampResult(null);
    setShowStampDiagnostic(false);
    setTranslatedText('');
  };

  // ═══════════════════════════════════════════════
  //  RENDER PHASES
  // ═══════════════════════════════════════════════

  const renderProgressBar = () => {
    const labels = ['Describe', 'Category', 'Questions', 'Analysis', 'NyayID'];
    return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-4" data-testid="progress-bar">
      <div className="flex items-center justify-between mb-3 min-w-0">
        {phaseOrder.map((p, i) => {
          const isActive = i === phaseIndex;
          const isComplete = i < phaseIndex;
          return (
            <div key={p} className="flex items-center min-w-0" style={{ flex: i < phaseOrder.length - 1 ? '1 1 0' : '0 0 auto' }}>
              <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                isComplete ? 'bg-amber-400 text-slate-900' : isActive ? 'bg-white text-slate-900' : 'bg-slate-600 text-slate-300'
              }`}>
                {isComplete ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-[10px] ml-1.5 whitespace-nowrap hidden sm:inline ${isActive ? 'text-white font-semibold' : 'text-slate-400'}`}>
                {labels[i]}
              </span>
              {i < phaseOrder.length - 1 && <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0 mx-1" />}
            </div>
          );
        })}
      </div>
      <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-amber-400"
          animate={{ width: `${((phaseIndex + 1) / phaseOrder.length) * 100}%` }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      </div>
    </div>
    );
  };

  // ─── PHASE: DESCRIBE ───
  const renderDescribePhase = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-8"
      data-testid="phase-describe"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Describe Your Legal Matter</h2>
          <p className="text-sm text-slate-500">Tell us what happened, or upload a document</p>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">What is your legal issue?</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border-2 border-slate-200 focus:border-slate-800 rounded-xl p-4 outline-none transition-colors text-slate-900 resize-none bg-white"
            rows="6"
            placeholder="Describe your legal matter in detail. For example: My landlord is refusing to return my security deposit of Rs.50,000 after I vacated the flat..."
            data-testid="description-input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Or upload a document (PDF, image, TXT)</label>
          <DocumentUpload
            onTextExtracted={(text) => setDescription(prev => prev ? prev + '\n\n' + text : text)}
            onAnalyze={handleAnalyze}
            analyzing={analyzing}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full border-2 border-slate-200 focus:border-slate-800 rounded-lg p-3 outline-none transition-colors text-slate-900 bg-white"
              placeholder="City, State"
              data-testid="location-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Urgency</label>
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              className="w-full border-2 border-slate-200 focus:border-slate-800 rounded-lg p-3 outline-none transition-colors text-slate-900 bg-white"
              data-testid="urgency-select"
            >
              <option value="Low">Low - No immediate deadline</option>
              <option value="Medium">Medium - Within weeks</option>
              <option value="High">High - Within days</option>
              <option value="Critical">Critical - Immediate</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!description.trim() || analyzing}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-lg transition-colors flex items-center justify-center gap-2"
          data-testid="analyze-btn"
        >
          {analyzing ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing your case...</>
          ) : (
            <><Brain className="w-5 h-5" /> Analyze Case</>
          )}
        </button>
      </div>
    </motion.div>
  );

  // ─── PHASE: ANALYZE (Category & Keywords) ───
  const renderAnalyzePhase = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-8"
      data-testid="phase-analyze"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
          <Search className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Category Detected</h2>
          <p className="text-sm text-slate-500">Case analysis completed</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Category Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6" data-testid="detected-category">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Detected Category</p>
              <p className="text-2xl font-bold text-slate-900">{category} Law</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-1">Confidence</p>
              <div className="flex items-center gap-2">
                <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${confidence}%` }} />
                </div>
                <span className="text-sm font-bold text-slate-800">{confidence}%</span>
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-600">{reasoning}</p>
        </div>

        {/* Keywords */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Extracted Keywords</p>
          <div className="flex flex-wrap gap-2" data-testid="keywords-list">
            {keywords.map((kw, i) => (
              <span key={i} className="bg-slate-800 text-white text-xs font-medium px-3 py-1.5 rounded-full">{kw}</span>
            ))}
          </div>
        </div>

        {/* Category Selection Override */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Not correct? Select manually:</p>
          <div className="grid grid-cols-5 gap-2" data-testid="category-override">
            {['Criminal', 'Civil', 'Family', 'Property', 'Employment'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  category === cat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                data-testid={`category-btn-${cat.toLowerCase()}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setPhase(PHASES.DESCRIBE)}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            data-testid="back-to-describe"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button
            onClick={startQuestions}
            disabled={loadingQuestion}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            data-testid="start-questions-btn"
          >
            {loadingQuestion ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
            ) : (
              <><MessageSquare className="w-4 h-4" /> Answer Guided Questions</>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );

  // ─── PHASE: QUESTIONS (Decision Tree) ───
  const renderQuestionsPhase = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-8"
      data-testid="phase-questions"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{category} - Guided Questions</h2>
          <p className="text-sm text-slate-500">Question {questionHistory.length} of the assessment</p>
        </div>
      </div>

      {/* Previous answers */}
      {questionHistory.length > 1 && (
        <div className="mb-6 space-y-2" data-testid="answer-history">
          {questionHistory.slice(0, -1).map((q, i) => (
            <div key={q.id} className="flex items-start gap-3 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-slate-500">{q.text}</span>
                <span className="ml-2 font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{answers[q.id]}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Current Question */}
      {currentQuestion && !loadingQuestion && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6" data-testid="current-question">
          <p className="text-lg font-medium text-slate-900 mb-5">{currentQuestion.text}</p>

          {(currentQuestion.type === 'yes_no' || currentQuestion.type === 'yesno') && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleAnswer('yes')}
                className="bg-green-50 hover:bg-green-100 border-2 border-green-200 hover:border-green-400 text-green-800 font-medium py-4 rounded-lg transition-all"
                data-testid="answer-yes"
              >
                Yes
              </button>
              <button
                onClick={() => handleAnswer('no')}
                className="bg-red-50 hover:bg-red-100 border-2 border-red-200 hover:border-red-400 text-red-800 font-medium py-4 rounded-lg transition-all"
                data-testid="answer-no"
              >
                No
              </button>
            </div>
          )}

          {(currentQuestion.type === 'mcq' || currentQuestion.type === 'select' || currentQuestion.type === 'multiple_choice') && currentQuestion.options && (
            <div className="space-y-2" data-testid="mcq-options">
              {currentQuestion.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleAnswer(opt)}
                  className="w-full text-left bg-white hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-400 text-slate-800 font-medium py-3 px-5 rounded-lg transition-all"
                  data-testid={`option-${opt.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {currentQuestion.type === 'text' && (
            <TextAnswer onSubmit={handleAnswer} />
          )}

          {currentQuestion.options && currentQuestion.options.length > 0 && !['yes_no','yesno','mcq','select','multiple_choice','text'].includes(currentQuestion.type) && (
            <div className="space-y-2">
              {currentQuestion.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleAnswer(opt)}
                  className="w-full text-left bg-white hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-400 text-slate-800 font-medium py-3 px-5 rounded-lg transition-all"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loadingQuestion && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
        </div>
      )}
    </motion.div>
  );

  // ─── PHASE: RESULTS ───
  const renderResultsPhase = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-8"
      data-testid="phase-results"
    >
      {loadingResults ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
          <p className="text-slate-600 font-medium">Generating comprehensive analysis...</p>
          <p className="text-sm text-slate-400 mt-1">This may take a moment</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900">
              <strong>Disclaimer:</strong> This legal analysis is for informational purposes only. Consult a qualified lawyer for professional legal guidance.
            </p>
          </div>

          {/* ── AI Plain-Language Summary ── */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 shadow-lg" data-testid="plain-summary-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-amber-400 rounded-lg flex items-center justify-center">
                <Brain className="w-4 h-4 text-slate-900" />
              </div>
              <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Your Case at a Glance</h3>
            </div>
            {plainSummary ? (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-slate-200 text-sm leading-relaxed"
                data-testid="plain-summary-text"
              >
                {plainSummary}
              </motion.p>
            ) : (
              <div className="flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0" />
                <p className="text-slate-400 text-sm">Generating plain-language summary…</p>
              </div>
            )}
          </div>

          {/* Risk Assessment */}
          {riskData && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="risk-cards">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Risk Level</p>
                <p className={`text-lg font-bold ${riskData.risk_level === 'Low' ? 'text-green-700' : riskData.risk_level === 'Medium' ? 'text-amber-700' : 'text-red-700'}`}>
                  {riskData.risk_level}
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Case Strength</p>
                <p className="text-lg font-bold text-slate-800">{riskData.case_strength}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Success Prob.</p>
                <p className="text-lg font-bold text-slate-800">{riskData.success_probability}%</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Complexity</p>
                <p className="text-lg font-bold text-slate-800">{riskData.level}</p>
              </div>
            </div>
          )}

          {/* Party in Person CTA — shown only for Low risk, never for Criminal cases */}
          {riskData?.risk_level === 'Low' && category?.toLowerCase() !== 'criminal' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-11 h-11 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-green-900 text-sm">You can handle this case yourself</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Your case is <strong>Low risk</strong>. Use our step-by-step guided workflow to resolve it independently — no lawyer needed.
                </p>
              </div>
              <button
                onClick={() => navigate('/client/pip', {
                  state: {
                    riskLevel: riskData.risk_level,
                    caseType: category,
                    description: description,
                  }
                })}
                className="flex-shrink-0 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap"
                data-testid="handle-case-yourself-btn"
              >
                <ChevronRight className="w-4 h-4" /> Handle Case Yourself
              </button>
            </div>
          )}

          {/* Relevant Laws */}
          {analysisResult?.relevant_laws?.length > 0 && (
            <div data-testid="relevant-laws">
              <h3 className="text-sm font-mono uppercase tracking-wider text-slate-500 mb-3">Relevant Laws</h3>
              <div className="space-y-3">
                {analysisResult.relevant_laws.map((law, i) => (
                  <div key={i} className="border border-slate-200 rounded-xl p-5 bg-slate-50" data-testid={`law-card-${i}`}>
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-slate-900">{law.ipc_section} - {law.title}</h4>
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">{Math.round(law.relevance_score * 100)}%</span>
                    </div>
                    <p className="text-sm text-slate-600">{law.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Similar Cases */}
          {analysisResult?.similar_cases?.length > 0 && (
            <div data-testid="similar-cases">
              <h3 className="text-sm font-mono uppercase tracking-wider text-slate-500 mb-3">Similar Past Cases</h3>
              <div className="space-y-3">
                {analysisResult.similar_cases.map((c, i) => (
                  <div key={i} className="border border-blue-200 rounded-xl p-5 bg-blue-50" data-testid={`case-card-${i}`}>
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-slate-900">{c.title}</h4>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{Math.round(c.relevance_score * 100)}%</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{c.citation} | {c.court} | {c.year}</p>
                    <p className="text-sm text-slate-600 mb-2">{c.summary}</p>
                    <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                      <ExternalLink className="w-3 h-3" /> View Full Judgment
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legal Analysis */}
          {analysisResult?.analysis && (
            <div data-testid="ai-analysis">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-mono uppercase tracking-wider text-slate-500">Legal Analysis</h3>
                {/* Translation */}
                <div className="flex items-center gap-2">
                  <select
                    className="text-xs border border-slate-200 rounded px-2 py-1 bg-white"
                    onChange={(e) => { if (e.target.value) handleTranslate(analysisResult.analysis, e.target.value); }}
                    data-testid="translate-select"
                    defaultValue=""
                  >
                    <option value="">Translate to...</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Tamil">Tamil</option>
                    <option value="Malayalam">Malayalam</option>
                    <option value="Bengali">Bengali</option>
                    <option value="Telugu">Telugu</option>
                    <option value="Marathi">Marathi</option>
                  </select>
                  {translating && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{analysisResult.analysis}</div>
              </div>
              {translatedText && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-6" data-testid="translated-analysis">
                  <p className="text-xs font-medium text-blue-700 mb-2">Translation ({translateLang})</p>
                  <div className="text-sm text-blue-900 leading-relaxed whitespace-pre-line">{translatedText}</div>
                </div>
              )}
            </div>
          )}

          {/* Matched Lawyers */}
          {analysisResult?.matched_lawyers?.length > 0 && (
            <div data-testid="matched-lawyers">
              <h3 className="text-sm font-mono uppercase tracking-wider text-slate-500 mb-3">Recommended Lawyers</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {analysisResult.matched_lawyers.map((lawyer, i) => (
                  <div key={i} className="border border-slate-200 rounded-xl p-5 bg-white" data-testid={`lawyer-card-${i}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                        <Award className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{lawyer.name}</p>
                        <div className="flex items-center gap-1 text-xs text-amber-600">
                          <Star className="w-3 h-3 fill-current" />
                          {lawyer.rating?.toFixed(1)}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mb-1">{lawyer.specialization} Law</p>
                    <div className="flex items-center gap-1 text-xs text-slate-400 mb-3">
                      <MapPin className="w-3 h-3" /> {lawyer.location}
                    </div>
                    <div className="space-y-2">
                      <button
                        onClick={() => handleConnect(lawyer)}
                        disabled={connectingLawyer === lawyer.id}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                        data-testid={`connect-lawyer-${i}`}
                      >
                        {connectingLawyer === lawyer.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <><Phone className="w-3 h-3" /> Connect</>
                        )}
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const { data } = await axios.post(`${API_URL}/api/payments/create-checkout`, {
                              package_id: 'standard',
                              lawyer_id: lawyer.id,
                              origin_url: window.location.origin
                            }, {  });
                            window.location.href = data.url;
                          } catch (err) {
                            toast.error(err.response?.data?.detail || 'Failed to start payment');
                          }
                        }}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"
                        data-testid={`book-lawyer-${i}`}
                      >
                        <CreditCard className="w-3 h-3" /> Book Consultation ($49)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stamp Paper Diagnostic */}
          <div>
            <button
              onClick={() => setShowStampDiagnostic(!showStampDiagnostic)}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 font-medium"
              data-testid="toggle-stamp-diagnostic"
            >
              <Stamp className="w-4 h-4" />
              {showStampDiagnostic ? 'Hide' : 'Show'} Stamp Paper Diagnostic
            </button>
            {showStampDiagnostic && (
              <StampPaperDiagnosticWidget
                onDiagnose={handleStampDiagnostic}
                result={stampResult}
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={resetAll}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-3 rounded-lg transition-colors"
              data-testid="start-new-btn"
            >
              Start New
            </button>
            <button
              onClick={generateNyayID}
              disabled={loadingNyayID}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="generate-nyayid-btn"
            >
              {loadingNyayID ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><Shield className="w-4 h-4" /> Generate NyayID</>
              )}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );

  // ─── PHASE: NYAYID ───
  const renderNyayIDPhase = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-8"
      data-testid="phase-nyayid"
    >
      <NyayIDCard nyayData={nyayData} />

      <div className="mt-6 flex gap-3">
        <button
          onClick={handleSaveCase}
          disabled={savingCase || !user}
          className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          data-testid="save-case-btn"
        >
          {savingCase ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
          {user ? 'Save to My Cases' : 'Login to Save'}
        </button>
        <button
          onClick={resetAll}
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-3 rounded-lg transition-colors"
          data-testid="new-analysis-btn"
        >
          New Analysis
        </button>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--theme-bg)', isolation: 'isolate' }} data-testid="client-home-page">
      <div aria-hidden="true" className="page-gold-pattern" style={{ position: 'fixed', inset: 0, zIndex: -1, backgroundImage: `url(${process.env.PUBLIC_URL}/gold-pattern.png)`, backgroundRepeat: 'repeat', backgroundSize: '320px 320px', opacity: 0.18, pointerEvents: 'none' }} />
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Left Panel */}
          <div className="lg:col-span-2 lg:sticky lg:top-24 lg:self-start">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <Scale className="w-10 h-10 text-slate-800 mb-4" />
              <h1 className="font-heading text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-4 leading-tight">
                Legal Intelligence Engine
              </h1>
              <p className="text-base text-slate-600 leading-relaxed mb-8">
                Legal analysis with guided decision tree, document OCR, risk assessment, and NyayID generation.
              </p>

              <div className="space-y-4">
                {[
                  { icon: Brain, title: 'Keyword Detection', desc: 'Legal category identification' },
                  { icon: MessageSquare, title: 'Guided Questions', desc: 'Dynamic decision tree for your case type' },
                  { icon: FileText, title: 'Document OCR', desc: 'Upload and extract text from documents' },
                  { icon: Shield, title: 'NyayID Report', desc: 'Unique case profile with PDF export' },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * i }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-9 h-9 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">{item.title}</h3>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right Panel - Intelligence Flow */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden relative z-[1]" data-testid="intelligence-panel">
              {renderProgressBar()}
              <AnimatePresence mode="wait">
                {phase === PHASES.DESCRIBE && renderDescribePhase()}
                {phase === PHASES.ANALYZE && renderAnalyzePhase()}
                {phase === PHASES.QUESTIONS && renderQuestionsPhase()}
                {phase === PHASES.RESULTS && renderResultsPhase()}
                {phase === PHASES.NYAYID && renderNyayIDPhase()}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Stamp Paper Diagnostic Widget ───
const StampPaperDiagnosticWidget = ({ onDiagnose, result }) => {
  const [inputs, setInputs] = useState({
    is_court_case: false,
    is_court_fee: false,
    is_agreement: false,
    is_affidavit: false,
    is_petition: false,
  });

  return (
    <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-5" data-testid="stamp-diagnostic-widget">
      <h4 className="text-sm font-semibold text-slate-800 mb-3">Stamp Paper Diagnostic</h4>
      <div className="space-y-2 mb-4">
        {[
          { key: 'is_court_case', label: 'Is this a court case?' },
          { key: 'is_court_fee', label: 'Does it involve court fees?' },
          { key: 'is_agreement', label: 'Is it an agreement/contract?' },
          { key: 'is_affidavit', label: 'Is it an affidavit?' },
          { key: 'is_petition', label: 'Is it a petition?' },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={inputs[key]}
              onChange={(e) => setInputs({ ...inputs, [key]: e.target.checked })}
              className="rounded border-slate-300"
              data-testid={`stamp-${key}`}
            />
            {label}
          </label>
        ))}
      </div>
      <button
        onClick={() => onDiagnose(inputs)}
        className="bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
        data-testid="diagnose-stamp-btn"
      >
        Diagnose
      </button>
      {result && (
        <div className="mt-3 bg-white border border-slate-200 rounded-lg p-4" data-testid="stamp-result">
          <p className="text-sm font-semibold text-slate-800">{result.stamp_paper_type}</p>
          <p className="text-xs text-slate-600 mt-1">{result.reasoning}</p>
          <p className="text-xs text-slate-400 mt-1">{result.additional_info}</p>
        </div>
      )}
    </div>
  );
};

export default ClientHome;
