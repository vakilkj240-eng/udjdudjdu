# Gavel & Brief — AI-Powered Legal Intelligence Platform

## Project Overview
Gavel & Brief is an AI-powered legal platform for India. It provides automated legal case analysis, matches users with relevant IPC laws and past court cases, generates unique "NyayID" case reports, and connects clients with lawyers.

## Architecture

```
gavel-brief/
├── backend/      FastAPI Python API (port 8000)
├── frontend/     React + Vite client app (port 5000)
└── admin/        React + TypeScript admin dashboard (port 3001)
```

### Frontend (React + Vite)
- **Location**: `frontend/`
- **Port**: 5000
- **Tech**: React 19, Tailwind CSS, Radix UI, Framer Motion, Three.js, Axios
- **Entry Point**: `src/index.js`
- **API**: Proxied via Vite to `http://localhost:8000`

### Backend (FastAPI + Python)
- **Location**: `backend/`
- **Port**: 8000
- **Tech**: FastAPI, Motor (MongoDB), scikit-learn TF-IDF, PyJWT, bcrypt
- **Entry Point**: `server.py`
- **Database**: MongoDB Atlas

### Admin Dashboard (React + TypeScript)
- **Location**: `admin/`
- **Port**: 3001
- **Tech**: React 18, TypeScript, Vite, Tailwind CSS

## Workflows
- **Start application**: `cd frontend && npx vite --host 0.0.0.0 --port 5000`
- **Backend API**: `cd backend && uvicorn server:app --host 0.0.0.0 --port 8000`
- **Admin Dashboard**: `cd admin && npx vite --host 0.0.0.0 --port 3001`

## Key Features
- Legal Intelligence Engine: 5-step AI case intake flow
- RAG Analysis: TF-IDF similarity matching against IPC laws/cases
- NyayID: Unique case profile and PDF report generation
- Affidavit Builder: AI-powered legal document drafting
- Lawyer Matching & Booking: Calendar-based appointment system
- Legal Writer Portal: Draft articles and earn credits
- Multi-language: All 22 Indian languages supported

## Environment Variables (set in Replit Secrets)
- `MONGO_URL`: MongoDB Atlas connection string
- `JWT_SECRET`: JWT signing secret
- `OPENAI_API_KEY`: OpenAI key for AI features
- `GROQ_API_KEY`: Groq API key (free OpenAI alternative)
- `ADMIN_EMAIL`: Admin dashboard login email
- `ADMIN_PASSWORD`: Admin dashboard login password

## Test Credentials
- Client: client@test.com / password123
- Lawyer: lawyer@test.com / password123

## Important Notes
- Criminal category cases: "Handle Yourself" and "In Person" meeting options are intentionally hidden
- Backend startup is non-blocking — DB seeding runs in background
- CORS allows all origins for development

## User Preferences
- Keep criminal case restrictions: no "Handle Yourself" or "In Person" options for Criminal category
