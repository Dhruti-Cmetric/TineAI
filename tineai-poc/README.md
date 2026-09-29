# TINE AI Data Platform — POC

A full-stack proof-of-concept demo for the TINE AI African Data Platform.

## Tech Stack
- **Backend**: Python / FastAPI + SQLAlchemy + PostgreSQL
- **Frontend**: React + Vite
- **AI Enrichment**: OpenAI Whisper (with realistic mock fallback)
- **Deployment**: Docker Compose (local) / Railway-ready

## Demo Accounts
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@tineai.com | admin123 |
| Supplier | supplier@tineai.com | supplier123 |
| Client | client@aichina.ai | client123 |

## Quick Start (Docker)

```bash
cd tineai-poc
docker-compose up --build
```

Then open: http://localhost:3000

## Local Dev

### Backend
```bash
cd tineai-poc/backend
pip install -r requirements.txt
# Start PostgreSQL, then:
python seed.py           # seed demo data
uvicorn app.main:app --reload
# API at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### Frontend
```bash
cd tineai-poc/frontend
npm install
npm run dev
# App at http://localhost:3000
```

## Demo Walkthrough (10–15 min)

1. **Login as Admin** → Dashboard shows African language dataset stats and activity
2. **Datasets** → Browse 6 seeded datasets (Yoruba, Swahili, Cameroonian French, Amharic, Zulu, Hausa)
3. **Upload** → Submit a new dataset with metadata (language, dialect, cultural context)
4. **Dataset Detail** → Click "Start Processing" → "Run AI Enrichment" — watch transcription appear
5. **Approve** → Move dataset to Approved; the reject flow with reason is also demoed
6. **Assignments** → Assign approved dataset to client Dr. Sarah Chen on project "Lagos Speech Recognition V2"
7. **Login as Client** → Client Portal shows only authorized datasets; navigate to API Access
8. **API Key** → Generate key → Test live API call returning dataset metadata
9. **Audit Log** → Every action above is logged with actor, role, action, timestamp

## POC Scope (per Build Guide)
- ✅ Admin login & dashboard
- ✅ Supplier upload flow with metadata
- ✅ Data Card (language, region, dialect, rights, quality)
- ✅ Dataset lifecycle state machine (uploaded → processing → under_review → approved)
- ✅ AI enrichment demo (Whisper + realistic mock output for 5 African languages)
- ✅ Admin approval/rejection with reason & audit trail
- ✅ Client portal (scoped to assigned datasets only)
- ✅ API key issuance + live authenticated endpoint
- ✅ Audit log with filtering by action type

## Railway Deployment
1. Push to GitHub
2. New Railway project → Add PostgreSQL service
3. Deploy backend: set `DATABASE_URL` from Railway PostgreSQL
4. Deploy frontend: set `VITE_API_URL` if needed
