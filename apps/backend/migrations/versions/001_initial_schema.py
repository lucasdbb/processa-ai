"""Initial schema - all tables unified

Revision ID: 001_initial
Revises:
Create Date: 2026-01-27

This migration creates all schemas and tables for the Processa AI platform:
- public: Core tables (profiles, blog, newsletter, support, materials, billing)
- ai_worker: AI job processing tables
- office_api: Office management and Google Calendar integration
- calc_engine: Calculator service tables
"""

from typing import Sequence, Union

from alembic import op

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # =============================================================================
    # PUBLIC SCHEMA - Core tables
    # =============================================================================

    # 1. Profiles
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.profiles (
            id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            email TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'author', 'admin')),
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
            bio TEXT,
            phone TEXT,
            company TEXT,
            avatar_url TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
        CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
        CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status) WHERE status = 'active';

        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    """)

    # Criar funções helper para verificar roles (evita recursão infinita em RLS)
    op.execute("""
        CREATE OR REPLACE FUNCTION public.is_admin()
        RETURNS BOOLEAN AS $$
        BEGIN
            RETURN EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() AND role = 'admin'
            );
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

        CREATE OR REPLACE FUNCTION public.is_author_or_admin()
        RETURNS BOOLEAN AS $$
        BEGIN
            RETURN EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = auth.uid() AND role IN ('author', 'admin')
            );
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
    """)

    op.execute("""
        CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
        CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
        CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin());
        CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (public.is_admin());
    """)

    # 2. Blog Categories
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.blog_categories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            description TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_visible BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_blog_categories_slug ON public.blog_categories(slug);
        CREATE INDEX IF NOT EXISTS idx_blog_categories_visible_sort ON public.blog_categories(is_visible, sort_order) WHERE is_visible = true;
        ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
    """)

    op.execute("""
        CREATE POLICY "Anyone can view visible categories" ON public.blog_categories FOR SELECT USING (is_visible = true);
        CREATE POLICY "Admins can manage categories" ON public.blog_categories FOR ALL USING (public.is_admin());
    """)

    # 3. Blog Posts
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.blog_posts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            excerpt TEXT,
            content TEXT NOT NULL,
            cover_image_url TEXT,
            category_id UUID REFERENCES public.blog_categories(id) ON DELETE SET NULL,
            author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
            views_count INTEGER NOT NULL DEFAULT 0,
            reading_time_minutes INTEGER,
            seo_title TEXT,
            seo_description TEXT,
            published_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            search_vector TSVECTOR GENERATED ALWAYS AS (
                setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') ||
                setweight(to_tsvector('portuguese', coalesce(excerpt, '')), 'B') ||
                setweight(to_tsvector('portuguese', coalesce(content, '')), 'C')
            ) STORED
        );

        CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(slug);
        CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON public.blog_posts(status);
        CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON public.blog_posts(published_at DESC NULLS LAST) WHERE status = 'published';
        CREATE INDEX IF NOT EXISTS idx_blog_posts_author ON public.blog_posts(author_id);
        CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON public.blog_posts(category_id) WHERE category_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_blog_posts_search ON public.blog_posts USING GIN(search_vector);
        ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
    """)

    op.execute("""
        CREATE POLICY "Anyone can view published posts" ON public.blog_posts FOR SELECT USING (status = 'published' AND published_at <= NOW());
        CREATE POLICY "Authors can view own posts" ON public.blog_posts FOR SELECT USING (author_id = auth.uid());
        CREATE POLICY "Admins can view all posts" ON public.blog_posts FOR SELECT USING (public.is_admin());
        CREATE POLICY "Authors can create posts" ON public.blog_posts FOR INSERT WITH CHECK (auth.uid() = author_id AND public.is_author_or_admin());
        CREATE POLICY "Authors can update own posts" ON public.blog_posts FOR UPDATE USING (author_id = auth.uid() AND public.is_author_or_admin());
        CREATE POLICY "Admins can delete posts" ON public.blog_posts FOR DELETE USING (public.is_admin());
    """)

    # 4. Blog Tags
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.blog_tags (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL UNIQUE,
            slug TEXT NOT NULL UNIQUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_blog_tags_slug ON public.blog_tags(slug);
        ALTER TABLE public.blog_tags ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Anyone can view tags" ON public.blog_tags FOR SELECT USING (true);
        CREATE POLICY "Admins can manage tags" ON public.blog_tags FOR ALL USING (public.is_admin());
    """)

    # 5. Blog Post Tags
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.blog_post_tags (
            post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
            tag_id UUID NOT NULL REFERENCES public.blog_tags(id) ON DELETE CASCADE,
            PRIMARY KEY (post_id, tag_id)
        );

        CREATE INDEX IF NOT EXISTS idx_blog_post_tags_post ON public.blog_post_tags(post_id);
        CREATE INDEX IF NOT EXISTS idx_blog_post_tags_tag ON public.blog_post_tags(tag_id);
        ALTER TABLE public.blog_post_tags ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Anyone can view post tags" ON public.blog_post_tags FOR SELECT USING (true);
        CREATE POLICY "Authors can manage tags on own posts" ON public.blog_post_tags FOR ALL USING (EXISTS (SELECT 1 FROM public.blog_posts p WHERE p.id = post_id AND p.author_id = auth.uid()));
    """)

    # 6. Newsletter Subscriptions
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.newsletter_subscriptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT NOT NULL,
            name TEXT,
            topics TEXT[] DEFAULT ARRAY[]::TEXT[],
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'unsubscribed')),
            confirmation_token TEXT UNIQUE,
            confirmed_at TIMESTAMPTZ,
            unsubscribed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_email_unique ON public.newsletter_subscriptions(LOWER(email)) WHERE status != 'unsubscribed';
        CREATE INDEX IF NOT EXISTS idx_newsletter_status ON public.newsletter_subscriptions(status);
        CREATE INDEX IF NOT EXISTS idx_newsletter_token ON public.newsletter_subscriptions(confirmation_token) WHERE confirmation_token IS NOT NULL;
    """)

    # 7. Support Requests
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.support_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            company TEXT,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            contact_preference TEXT NOT NULL DEFAULT 'email' CHECK (contact_preference IN ('email', 'phone', 'whatsapp')),
            is_client BOOLEAN NOT NULL DEFAULT false,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
            assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
            resolved_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_support_status ON public.support_requests(status, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_support_assigned ON public.support_requests(assigned_to) WHERE assigned_to IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_support_email ON public.support_requests(LOWER(email));
        ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Admins can view all support requests" ON public.support_requests FOR SELECT USING (public.is_admin());
        CREATE POLICY "Admins can manage support requests" ON public.support_requests FOR ALL USING (public.is_admin());
    """)

    # 8. Materials
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.materials (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            slug TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            description TEXT,
            category TEXT NOT NULL,
            file_url TEXT,
            storage_bucket TEXT NOT NULL DEFAULT 'supabase-outputs',
            storage_path TEXT NOT NULL,
            filename TEXT NOT NULL,
            file_size_bytes BIGINT,
            mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/csv')),
            download_count INTEGER NOT NULL DEFAULT 0,
            is_published BOOLEAN NOT NULL DEFAULT false,
            requires_auth BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_materials_slug ON public.materials(slug);
        CREATE INDEX IF NOT EXISTS idx_materials_published ON public.materials(is_published, category) WHERE is_published = true;
        CREATE INDEX IF NOT EXISTS idx_materials_category ON public.materials(category) WHERE is_published = true;
        ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Anyone can view published public materials" ON public.materials FOR SELECT USING (is_published = true AND requires_auth = false);
        CREATE POLICY "Authenticated can view published auth-required materials" ON public.materials FOR SELECT USING (is_published = true AND requires_auth = true AND auth.role() = 'authenticated');
        CREATE POLICY "Admins can manage materials" ON public.materials FOR ALL USING (public.is_admin());
    """)

    # 9. Material Downloads
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.material_downloads (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
            user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
            ip_address INET,
            user_agent TEXT,
            downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_material_downloads_material ON public.material_downloads(material_id, downloaded_at DESC);
        CREATE INDEX IF NOT EXISTS idx_material_downloads_user ON public.material_downloads(user_id) WHERE user_id IS NOT NULL;
    """)

    # 10. Billing Plans
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.billing_plans (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            slug TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            description TEXT,
            price_reais NUMERIC(10, 2) NOT NULL CHECK (price_reais >= 0),
            currency TEXT NOT NULL DEFAULT 'BRL' CHECK (LENGTH(currency) = 3),
            interval TEXT NOT NULL DEFAULT 'month' CHECK (interval IN ('month', 'year')),
            features JSONB NOT NULL DEFAULT '[]'::jsonb,
            stripe_price_id TEXT UNIQUE,
            is_visible BOOLEAN NOT NULL DEFAULT true,
            is_popular BOOLEAN NOT NULL DEFAULT false,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_billing_plans_slug ON public.billing_plans(slug);
        CREATE INDEX IF NOT EXISTS idx_billing_plans_visible_sort ON public.billing_plans(is_visible, sort_order) WHERE is_visible = true;
        CREATE INDEX IF NOT EXISTS idx_billing_plans_stripe ON public.billing_plans(stripe_price_id) WHERE stripe_price_id IS NOT NULL;
        ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Anyone can view visible plans" ON public.billing_plans FOR SELECT USING (is_visible = true);
        CREATE POLICY "Admins can manage plans" ON public.billing_plans FOR ALL USING (public.is_admin());
    """)

    # 11. Functions and Triggers for public schema
    op.execute("""
        CREATE OR REPLACE FUNCTION public.update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
        CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

        DROP TRIGGER IF EXISTS update_blog_categories_updated_at ON public.blog_categories;
        CREATE TRIGGER update_blog_categories_updated_at BEFORE UPDATE ON public.blog_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

        DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON public.blog_posts;
        CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

        DROP TRIGGER IF EXISTS update_newsletter_subscriptions_updated_at ON public.newsletter_subscriptions;
        CREATE TRIGGER update_newsletter_subscriptions_updated_at BEFORE UPDATE ON public.newsletter_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

        DROP TRIGGER IF EXISTS update_support_requests_updated_at ON public.support_requests;
        CREATE TRIGGER update_support_requests_updated_at BEFORE UPDATE ON public.support_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

        DROP TRIGGER IF EXISTS update_materials_updated_at ON public.materials;
        CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

        DROP TRIGGER IF EXISTS update_billing_plans_updated_at ON public.billing_plans;
        CREATE TRIGGER update_billing_plans_updated_at BEFORE UPDATE ON public.billing_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION public.increment_material_download_count()
        RETURNS TRIGGER AS $$
        BEGIN
            UPDATE public.materials SET download_count = download_count + 1 WHERE id = NEW.material_id;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS increment_downloads_trigger ON public.material_downloads;
        CREATE TRIGGER increment_downloads_trigger AFTER INSERT ON public.material_downloads FOR EACH ROW EXECUTE FUNCTION public.increment_material_download_count();
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION public.search_blog_posts(search_query TEXT)
        RETURNS TABLE (id UUID, title TEXT, slug TEXT, excerpt TEXT, rank REAL) AS $$
        BEGIN
            RETURN QUERY
            SELECT p.id, p.title, p.slug, p.excerpt, ts_rank(p.search_vector, plainto_tsquery('portuguese', search_query)) AS rank
            FROM public.blog_posts p
            WHERE p.status = 'published' AND p.search_vector @@ plainto_tsquery('portuguese', search_query)
            ORDER BY rank DESC, p.published_at DESC;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # =============================================================================
    # AI_WORKER SCHEMA
    # =============================================================================

    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute("CREATE SCHEMA IF NOT EXISTS ai_worker")

    op.execute("""
        CREATE TABLE IF NOT EXISTS ai_worker.endpoints (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            key TEXT NOT NULL,
            version TEXT NOT NULL DEFAULT 'v1',
            method TEXT NOT NULL DEFAULT 'POST',
            path TEXT NOT NULL,
            description TEXT,
            n8n_workflow_id TEXT,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_ai_worker_endpoints_key UNIQUE (key)
        );

        CREATE INDEX IF NOT EXISTS ix_ai_worker_endpoints_is_active ON ai_worker.endpoints (is_active);

        -- Seed data: endpoints
        INSERT INTO ai_worker.endpoints (key, path, description, n8n_workflow_id)
        VALUES 
            ('cnis_analysis', '/api/v1/ai/analyses/cnis-upload', 'Análise de CNIS', 'cnis-analyzer'),
            ('markdown_to_pdf', '/api/v1/ai/documents/markdown-to-pdf', 'Conversão de Markdown para PDF', NULL),
            ('summarize_document', '/api/v1/ai/documents/summarize', 'Resumo de documento', NULL)
        ON CONFLICT (key) DO NOTHING;
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS ai_worker.jobs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            endpoint_key TEXT NOT NULL,
            status TEXT NOT NULL,
            progress INTEGER NOT NULL DEFAULT 0,
            user_id TEXT NOT NULL,
            client_id TEXT,
            request_payload JSONB,
            result_payload JSONB,
            error TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            started_at TIMESTAMPTZ,
            finished_at TIMESTAMPTZ,
            CONSTRAINT ck_ai_worker_jobs_progress_range CHECK (progress >= 0 AND progress <= 100),
            CONSTRAINT ck_ai_worker_jobs_status CHECK (status IN ('queued','processing','completed','failed','cancelled')),
            CONSTRAINT fk_ai_worker_jobs_endpoint_key FOREIGN KEY (endpoint_key) REFERENCES ai_worker.endpoints (key) ON DELETE RESTRICT
        );

        CREATE INDEX IF NOT EXISTS ix_ai_worker_jobs_user_id_created_at ON ai_worker.jobs (user_id, created_at);
        CREATE INDEX IF NOT EXISTS ix_ai_worker_jobs_status ON ai_worker.jobs (status);
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS ai_worker.job_events (
            id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            job_id UUID NOT NULL,
            event_type TEXT NOT NULL,
            message TEXT,
            payload JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT fk_ai_worker_job_events_job_id FOREIGN KEY (job_id) REFERENCES ai_worker.jobs (id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS ix_ai_worker_job_events_job_id_created_at ON ai_worker.job_events (job_id, created_at);
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS ai_worker.documents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            job_id UUID,
            user_id TEXT NOT NULL,
            client_id TEXT,
            document_type TEXT NOT NULL,
            bucket TEXT NOT NULL,
            storage_path TEXT NOT NULL,
            filename TEXT NOT NULL,
            checksum_sha256 TEXT,
            size_bytes BIGINT,
            mime_type TEXT NOT NULL DEFAULT 'application/pdf',
            metadata JSONB,
            linked_document_id UUID REFERENCES ai_worker.documents(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT fk_ai_worker_documents_job_id FOREIGN KEY (job_id) REFERENCES ai_worker.jobs (id) ON DELETE SET NULL,
            CONSTRAINT uq_ai_worker_documents_bucket_path UNIQUE (bucket, storage_path)
        );

        CREATE INDEX IF NOT EXISTS ix_ai_worker_documents_user_id_created_at ON ai_worker.documents (user_id, created_at);
    """)

    op.execute("""
        ALTER TABLE ai_worker.endpoints ENABLE ROW LEVEL SECURITY;
        ALTER TABLE ai_worker.jobs ENABLE ROW LEVEL SECURITY;
        ALTER TABLE ai_worker.job_events ENABLE ROW LEVEL SECURITY;
        ALTER TABLE ai_worker.documents ENABLE ROW LEVEL SECURITY;
    """)

    # =============================================================================
    # OFFICE_API SCHEMA
    # =============================================================================

    op.execute("CREATE SCHEMA IF NOT EXISTS office_api")

    op.execute("""
        CREATE TABLE IF NOT EXISTS office_api.google_connections (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            email TEXT NOT NULL,
            access_token_encrypted TEXT NOT NULL,
            refresh_token_encrypted TEXT NOT NULL,
            token_expires_at TIMESTAMPTZ NOT NULL,
            scopes TEXT[] NOT NULL DEFAULT '{}',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_google_connections_user_email UNIQUE (user_id, email)
        );

        CREATE INDEX IF NOT EXISTS idx_google_connections_user ON office_api.google_connections(user_id);
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS office_api.calendars (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            google_connection_id UUID REFERENCES office_api.google_connections(id) ON DELETE CASCADE,
            google_calendar_id TEXT,
            name TEXT NOT NULL,
            color TEXT,
            is_primary BOOLEAN NOT NULL DEFAULT FALSE,
            is_synced BOOLEAN NOT NULL DEFAULT TRUE,
            sync_token TEXT,
            last_synced_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_calendars_user_google UNIQUE (user_id, google_calendar_id)
        );

        CREATE INDEX IF NOT EXISTS idx_calendars_user ON office_api.calendars(user_id);
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS office_api.events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            calendar_id UUID REFERENCES office_api.calendars(id) ON DELETE SET NULL,
            google_event_id TEXT,
            title TEXT NOT NULL,
            description TEXT,
            location TEXT,
            start_at TIMESTAMPTZ NOT NULL,
            end_at TIMESTAMPTZ NOT NULL,
            all_day BOOLEAN NOT NULL DEFAULT FALSE,
            event_type TEXT NOT NULL DEFAULT 'other' CHECK (event_type IN ('audiencia', 'prazo', 'reuniao', 'other')),
            status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
            processo_id UUID,
            cliente_id UUID,
            color TEXT,
            reminder_minutes INTEGER[] DEFAULT ARRAY[15, 60],
            google_etag TEXT,
            source TEXT NOT NULL DEFAULT 'local' CHECK (source IN ('local', 'google')),
            sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending_sync', 'conflict')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_events_user_start ON office_api.events(user_id, start_at);
        CREATE INDEX IF NOT EXISTS idx_events_calendar ON office_api.events(calendar_id);
        CREATE INDEX IF NOT EXISTS idx_events_google_id ON office_api.events(google_event_id) WHERE google_event_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_events_processo ON office_api.events(processo_id) WHERE processo_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_events_cliente ON office_api.events(cliente_id) WHERE cliente_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_events_sync_status ON office_api.events(sync_status) WHERE sync_status = 'pending_sync';
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS office_api.webhook_channels (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            calendar_id UUID NOT NULL REFERENCES office_api.calendars(id) ON DELETE CASCADE,
            channel_id TEXT NOT NULL UNIQUE,
            resource_id TEXT NOT NULL,
            expiration_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_webhook_channels_expiration ON office_api.webhook_channels(expiration_at);
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS office_api.event_reminders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            event_id UUID NOT NULL REFERENCES office_api.events(id) ON DELETE CASCADE,
            remind_at TIMESTAMPTZ NOT NULL,
            channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'push', 'both')),
            sent_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_event_reminders_remind_at ON office_api.event_reminders(remind_at) WHERE sent_at IS NULL;
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS office_api.user_notification_preferences (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
            email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            default_reminder_minutes INTEGER[] DEFAULT ARRAY[15, 60, 1440],
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """)

    # RLS for office_api
    op.execute("""
        ALTER TABLE office_api.google_connections ENABLE ROW LEVEL SECURITY;
        ALTER TABLE office_api.calendars ENABLE ROW LEVEL SECURITY;
        ALTER TABLE office_api.events ENABLE ROW LEVEL SECURITY;
        ALTER TABLE office_api.webhook_channels ENABLE ROW LEVEL SECURITY;
        ALTER TABLE office_api.event_reminders ENABLE ROW LEVEL SECURITY;
        ALTER TABLE office_api.user_notification_preferences ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can manage own connections" ON office_api.google_connections FOR ALL USING (auth.uid() = user_id);
        CREATE POLICY "Users can manage own calendars" ON office_api.calendars FOR ALL USING (auth.uid() = user_id);
        CREATE POLICY "Users can manage own events" ON office_api.events FOR ALL USING (auth.uid() = user_id);
        CREATE POLICY "Users can manage own webhook channels" ON office_api.webhook_channels FOR ALL USING (auth.uid() = user_id);
        CREATE POLICY "Users can manage own reminders" ON office_api.event_reminders FOR ALL USING (auth.uid() = user_id);
        CREATE POLICY "Users can manage own notification preferences" ON office_api.user_notification_preferences FOR ALL USING (auth.uid() = user_id);

        CREATE POLICY "Service role can manage all connections" ON office_api.google_connections FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
        CREATE POLICY "Service role can manage all calendars" ON office_api.calendars FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
        CREATE POLICY "Service role can manage all events" ON office_api.events FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
        CREATE POLICY "Service role can manage all webhook channels" ON office_api.webhook_channels FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
        CREATE POLICY "Service role can manage all reminders" ON office_api.event_reminders FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
        CREATE POLICY "Service role can manage all notification preferences" ON office_api.user_notification_preferences FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
    """)

    # Triggers for office_api
    op.execute("""
        CREATE OR REPLACE FUNCTION office_api.update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS update_google_connections_updated_at ON office_api.google_connections;
        CREATE TRIGGER update_google_connections_updated_at BEFORE UPDATE ON office_api.google_connections FOR EACH ROW EXECUTE FUNCTION office_api.update_updated_at_column();

        DROP TRIGGER IF EXISTS update_calendars_updated_at ON office_api.calendars;
        CREATE TRIGGER update_calendars_updated_at BEFORE UPDATE ON office_api.calendars FOR EACH ROW EXECUTE FUNCTION office_api.update_updated_at_column();

        DROP TRIGGER IF EXISTS update_events_updated_at ON office_api.events;
        CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON office_api.events FOR EACH ROW EXECUTE FUNCTION office_api.update_updated_at_column();

        DROP TRIGGER IF EXISTS update_user_notification_preferences_updated_at ON office_api.user_notification_preferences;
        CREATE TRIGGER update_user_notification_preferences_updated_at BEFORE UPDATE ON office_api.user_notification_preferences FOR EACH ROW EXECUTE FUNCTION office_api.update_updated_at_column();
    """)

    # =============================================================================
    # CALC_ENGINE SCHEMA
    # =============================================================================

    op.execute("CREATE SCHEMA IF NOT EXISTS calc_engine")

    op.execute("""
        CREATE TABLE IF NOT EXISTS calc_engine.calculations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            calculator_key TEXT NOT NULL,
            status TEXT NOT NULL,
            user_id TEXT NOT NULL,
            client_id TEXT,
            input_payload JSONB,
            output_payload JSONB,
            error TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            finished_at TIMESTAMPTZ,
            CONSTRAINT ck_calc_engine_calculations_status CHECK (status IN ('processing','completed','failed'))
        );

        CREATE INDEX IF NOT EXISTS ix_calc_engine_calculations_user_id_created_at ON calc_engine.calculations (user_id, created_at);
        CREATE INDEX IF NOT EXISTS ix_calc_engine_calculations_calculator_key_created_at ON calc_engine.calculations (calculator_key, created_at);
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS calc_engine.documents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            calculation_id UUID,
            user_id TEXT NOT NULL,
            client_id TEXT,
            document_type TEXT NOT NULL,
            bucket TEXT NOT NULL,
            storage_path TEXT NOT NULL,
            filename TEXT NOT NULL,
            checksum_sha256 TEXT,
            size_bytes BIGINT,
            mime_type TEXT NOT NULL DEFAULT 'application/pdf',
            metadata JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT fk_calc_engine_documents_calculation_id FOREIGN KEY (calculation_id) REFERENCES calc_engine.calculations (id) ON DELETE SET NULL,
            CONSTRAINT uq_calc_engine_documents_bucket_path UNIQUE (bucket, storage_path)
        );

        CREATE INDEX IF NOT EXISTS ix_calc_engine_documents_user_id_created_at ON calc_engine.documents (user_id, created_at);
    """)

    op.execute("""
        ALTER TABLE calc_engine.calculations ENABLE ROW LEVEL SECURITY;
        ALTER TABLE calc_engine.documents ENABLE ROW LEVEL SECURITY;
    """)


def downgrade() -> None:
    # Drop calc_engine schema
    op.execute("DROP TABLE IF EXISTS calc_engine.documents CASCADE")
    op.execute("DROP TABLE IF EXISTS calc_engine.calculations CASCADE")
    op.execute("DROP SCHEMA IF EXISTS calc_engine CASCADE")

    # Drop office_api schema
    op.execute("DROP FUNCTION IF EXISTS office_api.update_updated_at_column() CASCADE")
    op.execute("DROP TABLE IF EXISTS office_api.user_notification_preferences CASCADE")
    op.execute("DROP TABLE IF EXISTS office_api.event_reminders CASCADE")
    op.execute("DROP TABLE IF EXISTS office_api.webhook_channels CASCADE")
    op.execute("DROP TABLE IF EXISTS office_api.events CASCADE")
    op.execute("DROP TABLE IF EXISTS office_api.calendars CASCADE")
    op.execute("DROP TABLE IF EXISTS office_api.google_connections CASCADE")
    op.execute("DROP SCHEMA IF EXISTS office_api CASCADE")

    # Drop ai_worker schema
    op.execute("DROP TABLE IF EXISTS ai_worker.documents CASCADE")
    op.execute("DROP TABLE IF EXISTS ai_worker.job_events CASCADE")
    op.execute("DROP TABLE IF EXISTS ai_worker.jobs CASCADE")
    op.execute("DROP TABLE IF EXISTS ai_worker.endpoints CASCADE")
    op.execute("DROP SCHEMA IF EXISTS ai_worker CASCADE")

    # Drop public schema tables and functions
    op.execute("DROP FUNCTION IF EXISTS public.search_blog_posts(TEXT) CASCADE")
    op.execute("DROP FUNCTION IF EXISTS public.increment_material_download_count() CASCADE")
    op.execute("DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE")
    op.execute("DROP TABLE IF EXISTS public.billing_plans CASCADE")
    op.execute("DROP TABLE IF EXISTS public.material_downloads CASCADE")
    op.execute("DROP TABLE IF EXISTS public.materials CASCADE")
    op.execute("DROP TABLE IF EXISTS public.support_requests CASCADE")
    op.execute("DROP TABLE IF EXISTS public.newsletter_subscriptions CASCADE")
    op.execute("DROP TABLE IF EXISTS public.blog_post_tags CASCADE")
    op.execute("DROP TABLE IF EXISTS public.blog_tags CASCADE")
    op.execute("DROP TABLE IF EXISTS public.blog_posts CASCADE")
    op.execute("DROP TABLE IF EXISTS public.blog_categories CASCADE")
    op.execute("DROP TABLE IF EXISTS public.profiles CASCADE")
