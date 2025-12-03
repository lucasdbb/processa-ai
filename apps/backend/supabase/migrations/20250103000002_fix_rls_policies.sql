-- =====================================================
-- FIX RLS POLICIES - REMOVE INFINITE RECURSION
-- =====================================================
-- Description: Fix infinite recursion in admin policies by using JWT claims
-- Created: 2025-01-03
-- =====================================================

-- Drop existing admin policy that causes recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create new admin policy using JWT claims instead of table lookup
CREATE POLICY "Admins can view all profiles"
    ON public.profiles
    FOR SELECT
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- Also fix the blog posts admin policies if they exist
DROP POLICY IF EXISTS "Admins can view all posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can manage posts" ON public.blog_posts;

CREATE POLICY "Admins can view all posts"
    ON public.blog_posts
    FOR SELECT
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

CREATE POLICY "Admins can manage posts"
    ON public.blog_posts
    FOR ALL
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

-- Fix blog categories admin policy
DROP POLICY IF EXISTS "Admins can manage categories" ON public.blog_categories;

CREATE POLICY "Admins can manage categories"
    ON public.blog_categories
    FOR ALL
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );
