import axios from 'axios';

const now = () => new Date().toISOString();

const demoUsers = {
  'client@test.com': {
    id: 'demo-client-id',
    name: 'Demo Client',
    email: 'client@test.com',
    role: 'client',
    access_token: 'demo-client-token',
  },
  'lawyer@test.com': {
    id: 'demo-lawyer-id',
    name: 'Adv. Meera Rao',
    email: 'lawyer@test.com',
    role: 'lawyer',
    specialization: 'Criminal',
    location: 'Mumbai',
    rating: 4.8,
    access_token: 'demo-lawyer-token',
  },
};

const lawyers = [
  {
    id: 'demo-lawyer-id',
    name: 'Adv. Meera Rao',
    email: 'lawyer@test.com',
    role: 'lawyer',
    specialization: 'Criminal',
    location: 'Mumbai',
    rating: 4.8,
    consultation_fee: 2500,
    experience_years: 12,
    languages: ['English', 'Hindi', 'Marathi'],
    cases_handled: 340,
    bio: 'Senior criminal defense attorney with deep courtroom and strategy experience.',
  },
  {
    id: 'demo-lawyer-2',
    name: 'Adv. Arjun Menon',
    email: 'arjun@example.com',
    role: 'lawyer',
    specialization: 'Property',
    location: 'Bengaluru',
    rating: 4.7,
    consultation_fee: 2200,
    experience_years: 9,
    languages: ['English', 'Hindi', 'Kannada'],
    cases_handled: 185,
    bio: 'Property and real-estate lawyer handling tenancy, title, and RERA matters.',
  },
];

const baseCase = {
  id: 'demo-case-1',
  user_id: 'demo-client-id',
  case_type: 'Property',
  description: 'Landlord is refusing to return the security deposit despite a documented handover and no pending dues.',
  caseDescription: 'Landlord is refusing to return the security deposit despite a documented handover and no pending dues.',
  location: 'Mumbai',
  urgency: 'Medium',
  budget: '₹25,000 - ₹50,000',
  status: 'accepted',
  case_status: 'in_progress',
  nyayId: 'NY-2026-1842',
  nyay_id: 'NY-2026-1842',
  created_at: now(),
  lawyer_id: 'demo-lawyer-id',
  lawyer_name: 'Adv. Meera Rao',
  client_name: 'Demo Client',
  status_history: [
    { status: 'submitted', notes: 'Case submitted by client', updated_by: 'Demo Client', timestamp: now() },
    { status: 'accepted', notes: 'Lawyer accepted case', updated_by: 'Adv. Meera Rao', timestamp: now() },
    { status: 'in_progress', notes: 'Document review started', updated_by: 'Adv. Meera Rao', timestamp: now() },
  ],
  classification: { type: 'Non-Criminal', domain: 'Non-Judicial', category: 'Tenant', flags: { adrSuggested: true } },
};

const secondCase = {
  ...baseCase,
  id: 'demo-case-2',
  case_type: 'Employment',
  description: 'Employer withheld final salary and experience letter after resignation.',
  caseDescription: 'Employer withheld final salary and experience letter after resignation.',
  urgency: 'High',
  budget: '₹10,000 - ₹25,000',
  status: 'open',
  case_status: 'open',
  nyayId: 'NY-2026-2975',
  nyay_id: 'NY-2026-2975',
  lawyer_id: null,
  lawyer_name: null,
  classification: { type: 'Non-Criminal', domain: 'Non-Judicial', category: 'General', flags: {} },
};

const defaultNotes = [
  {
    id: 'demo-note-1',
    case_id: 'demo-case-1',
    content: 'Collect rent agreement, handover photos, deposit receipt, and WhatsApp messages before the next review.',
    pinned: true,
    priority: 'High',
    tags: ['documents', 'strategy'],
    author_id: 'demo-lawyer-id',
    author_name: 'Adv. Meera Rao',
    author_role: 'lawyer',
    created_at: now(),
    updated_at: now(),
  },
];

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') || fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function currentUser() {
  return readJson('user', demoUsers['client@test.com']);
}

function notesStore() {
  const notes = readJson('demo_case_notes', null);
  if (notes) return notes;
  writeJson('demo_case_notes', defaultNotes);
  return defaultNotes;
}

function parseBody(data) {
  if (!data) return {};
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return {}; }
  }
  return data;
}

function makeResponse(config, data, status = 200) {
  return {
    data,
    status,
    statusText: 'OK',
    headers: {},
    config,
    request: {},
  };
}

function getPath(url = '') {
  try {
    return new URL(url, window.location.origin).pathname.replace(/^\/api/, '');
  } catch {
    return String(url).replace(/^\/api/, '');
  }
}

function caseForRole(role) {
  if (role === 'lawyer') return [{ ...baseCase, status: 'in_progress' }];
  return [baseCase, secondCase];
}

function mockData(config) {
  const method = (config.method || 'get').toLowerCase();
  const path = getPath(config.url);
  const body = parseBody(config.data);
  const user = currentUser();

  if (path === '/auth/login' && method === 'post') {
    const demo = demoUsers[body.email] || demoUsers['client@test.com'];
    return demo;
  }
  if (path === '/auth/register' && method === 'post') {
    return {
      id: `demo-${body.role || 'client'}-${Date.now()}`,
      name: body.name || 'Gavel & Brief User',
      email: body.email || 'user@example.com',
      role: body.role || 'client',
      specialization: body.specialization,
      location: body.location,
      access_token: 'demo-register-token',
    };
  }
  if (path === '/auth/me') return user;
  if (path === '/my-cases') return caseForRole('client');
  if (path === '/cases' && method === 'get') return [secondCase, baseCase];
  if (path === '/lawyer/dashboard') return caseForRole('lawyer');
  if (path === '/lawyer/performance') {
    return {
      total_cases: 12,
      this_month_cases: 3,
      completed_cases: 8,
      avg_rating: 4.8,
      total_reviews: 24,
      avg_response_hrs: 1.5,
      est_earnings: 185000,
      weekly_activity: [{ label: 'W1', count: 2 }, { label: 'W2', count: 4 }, { label: 'W3', count: 3 }, { label: 'W4', count: 3 }],
      status_breakdown: { in_progress: 3, completed: 8, awaiting_documents: 1 },
      case_type_breakdown: { Criminal: 5, Property: 4, Employment: 3 },
      recent_reviews: [{ client_name: 'Demo Client', rating: 5, comment: 'Clear, timely, and strategic.', created_at: now() }],
    };
  }
  if (path.match(/^\/cases\/[^/]+\/status$/)) {
    const id = path.split('/')[2];
    const found = [baseCase, secondCase].find(c => c.id === id) || baseCase;
    return {
      case_id: id,
      case_status: found.case_status,
      status_history: found.status_history,
      lawyer_name: found.lawyer_name,
      updated_at: now(),
    };
  }
  if (path.match(/^\/cases\/[^/]+\/documents$/)) return [];
  if (path.match(/^\/cases\/[^/]+\/notes$/)) {
    const caseId = path.split('/')[2];
    if (method === 'get') {
      return notesStore()
        .filter(note => note.case_id === caseId)
        .map(note => ({ ...note, is_mine: note.author_id === user.id }))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned));
    }
    if (method === 'post') {
      const notes = notesStore();
      const note = {
        id: `demo-note-${Date.now()}`,
        case_id: caseId,
        content: body.content,
        pinned: Boolean(body.pinned),
        priority: body.priority || 'Normal',
        tags: body.tags || [],
        author_id: user.id,
        author_name: user.name,
        author_role: user.role,
        created_at: now(),
        updated_at: now(),
        is_mine: true,
      };
      notes.unshift(note);
      writeJson('demo_case_notes', notes);
      return note;
    }
  }
  if (path.match(/^\/notes\/[^/]+$/)) {
    const noteId = path.split('/')[2];
    const notes = notesStore();
    if (method === 'patch') {
      const updated = notes.map(note => note.id === noteId ? { ...note, ...body, updated_at: now() } : note);
      writeJson('demo_case_notes', updated);
      return { ...updated.find(note => note.id === noteId), is_mine: true };
    }
    if (method === 'delete') {
      writeJson('demo_case_notes', notes.filter(note => note.id !== noteId));
      return { message: 'Note deleted' };
    }
  }
  if (path === '/lawyers') return lawyers;
  if (path.match(/^\/lawyers\/[^/]+$/)) return lawyers.find(l => l.id === path.split('/')[2]) || lawyers[0];
  if (path.match(/^\/lawyers\/[^/]+\/slots$/)) return { slots: ['10:00', '12:00', '16:00'], available_days: ['Monday', 'Wednesday', 'Friday'] };
  if (path === '/firms') return [{ id: 'firm-1', name: 'Setu Legal Partners', location: 'Mumbai', lawyers_count: 8 }];
  if (path === '/bookings' || path === '/consultations') return [];
  if (path === '/messages/unread-summary') return { total_unread: 0, per_case: {}, cases: [] };
  if (path.match(/^\/cases\/[^/]+\/messages/)) return { messages: [], case_id: path.split('/')[2], client_id: 'demo-client-id', lawyer_id: 'demo-lawyer-id' };
  if (path === '/notifications') return [];
  if (path === '/survey/pending') return null;
  if (path === '/activity-digest') return { total_cases: 2, highlights: ['Demo workspace ready'], status_changes: [], unread_messages: 0 };
  if (path === '/ipc-laws') return [];
  if (path === '/drafts') return [];
  if (path === '/analyze-case') {
    return {
      relevant_laws: [{ ipc_section: 'Contract Act', title: 'Breach of agreement', description: 'Potential contractual claim.', relevance_score: 0.82 }],
      similar_cases: [],
      analysis: 'Demo legal analysis: preserve documents, create a timeline, and consult a qualified lawyer.',
      case_summary: { type: body.case_type || 'Civil', location: body.location || 'Mumbai' },
      matched_lawyers: lawyers,
    };
  }
  if (path === '/extract-keywords') return { keywords: ['contract', 'evidence'], suggested_category: 'Civil', confidence: 86, reasoning: 'Demo classifier' };
  if (path === '/detect-category') return { category: 'Civil', confidence: 86 };
  if (path === '/get-questions') return { questions: [{ id: 'q1', text: 'Do you have written evidence?', type: 'yes_no' }] };
  if (path === '/risk-analysis') return { risk_level: 'Low', success_probability: 82, case_strength: 'Strong', warnings: [], strengths: ['Documents available'] };
  if (path === '/generate-nyayid') return { nyayId: 'NY-2026-1842', case_profile: baseCase };
  if (path === '/save-case-with-nyayid' || path === '/cases') return { ...baseCase, id: `demo-case-${Date.now()}` };
  if (path.startsWith('/pip/')) return { message: 'Demo PIP workflow ready', case_id: 'demo-case-1', workflow_stage: 0, documentation_status: 'Pending', workflow: { title: 'Consumer Complaint', steps: [] } };

  return {};
}

export function installMockApiFallback() {
  if (window.__vakilMockApiInstalled) return;
  window.__vakilMockApiInstalled = true;

  axios.interceptors.response.use(
    (response) => {
      const url = response.config?.url || '';
      if (url.includes('/api') && typeof response.data === 'string' && response.data.includes('<!doctype html')) {
        return makeResponse(response.config, mockData(response.config));
      }
      return response;
    },
    (error) => {
      const config = error.config || {};
      const url = config.url || '';
      if (url.includes('/api') || url.startsWith('/api')) {
        return Promise.resolve(makeResponse(config, mockData(config)));
      }
      return Promise.reject(error);
    }
  );
}
