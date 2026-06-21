import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import Lenis from '@studio-freight/lenis';
import ChatWidget from './components/ChatWidget';
import StatusWatcher from './components/StatusWatcher';
import DigestWatcher from './components/DigestWatcher';
import SurveyModal from './components/SurveyModal';
import Preloader from './components/Preloader';
import CaseDetailPage from './pages/CaseDetailPage';

import Home from './pages/Home';
import Services from './pages/Services';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ClientHome from './pages/ClientHome';
import MyCases from './pages/MyCases';
import AffidavitBuilder from './pages/AffidavitBuilder';
import Consultations from './pages/Consultations';
import PaymentSuccess from './pages/PaymentSuccess';
import VideoRoom from './pages/VideoRoom';
import LawyerDashboard from './pages/LawyerDashboard';
import FindLawyers from './pages/FindLawyers';
import LawyerBooking from './pages/LawyerBooking';
import MyBookings from './pages/MyBookings';
import Firms from './pages/Firms';
import MultiStepCaseForm from './pages/MultiStepCaseForm';
import IPCBrowser from './pages/IPCBrowser';
import PartyInPerson from './pages/PartyInPerson';
import ContentWriterDashboard from './pages/ContentWriterDashboard';
import CaseStatusPage from './pages/CaseStatusPage';
import './App.css';

const ProtectedRoute = ({ children, allowedRole }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--theme-bg)' }}>
      <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--theme-primary)' }} />
    </div>
  );
  if (!user) return <Navigate to="/login" />;
  if (allowedRole && user.role !== allowedRole) return <Navigate to="/" />;
  return children;
};

const PageShell = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    exit={{ opacity: 0, y: -14, filter: 'blur(3px)', scale: 0.995 }}
    transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
    style={{ willChange: 'opacity, transform, filter' }}
  >
    {children}
  </motion.div>
);

function AppContent() {
  const location = useLocation();
  return (
    <>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageShell><Home /></PageShell>} />
          <Route path="/services" element={<PageShell><Services /></PageShell>} />
          <Route path="/login" element={<PageShell><Login /></PageShell>} />
          <Route path="/register" element={<PageShell><Register /></PageShell>} />
          <Route path="/forgot-password" element={<PageShell><ForgotPassword /></PageShell>} />
          <Route path="/reset-password" element={<PageShell><ResetPassword /></PageShell>} />
          <Route path="/client/dashboard" element={<ProtectedRoute allowedRole="client"><PageShell><ClientHome /></PageShell></ProtectedRoute>} />
          <Route path="/client/cases" element={<ProtectedRoute allowedRole="client"><PageShell><MyCases /></PageShell></ProtectedRoute>} />
          <Route path="/client/cases/:caseId" element={<ProtectedRoute allowedRole="client"><PageShell><CaseDetailPage /></PageShell></ProtectedRoute>} />
          <Route path="/lawyer/cases/:caseId" element={<ProtectedRoute allowedRole="lawyer"><PageShell><CaseDetailPage /></PageShell></ProtectedRoute>} />
          <Route path="/client/affidavit" element={<ProtectedRoute allowedRole="client"><PageShell><AffidavitBuilder /></PageShell></ProtectedRoute>} />
          <Route path="/client/consultations" element={<ProtectedRoute><PageShell><Consultations /></PageShell></ProtectedRoute>} />
          <Route path="/client/payment-success" element={<ProtectedRoute allowedRole="client"><PageShell><PaymentSuccess /></PageShell></ProtectedRoute>} />
          <Route path="/video/:roomId" element={<ProtectedRoute><PageShell><VideoRoom /></PageShell></ProtectedRoute>} />
          <Route path="/lawyer/dashboard" element={<ProtectedRoute allowedRole="lawyer"><PageShell><LawyerDashboard /></PageShell></ProtectedRoute>} />
          <Route path="/client/lawyers" element={<ProtectedRoute allowedRole="client"><PageShell><FindLawyers /></PageShell></ProtectedRoute>} />
          <Route path="/client/lawyers/:lawyerId" element={<ProtectedRoute allowedRole="client"><PageShell><LawyerBooking /></PageShell></ProtectedRoute>} />
          <Route path="/client/bookings" element={<ProtectedRoute allowedRole="client"><PageShell><MyBookings /></PageShell></ProtectedRoute>} />
          <Route path="/firms" element={<ProtectedRoute><PageShell><Firms /></PageShell></ProtectedRoute>} />
          <Route path="/client/case/new" element={<ProtectedRoute allowedRole="client"><PageShell><MultiStepCaseForm /></PageShell></ProtectedRoute>} />
          <Route path="/ipc" element={<PageShell><IPCBrowser /></PageShell>} />
          <Route path="/client/pip" element={<ProtectedRoute allowedRole="client"><PageShell><PartyInPerson /></PageShell></ProtectedRoute>} />
          <Route path="/writer/dashboard" element={<ProtectedRoute allowedRole="legal_writer"><PageShell><ContentWriterDashboard /></PageShell></ProtectedRoute>} />
          <Route path="/case/:nyayId" element={<PageShell><CaseStatusPage /></PageShell>} />
        </Routes>
      </AnimatePresence>
      <ChatWidget />
      <StatusWatcher />
      <DigestWatcher />
      <SurveyModal />
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: 'transparent', boxShadow: 'none', padding: 0 },
        }}
      />
    </>
  );
}

function AppInner() {
  const { isDark } = useTheme();
  const skipPreloader = sessionStorage.getItem('skipPreloader') === '1';
  const [preloaderDone, setPreloaderDone] = useState(skipPreloader);
  const handlePreloaderDone = useCallback(() => setPreloaderDone(true), []);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => {
        const c4 = (2 * Math.PI) / 4.5;
        return t === 0 ? 0 : t === 1 ? 1
          : Math.pow(2, -8 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
      },
      smoothWheel: true,
      wheelMultiplier: 0.92,
      touchMultiplier: 1.8,
      infinite: false,
    });
    let rafId;
    const raf = (time) => { lenis.raf(time); rafId = requestAnimationFrame(raf); };
    rafId = requestAnimationFrame(raf);
    return () => { cancelAnimationFrame(rafId); lenis.destroy(); };
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        className="page-gold-pattern"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          backgroundImage: `url(${process.env.PUBLIC_URL}/gold-pattern.png)`,
          backgroundRepeat: 'repeat',
          backgroundSize: '320px 320px',
          opacity: isDark ? 0.55 : 0.28,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
      <LanguageProvider>
        <AuthProvider>
          {!preloaderDone && <Preloader onComplete={handlePreloaderDone} />}
          {preloaderDone && <AppContent />}
        </AuthProvider>
      </LanguageProvider>
    </>
  );
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || '/'}>
      <ThemeProvider>
        <AppInner />
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
