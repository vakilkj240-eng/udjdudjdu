import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Scale, User, LogOut, FileText, BookOpen, ChevronDown, Globe, Moon, Sun, Users, Calendar, Briefcase } from 'lucide-react';
import { AnimatePresence, motion, useScroll } from 'framer-motion';
import NotificationBell from './NotificationBell';

const Navbar = ({ noSpacer = false }) => {
  const { user, logout } = useAuth();
  const { language, languages, setLanguage, currentLang } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  const langRef = useRef(null);

  useEffect(() => {
    return scrollY.on('change', (latest) => setScrolled(latest > 50));
  }, [scrollY]);

  useEffect(() => {
    const handleClick = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    navigate('/');
  };

  const quickLinks =
    user?.role === 'client' ? [
      { to: '/client/dashboard', icon: Scale, label: 'Intelligence' },
      { to: '/client/lawyers', icon: Users, label: 'Find Lawyers' },
      { to: '/client/affidavit', icon: FileText, label: 'Affidavit' },
      { to: '/client/cases', icon: BookOpen, label: 'My Cases' },
    ] :
    user?.role === 'lawyer' ? [
      { to: '/lawyer/dashboard', icon: Scale, label: 'Dashboard' },
      { to: '/client/consultations', icon: Calendar, label: 'Consultations' },
    ] :
    user?.role === 'legal_writer' ? [
      { to: '/writer/dashboard', icon: Briefcase, label: 'Dashboard' },
    ] : [];

  const isActive = (to) => location.pathname === to;

  const activeColor = isDark ? '#D4AF37' : '#7C1D2B';
  const linkColor = isDark ? '#c0c0c0' : '#111111';
  const surfaceBg = isDark ? '#1a1a1a' : '#ffffff';
  const dropdownBg = isDark ? '#141414' : '#ffffff';
  const dropdownBorder = isDark ? 'rgba(255,255,255,0.1)' : '#E5E5E5';
  const dropdownShadow = isDark ? '0 25px 50px rgba(0,0,0,0.6)' : '0 25px 50px rgba(124,29,43,0.15)';

  return (<>
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-6 md:px-12 py-4 flex items-center justify-between ${
        scrolled ? 'backdrop-blur-md border-b shadow-sm' : 'bg-transparent'
      }`}
      style={{
        background: scrolled ? (isDark ? 'rgba(8,8,8,0.94)' : 'rgba(255,253,247,0.88)') : 'transparent',
        borderColor: scrolled ? (isDark ? 'rgba(212,175,55,0.12)' : 'rgba(229,229,229,0.5)') : 'transparent',
      }}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      data-testid="navbar"
    >
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')} data-testid="navbar-logo">
        <img src="/logo-circular.png" alt="Gavel & Brief" className="w-9 h-9 object-contain" />
        <span className="font-serif text-lg font-bold tracking-tight" style={{ color: isDark ? '#e8e8e8' : 'var(--theme-fg)' }}>
          Gavel &amp; Brief
        </span>
      </div>

      <div className="hidden md:flex items-center gap-8">
        <Link
          to="/services"
          className="text-sm font-medium transition-colors duration-200"
          style={{ color: isActive('/services') ? activeColor : linkColor, fontWeight: isActive('/services') ? 700 : 500 }}
          data-testid="navbar-services"
        >
          Services
        </Link>
        {user && quickLinks.map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors duration-200"
            style={{ color: isActive(to) ? activeColor : linkColor, fontWeight: isActive(to) ? 700 : 500 }}>
            <Icon className="w-3.5 h-3.5" style={{ color: isActive(to) ? activeColor : linkColor }} />
            {label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-9 h-9 rounded-xl border transition-all hover:scale-105"
          style={{
            background: surfaceBg,
            borderColor: isDark ? 'rgba(212,175,55,0.3)' : '#E5E5E5',
            color: isDark ? '#D4AF37' : '#555',
          }}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          data-testid="theme-toggle"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Language Selector */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl border transition-all text-sm"
            style={{ background: surfaceBg, borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E5E5E5', color: linkColor }}
            title="Select Language"
          >
            <Globe className="w-4 h-4" style={{ color: isDark ? '#9a9a9a' : '#555' }} />
            <span className="hidden sm:block font-medium text-xs max-w-[80px] truncate">
              {currentLang.nativeLabel}
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${langOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {langOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.18 }}
                className="absolute right-0 top-12 w-56 rounded-2xl border z-50 overflow-hidden"
                style={{ background: dropdownBg, borderColor: dropdownBorder, boxShadow: dropdownShadow }}
              >
                <div className="px-4 py-2.5 border-b" style={{ borderColor: dropdownBorder, background: isDark ? '#1a1a1a' : 'var(--theme-bg)' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: isDark ? '#666' : 'rgba(23,23,23,0.4)' }}>Select Language</p>
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => { setLanguage(lang.code); setLangOpen(false); }}
                      className="w-full flex items-center justify-between px-4 py-2 text-sm transition-colors"
                      style={{
                        color: language === lang.code ? activeColor : (isDark ? '#c0c0c0' : 'rgba(23,23,23,0.7)'),
                        fontWeight: language === lang.code ? 600 : 400,
                        background: 'transparent',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f8f8f8'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span>{lang.label}</span>
                      <span className="text-xs" style={{ color: isDark ? '#555' : 'rgba(23,23,23,0.3)' }}>{lang.nativeLabel}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {langOpen && <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />}
        </div>

        {user && <NotificationBell />}
        {!user ? (
          <Link to="/login" data-testid="navbar-login-button">
            <button
              className="px-5 py-2 rounded-sm font-medium text-sm transition-all duration-300 hover:opacity-90 hover:shadow-lg"
              style={{ background: activeColor, color: isDark ? '#0d0d0d' : '#ffffff' }}
            >
              Login
            </button>
          </Link>
        ) : (
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 h-9 px-3 rounded-xl border transition-all text-sm"
              style={{ background: surfaceBg, borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E5E5E5', color: isDark ? '#c0c0c0' : 'rgba(23,23,23,0.7)' }}
              data-testid="navbar-user-menu"
            >
              <User className="w-4 h-4" style={{ color: activeColor }} />
              <span className="hidden sm:block font-medium max-w-[120px] truncate">{user.name}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="absolute right-0 top-12 w-52 rounded-2xl border z-50 overflow-hidden"
                  style={{ background: dropdownBg, borderColor: dropdownBorder, boxShadow: dropdownShadow }}
                >
                  <div className="px-4 py-3 border-b" style={{ borderColor: dropdownBorder, background: isDark ? '#1a1a1a' : 'var(--theme-bg)' }}>
                    <p className="text-xs uppercase tracking-wider font-semibold mb-0.5" style={{ color: isDark ? '#555' : 'rgba(23,23,23,0.4)' }}>Signed in as</p>
                    <p className="text-sm font-semibold truncate" style={{ color: isDark ? '#e8e8e8' : '#171717' }}>{user.name}</p>
                    <p className="text-xs capitalize" style={{ color: isDark ? '#666' : 'rgba(23,23,23,0.3)' }}>{user.role?.replace('_', ' ')}</p>
                  </div>
                  {quickLinks.length > 0 && (
                    <div className="py-1.5 md:hidden border-b" style={{ borderColor: dropdownBorder }}>
                      {quickLinks.map(({ to, icon: Icon, label }) => (
                        <Link key={to} to={to} onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                          style={{ color: isActive(to) ? activeColor : (isDark ? '#c0c0c0' : 'rgba(23,23,23,0.7)') }}
                          onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f8f8f8'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: isActive(to) ? `${activeColor}20` : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') }}>
                            <Icon className="w-3.5 h-3.5" style={{ color: isActive(to) ? activeColor : (isDark ? '#888' : '#333') }} />
                          </span>{label}
                        </Link>
                      ))}
                    </div>
                  )}
                  <div className="py-1.5">
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 transition-colors group"
                      style={{ background: 'transparent' }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(220,38,38,0.12)' : '#FFF5F5'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      data-testid="navbar-logout-button"
                    >
                      <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: isDark ? 'rgba(220,38,38,0.15)' : '#FEE2E2' }}>
                        <LogOut className="w-3.5 h-3.5" />
                      </span>Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {profileOpen && <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />}
          </div>
        )}
      </div>
    </motion.nav>
    {!noSpacer && <div aria-hidden="true" className="h-[72px]" />}
  </>
  );
};

export default Navbar;
