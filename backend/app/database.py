"""
Database configuration and connection management for Supabase
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Initialize Supabase client
supabase: Client = None
supabase_admin: Client = None

async def init_db():
    """Initialize database connections"""
    global supabase, supabase_admin
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("⚠️  Warning: Supabase credentials not configured")
        print("   Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env")
        return
    
    try:
        # Client for authenticated user operations
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Admin client for server-side operations (if service key is available)
        if SUPABASE_SERVICE_KEY:
            supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        
        print("✅ Database connection initialized")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        raise

def get_supabase() -> Client:
    """Get Supabase client for dependency injection"""
    if supabase is None:
        raise Exception("Database not initialized. Call init_db() first.")
    return supabase

def get_supabase_admin() -> Client:
    """Get Supabase admin client for server-side operations"""
    if supabase_admin is None:
        raise Exception("Admin database not initialized. Check SUPABASE_SERVICE_KEY.")
    return supabase_admin


# SQL Schema for Supabase (run this in Supabase SQL Editor)
SCHEMA_SQL = """
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'agency')),
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
    
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Deals table (Brand Deal OS)
CREATE TABLE IF NOT EXISTS public.deals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    brand_name TEXT NOT NULL,
    brand_email TEXT,
    brand_contact TEXT,
    status TEXT DEFAULT 'lead' CHECK (status IN ('lead', 'outreach', 'negotiation', 'closed_won', 'closed_lost')),
    amount DECIMAL(10, 2),
    currency TEXT DEFAULT 'USD',
    category TEXT,
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'gmail', 'instagram', 'other')),
    source_email_id TEXT,
    notes TEXT,
    pitch_draft TEXT,
    deliverables JSONB DEFAULT '[]'::jsonb,
    deadline DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on deals
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Deals policies
CREATE POLICY "Users can view own deals" ON public.deals
    FOR SELECT USING (auth.uid() = user_id);
    
CREATE POLICY "Users can insert own deals" ON public.deals
    FOR INSERT WITH CHECK (auth.uid() = user_id);
    
CREATE POLICY "Users can update own deals" ON public.deals
    FOR UPDATE USING (auth.uid() = user_id);
    
CREATE POLICY "Users can delete own deals" ON public.deals
    FOR DELETE USING (auth.uid() = user_id);

-- Comments table (Inbox Brain)
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'youtube', 'tiktok', 'email', 'other')),
    content TEXT NOT NULL,
    author_name TEXT,
    author_handle TEXT,
    post_url TEXT,
    post_title TEXT,
    sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral', 'question')),
    cluster_id UUID REFERENCES public.clusters(id) ON DELETE SET NULL,
    is_processed BOOLEAN DEFAULT FALSE,
    original_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Comments policies
CREATE POLICY "Users can view own comments" ON public.comments
    FOR SELECT USING (auth.uid() = user_id);
    
CREATE POLICY "Users can insert own comments" ON public.comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);
    
CREATE POLICY "Users can update own comments" ON public.comments
    FOR UPDATE USING (auth.uid() = user_id);
    
CREATE POLICY "Users can delete own comments" ON public.comments
    FOR DELETE USING (auth.uid() = user_id);

-- Clusters table (AI-generated comment clusters)
CREATE TABLE IF NOT EXISTS public.clusters (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    theme TEXT NOT NULL,
    summary TEXT,
    comment_count INTEGER DEFAULT 0,
    sample_comments JSONB DEFAULT '[]'::jsonb,
    content_ideas JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on clusters
ALTER TABLE public.clusters ENABLE ROW LEVEL SECURITY;

-- Clusters policies
CREATE POLICY "Users can view own clusters" ON public.clusters
    FOR SELECT USING (auth.uid() = user_id);
    
CREATE POLICY "Users can insert own clusters" ON public.clusters
    FOR INSERT WITH CHECK (auth.uid() = user_id);
    
CREATE POLICY "Users can update own clusters" ON public.clusters
    FOR UPDATE USING (auth.uid() = user_id);
    
CREATE POLICY "Users can delete own clusters" ON public.clusters
    FOR DELETE USING (auth.uid() = user_id);

-- Integrations table (OAuth tokens for Gmail, IG, YT)
CREATE TABLE IF NOT EXISTS public.integrations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('gmail', 'instagram', 'youtube', 'tiktok')),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    account_email TEXT,
    account_name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- Enable RLS on integrations
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Integrations policies
CREATE POLICY "Users can view own integrations" ON public.integrations
    FOR SELECT USING (auth.uid() = user_id);
    
CREATE POLICY "Users can insert own integrations" ON public.integrations
    FOR INSERT WITH CHECK (auth.uid() = user_id);
    
CREATE POLICY "Users can update own integrations" ON public.integrations
    FOR UPDATE USING (auth.uid() = user_id);
    
CREATE POLICY "Users can delete own integrations" ON public.integrations
    FOR DELETE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deals_user_id ON public.deals(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON public.deals(status);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_cluster_id ON public.comments(cluster_id);
CREATE INDEX IF NOT EXISTS idx_comments_platform ON public.comments(platform);
CREATE INDEX IF NOT EXISTS idx_clusters_user_id ON public.clusters(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON public.integrations(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_clusters_updated_at BEFORE UPDATE ON public.clusters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON public.integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
"""
