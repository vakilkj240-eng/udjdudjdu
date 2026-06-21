import React, { createContext, useContext, useState, useCallback } from 'react';

const INDIAN_LANGUAGES = [
  { code: 'en',        label: 'English',   nativeLabel: 'English' },
  { code: 'hi',        label: 'Hindi',     nativeLabel: 'हिन्दी' },
  { code: 'bn',        label: 'Bengali',   nativeLabel: 'বাংলা' },
  { code: 'te',        label: 'Telugu',    nativeLabel: 'తెలుగు' },
  { code: 'mr',        label: 'Marathi',   nativeLabel: 'मराठी' },
  { code: 'ta',        label: 'Tamil',     nativeLabel: 'தமிழ்' },
  { code: 'gu',        label: 'Gujarati',  nativeLabel: 'ગુજરાતી' },
  { code: 'kn',        label: 'Kannada',   nativeLabel: 'ಕನ್ನಡ' },
  { code: 'ml',        label: 'Malayalam', nativeLabel: 'മലയാളം' },
  { code: 'pa',        label: 'Punjabi',   nativeLabel: 'ਪੰਜਾਬੀ' },
  { code: 'or',        label: 'Odia',      nativeLabel: 'ଓଡ଼ିଆ' },
  { code: 'as',        label: 'Assamese',  nativeLabel: 'অসমীয়া' },
  { code: 'ur',        label: 'Urdu',      nativeLabel: 'اردو' },
  { code: 'sa',        label: 'Sanskrit',  nativeLabel: 'संस्कृतम्' },
  { code: 'ne',        label: 'Nepali',    nativeLabel: 'नेपाली' },
  { code: 'sd',        label: 'Sindhi',    nativeLabel: 'سنڌي' },
  { code: 'ks',        label: 'Kashmiri',  nativeLabel: 'کٲشُر' },
  { code: 'mai',       label: 'Maithili',  nativeLabel: 'मैथिली' },
  { code: 'gom',       label: 'Konkani',   nativeLabel: 'कोंकणी' },
  { code: 'mni-Mtei',  label: 'Manipuri',  nativeLabel: 'ꯃꯩꯇꯩꯂꯣꯟ' },
  { code: 'sat-Latn',  label: 'Santali',   nativeLabel: 'ᱥᱟᱱᱛᱟᱲᱤ' },
  { code: 'doi',       label: 'Dogri',     nativeLabel: 'डोगरी' },
  { code: 'brx',       label: 'Bodo',      nativeLabel: 'बर\u200dआ' },
];

const LanguageContext = createContext({
  language: 'en',
  languages: INDIAN_LANGUAGES,
  setLanguage: () => {},
  currentLang: INDIAN_LANGUAGES[0],
});

export const useLanguage = () => useContext(LanguageContext);

/* ─── Cookie helpers ─── */
function setGoogTransCookie(langCode) {
  const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  const val = langCode === 'en' ? '' : `/en/${langCode}`;
  // Set on root path
  document.cookie = `googtrans=${val}; expires=${expiry}; path=/`;
  // Also set for subdomain (required by Google Translate)
  try {
    document.cookie = `googtrans=${val}; expires=${expiry}; path=/; domain=.${window.location.hostname}`;
  } catch (_) {}
}

function clearGoogTransCookie() {
  const past = 'Thu, 01 Jan 1970 00:00:01 GMT';
  document.cookie = `googtrans=; expires=${past}; path=/`;
  try {
    document.cookie = `googtrans=; expires=${past}; path=/; domain=.${window.location.hostname}`;
  } catch (_) {}
}

/* ─── Read current cookie ─── */
function readGoogTransCookie() {
  const match = document.cookie.match(/(^|;)\s*googtrans=([^;]+)/);
  return match ? match[2] : '';
}

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('vakilsetu_lang') || 'en';
  });

  const currentLang =
    INDIAN_LANGUAGES.find(l => l.code === language) || INDIAN_LANGUAGES[0];

  const setLanguage = useCallback((code) => {
    if (code === language) return;

    localStorage.setItem('vakilsetu_lang', code);
    // Mark that the coming reload is a translation reload — skip preloader
    sessionStorage.setItem('skipPreloader', '1');

    if (code === 'en') {
      clearGoogTransCookie();
    } else {
      setGoogTransCookie(code);
    }

    // Reload so Google Translate applies the cookie to the whole document
    window.location.reload();
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, languages: INDIAN_LANGUAGES, setLanguage, currentLang }}>
      {children}
    </LanguageContext.Provider>
  );
};

export { INDIAN_LANGUAGES };
