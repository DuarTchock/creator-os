# Creator OS

> Unified platform for influencer business management - Brand Deal OS + Inbox Brain

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)

## 🚀 Overview

Creator OS is a SaaS platform designed for mid-tier influencers (10k-500k followers) and small influencer agencies. It combines two powerful tools:

1. **Brand Deal OS** - A sponsorship CRM with Gmail integration that auto-detects brand leads and generates AI-powered pitch drafts.

2. **Inbox Brain** - A DM/comment mining tool that clusters audience questions, objections, and content ideas from IG/YouTube.

## 📋 Features

### MVP1 (Current)
- ✅ User authentication (email + Google OAuth)
- ✅ Brand deal pipeline with Kanban board
- ✅ AI-powered pitch generation
- ✅ Comment import (CSV upload)
- ✅ AI comment clustering
- ✅ Weekly insight briefs
- ✅ Gmail integration (OAuth)

### Coming in MVP2
- 🔄 Deliverables guardrail (task tracking)
- 🔄 Revenue attribution (Stripe/Gumroad)
- 🔄 Calendar sync

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Python + FastAPI |
| **Database** | Supabase (PostgreSQL) |
| **Frontend** | Next.js 14 + React |
| **Styling** | Tailwind CSS |
| **AI** | Groq (Llama 3.1 70B) |
| **Auth** | Supabase Auth |
| **Deployment** | Vercel (FE) + Railway (BE) |

## 📁 Project Structure

```
creator-os/
├── backend/
│   ├── app/
│   │   ├── routers/         # API endpoints
│   │   │   ├── auth.py      # Authentication
│   │   │   ├── deals.py     # Brand deals CRUD
│   │   │   ├── comments.py  # Comments/inbox
│   │   │   ├── insights.py  # Clusters/insights
│   │   │   ├── integrations.py # OAuth flows
│   │   │   └── ai.py        # AI endpoints
│   │   ├── schemas/         # Pydantic models
│   │   └── database.py      # Supabase client
│   ├── main.py              # FastAPI app
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js pages
│   │   ├── components/      # React components
│   │   ├── lib/             # Utilities
│   │   └── hooks/           # Custom hooks
│   ├── package.json
│   └── .env.example
│
└── docs/
    └── project-charter.docx
```

## 🚦 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Supabase account (free tier)
- Groq API key (free tier)

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/creator-os.git
cd creator-os
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema from `backend/app/database.py` (the `SCHEMA_SQL` variable)
3. Copy your project URL and anon key

### 3. Set up the Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env
# Edit .env with your Supabase and Groq credentials

# Run the server
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`
- Docs: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 4. Set up the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run the development server
npm run dev
```

The app will be available at `http://localhost:3000`

## 🔑 Environment Variables

### Backend (.env)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
GROQ_API_KEY=your-groq-api-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 📚 API Documentation

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Deals
- `GET /api/deals` - List deals
- `POST /api/deals` - Create deal
- `GET /api/deals/{id}` - Get deal
- `PATCH /api/deals/{id}` - Update deal
- `DELETE /api/deals/{id}` - Delete deal
- `POST /api/deals/{id}/move` - Move deal status

### Comments
- `GET /api/comments` - List comments
- `POST /api/comments` - Create comment
- `POST /api/comments/bulk` - Bulk create
- `POST /api/comments/upload/csv` - Upload CSV

### AI
- `POST /api/ai/generate-pitch` - Generate pitch
- `POST /api/ai/cluster-comments` - Cluster comments
- `POST /api/ai/generate-brief` - Generate weekly brief

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## 🚀 Deployment

### Backend (Railway)

1. Connect your GitHub repository
2. Set environment variables
3. Deploy

### Frontend (Vercel)

1. Import project from GitHub
2. Set environment variables
3. Deploy

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📞 Support

- 📧 Email: support@creator-os.com
- 💬 Discord: [Join our community](https://discord.gg/creator-os)

---

Built with ❤️ for creators
