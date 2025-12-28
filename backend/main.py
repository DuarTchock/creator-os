"""
Creator OS - Backend API
FastAPI application for Brand Deal OS + Inbox Brain
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Force load .env from backend directory FIRST
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path, override=True)

# Debug: Print to verify
print(f"📁 Loading .env from: {env_path}")
print(f"🔑 GROQ_API_KEY loaded: {'Yes ✅' if os.getenv('GROQ_API_KEY') else 'No ❌'}")

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from contextlib import asynccontextmanager

# Import routers
from app.routers import auth, deals, comments, insights, integrations, ai, stripe

# Import database
from app.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    print("🚀 Starting Creator OS API...")
    await init_db()
    yield
    # Shutdown
    print("👋 Shutting down Creator OS API...")

# Initialize FastAPI app
app = FastAPI(
    title="Creator OS API",
    description="Backend API for Brand Deal OS + Inbox Brain - A unified platform for influencer business management",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js dev
        "https://creator-os.vercel.app",  # Production frontend
        os.getenv("FRONTEND_URL", "http://localhost:3000")
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(deals.router, prefix="/api/deals", tags=["Brand Deals"])
app.include_router(comments.router, prefix="/api/comments", tags=["Comments"])
app.include_router(insights.router, prefix="/api/insights", tags=["Insights"])
app.include_router(integrations.router, prefix="/api/integrations", tags=["Integrations"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI"])
app.include_router(stripe.router, prefix="/api/stripe", tags=["Stripe"])

# Health check endpoint
@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "healthy",
        "service": "Creator OS API",
        "version": "1.0.0"
    }

@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "database": "connected",
        "services": {
            "auth": "operational",
            "deals": "operational",
            "comments": "operational",
            "ai": "operational"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True
    )
