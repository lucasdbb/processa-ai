"""create core schema from scratch

Revision ID: c5943e1f6b88
Revises:
Create Date: 2026-01-27 20:32:50.033104

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c5943e1f6b88"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all core schema tables from scratch."""

    # Execute complete SQL in batches for better error handling

    # 1. Profiles
    op.execute("""
        CREATE TABLE public.profiles (
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
        
        CREATE INDEX idx_profiles_email ON public.profiles(email);
        CREATE INDEX idx_profiles_role ON public.profiles(role);
        CREATE INDEX idx_profiles_status ON public.profiles(status) WHERE status = 'active';
        
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    """)

    op.execute("""
        CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
        CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
        CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
        CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
    """)

    # 2. Blog Categories
    op.execute("""
        CREATE TABLE public.blog_categories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            description TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_visible BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        
        CREATE INDEX idx_blog_categories_slug ON public.blog_categories(slug);
        CREATE INDEX idx_blog_categories_visible_sort ON public.blog_categories(is_visible, sort_order) WHERE is_visible = true;
        ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
    """)

    op.execute("""
        CREATE POLICY "Anyone can view visible categories" ON public.blog_categories FOR SELECT USING (is_visible = true);
        CREATE POLICY "Admins can manage categories" ON public.blog_categories FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
    """)

    # 3. Blog Posts
    op.execute("""
        CREATE TABLE public.blog_posts (
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
        
        CREATE INDEX idx_blog_posts_slug ON public.blog_posts(slug);
        CREATE INDEX idx_blog_posts_status ON public.blog_posts(status);
        CREATE INDEX idx_blog_posts_published ON public.blog_posts(published_at DESC NULLS LAST) WHERE status = 'published';
        CREATE INDEX idx_blog_posts_author ON public.blog_posts(author_id);
        CREATE INDEX idx_blog_posts_category ON public.blog_posts(category_id) WHERE category_id IS NOT NULL;
        CREATE INDEX idx_blog_posts_search ON public.blog_posts USING GIN(search_vector);
        ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
    """)

    op.execute("""
        CREATE POLICY "Anyone can view published posts" ON public.blog_posts FOR SELECT USING (status = 'published' AND published_at <= NOW());
        CREATE POLICY "Authors can view own posts" ON public.blog_posts FOR SELECT USING (author_id = auth.uid());
        CREATE POLICY "Admins can view all posts" ON public.blog_posts FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
        CREATE POLICY "Authors can create posts" ON public.blog_posts FOR INSERT WITH CHECK (auth.uid() = author_id AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('author', 'admin')));
        CREATE POLICY "Authors can update own posts" ON public.blog_posts FOR UPDATE USING (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('author', 'admin')));
        CREATE POLICY "Admins can delete posts" ON public.blog_posts FOR DELETE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
    """)

    # 4. Blog Tags
    op.execute("""
        CREATE TABLE public.blog_tags (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL UNIQUE,
            slug TEXT NOT NULL UNIQUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        
        CREATE INDEX idx_blog_tags_slug ON public.blog_tags(slug);
        ALTER TABLE public.blog_tags ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Anyone can view tags" ON public.blog_tags FOR SELECT USING (true);
        CREATE POLICY "Admins can manage tags" ON public.blog_tags FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
    """)

    # 5. Blog Post Tags
    op.execute("""
        CREATE TABLE public.blog_post_tags (
            post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
            tag_id UUID NOT NULL REFERENCES public.blog_tags(id) ON DELETE CASCADE,
            PRIMARY KEY (post_id, tag_id)
        );
        
        CREATE INDEX idx_blog_post_tags_post ON public.blog_post_tags(post_id);
        CREATE INDEX idx_blog_post_tags_tag ON public.blog_post_tags(tag_id);
        ALTER TABLE public.blog_post_tags ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Anyone can view post tags" ON public.blog_post_tags FOR SELECT USING (true);
        CREATE POLICY "Authors can manage tags on own posts" ON public.blog_post_tags FOR ALL USING (EXISTS (SELECT 1 FROM public.blog_posts p WHERE p.id = post_id AND p.author_id = auth.uid()));
    """)

    # 6. Newsletter Subscriptions
    op.execute("""
        CREATE TABLE public.newsletter_subscriptions (
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
        
        CREATE UNIQUE INDEX idx_newsletter_email_unique ON public.newsletter_subscriptions(LOWER(email)) WHERE status != 'unsubscribed';
        CREATE INDEX idx_newsletter_status ON public.newsletter_subscriptions(status);
        CREATE INDEX idx_newsletter_token ON public.newsletter_subscriptions(confirmation_token) WHERE confirmation_token IS NOT NULL;
    """)

    # 7. Support Requests
    op.execute("""
        CREATE TABLE public.support_requests (
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
        
        CREATE INDEX idx_support_status ON public.support_requests(status, created_at DESC);
        CREATE INDEX idx_support_assigned ON public.support_requests(assigned_to) WHERE assigned_to IS NOT NULL;
        CREATE INDEX idx_support_email ON public.support_requests(LOWER(email));
        ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can view all support requests" ON public.support_requests FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
        CREATE POLICY "Admins can manage support requests" ON public.support_requests FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
    """)

    # 8. Materials
    op.execute("""
        CREATE TABLE public.materials (
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
        
        CREATE INDEX idx_materials_slug ON public.materials(slug);
        CREATE INDEX idx_materials_published ON public.materials(is_published, category) WHERE is_published = true;
        CREATE INDEX idx_materials_category ON public.materials(category) WHERE is_published = true;
        ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Anyone can view published public materials" ON public.materials FOR SELECT USING (is_published = true AND requires_auth = false);
        CREATE POLICY "Authenticated can view published auth-required materials" ON public.materials FOR SELECT USING (is_published = true AND requires_auth = true AND auth.role() = 'authenticated');
        CREATE POLICY "Admins can manage materials" ON public.materials FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
    """)

    # 9. Material Downloads
    op.execute("""
        CREATE TABLE public.material_downloads (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
            user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
            ip_address INET,
            user_agent TEXT,
            downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        
        CREATE INDEX idx_material_downloads_material ON public.material_downloads(material_id, downloaded_at DESC);
        CREATE INDEX idx_material_downloads_user ON public.material_downloads(user_id) WHERE user_id IS NOT NULL;
    """)

    # 10. Billing Plans
    op.execute("""
        CREATE TABLE public.billing_plans (
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
        
        CREATE INDEX idx_billing_plans_slug ON public.billing_plans(slug);
        CREATE INDEX idx_billing_plans_visible_sort ON public.billing_plans(is_visible, sort_order) WHERE is_visible = true;
        CREATE INDEX idx_billing_plans_stripe ON public.billing_plans(stripe_price_id) WHERE stripe_price_id IS NOT NULL;
        ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Anyone can view visible plans" ON public.billing_plans FOR SELECT USING (is_visible = true);
        CREATE POLICY "Admins can manage plans" ON public.billing_plans FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
    """)

    # 11. Functions and Triggers
    op.execute("""
        CREATE OR REPLACE FUNCTION public.update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        
        CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
        CREATE TRIGGER update_blog_categories_updated_at BEFORE UPDATE ON public.blog_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
        CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
        CREATE TRIGGER update_newsletter_subscriptions_updated_at BEFORE UPDATE ON public.newsletter_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
        CREATE TRIGGER update_support_requests_updated_at BEFORE UPDATE ON public.support_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
        CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
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


def downgrade() -> None:
    """Drop all core schema tables."""
    op.execute("""
        DROP FUNCTION IF EXISTS public.search_blog_posts(TEXT) CASCADE;
        DROP FUNCTION IF EXISTS public.increment_material_download_count() CASCADE;
        DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
        
        DROP TABLE IF EXISTS public.billing_plans CASCADE;
        DROP TABLE IF EXISTS public.material_downloads CASCADE;
        DROP TABLE IF EXISTS public.materials CASCADE;
        DROP TABLE IF EXISTS public.support_requests CASCADE;
        DROP TABLE IF EXISTS public.newsletter_subscriptions CASCADE;
        DROP TABLE IF EXISTS public.blog_post_tags CASCADE;
        DROP TABLE IF EXISTS public.blog_tags CASCADE;
        DROP TABLE IF EXISTS public.blog_posts CASCADE;
        DROP TABLE IF EXISTS public.blog_categories CASCADE;
        DROP TABLE IF EXISTS public.profiles CASCADE;
    """)
