-- =====================================================
-- PROCESSA AI - INITIAL DATABASE SCHEMA
-- =====================================================
-- Description: Initial database schema for Processa AI platform
-- Features: Auth, User Profiles, Blog, Calculators, AI Chat
-- Created: 2025-01-02
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PROFILES TABLE
-- =====================================================
-- Stores user profile information beyond auth.users
-- Automatically created via trigger when user signs up

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
-- Users can read their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
    ON public.profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- TRIGGER: Auto-create profile on user signup
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        COALESCE(NEW.raw_user_meta_data->>'role', 'user')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- TRIGGER: Auto-update updated_at timestamp
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- BLOG CATEGORIES TABLE
-- =====================================================

CREATE TABLE public.blog_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blog_categories_slug ON public.blog_categories(slug);

ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;

-- Anyone can read categories
CREATE POLICY "Anyone can view categories"
    ON public.blog_categories
    FOR SELECT
    TO public
    USING (true);

-- Only admins can manage categories
CREATE POLICY "Admins can manage categories"
    ON public.blog_categories
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE TRIGGER set_blog_categories_updated_at
    BEFORE UPDATE ON public.blog_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- BLOG POSTS TABLE
-- =====================================================

CREATE TABLE public.blog_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    excerpt TEXT,
    content TEXT NOT NULL,
    cover_image_url TEXT,
    category_id UUID REFERENCES public.blog_categories(id) ON DELETE SET NULL,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON public.blog_posts(status);
CREATE INDEX idx_blog_posts_category_id ON public.blog_posts(category_id);
CREATE INDEX idx_blog_posts_author_id ON public.blog_posts(author_id);
CREATE INDEX idx_blog_posts_published_at ON public.blog_posts(published_at DESC);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read published posts
CREATE POLICY "Anyone can view published posts"
    ON public.blog_posts
    FOR SELECT
    TO public
    USING (status = 'published');

-- Admins can view all posts
CREATE POLICY "Admins can view all posts"
    ON public.blog_posts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Admins can manage posts
CREATE POLICY "Admins can manage posts"
    ON public.blog_posts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE TRIGGER set_blog_posts_updated_at
    BEFORE UPDATE ON public.blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- CALCULATOR HISTORY TABLE
-- =====================================================

CREATE TABLE public.calculator_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    calculator_type TEXT NOT NULL CHECK (calculator_type IN ('pension', 'employment_termination')),
    inputs JSONB NOT NULL,
    results JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calculator_history_user_id ON public.calculator_history(user_id);
CREATE INDEX idx_calculator_history_calculator_type ON public.calculator_history(calculator_type);
CREATE INDEX idx_calculator_history_created_at ON public.calculator_history(created_at DESC);

ALTER TABLE public.calculator_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own history
CREATE POLICY "Users can view own calculator history"
    ON public.calculator_history
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own calculations
CREATE POLICY "Users can insert own calculator history"
    ON public.calculator_history
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own history
CREATE POLICY "Users can delete own calculator history"
    ON public.calculator_history
    FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- AI CHAT SESSIONS TABLE
-- =====================================================

CREATE TABLE public.ai_chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Nova Conversa',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_chat_sessions_user_id ON public.ai_chat_sessions(user_id);
CREATE INDEX idx_ai_chat_sessions_created_at ON public.ai_chat_sessions(created_at DESC);

ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "Users can view own chat sessions"
    ON public.ai_chat_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own sessions
CREATE POLICY "Users can create own chat sessions"
    ON public.ai_chat_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update own chat sessions"
    ON public.ai_chat_sessions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own sessions
CREATE POLICY "Users can delete own chat sessions"
    ON public.ai_chat_sessions
    FOR DELETE
    USING (auth.uid() = user_id);

CREATE TRIGGER set_ai_chat_sessions_updated_at
    BEFORE UPDATE ON public.ai_chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- AI CHAT MESSAGES TABLE
-- =====================================================

CREATE TABLE public.ai_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_chat_messages_session_id ON public.ai_chat_messages(session_id);
CREATE INDEX idx_ai_chat_messages_created_at ON public.ai_chat_messages(created_at ASC);

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages from their own sessions
CREATE POLICY "Users can view own chat messages"
    ON public.ai_chat_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.ai_chat_sessions
            WHERE id = session_id AND user_id = auth.uid()
        )
    );

-- Users can insert messages to their own sessions
CREATE POLICY "Users can insert own chat messages"
    ON public.ai_chat_messages
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.ai_chat_sessions
            WHERE id = session_id AND user_id = auth.uid()
        )
    );

-- Users can delete messages from their own sessions
CREATE POLICY "Users can delete own chat messages"
    ON public.ai_chat_messages
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.ai_chat_sessions
            WHERE id = session_id AND user_id = auth.uid()
        )
    );

-- =====================================================
-- SEED DATA: Default blog categories
-- =====================================================

INSERT INTO public.blog_categories (name, slug, description) VALUES
    ('Direito do Trabalho', 'direito-trabalho', 'Artigos sobre direito trabalhista'),
    ('Previdenciário', 'previdenciario', 'Artigos sobre direito previdenciário'),
    ('Cálculos', 'calculos', 'Tutoriais e dicas sobre cálculos jurídicos'),
    ('Jurisprudência', 'jurisprudencia', 'Análises de jurisprudência'),
    ('Legislação', 'legislacao', 'Atualizações e análises de legislação');
