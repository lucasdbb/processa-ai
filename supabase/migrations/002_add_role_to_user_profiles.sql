-- Migration: Add role to user_profiles table
-- Description: Adds role field for better role management and auditability
-- Author: Processa AI Team
-- Date: 2025-01-29

-- Create ENUM type for user roles
CREATE TYPE user_role AS ENUM ('user', 'admin', 'premium');

-- Add role column to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN role user_role NOT NULL DEFAULT 'user';

-- Create index for better query performance on role
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);

-- Update the handle_new_user trigger to include role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, full_name, phone, avatar_url, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'avatar_url',
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'user')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sync role from auth.users to user_profiles
CREATE OR REPLACE FUNCTION public.sync_user_role()
RETURNS TRIGGER AS $$
BEGIN
    -- Update role in user_profiles when changed in auth.users metadata
    UPDATE public.user_profiles
    SET role = COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'user'),
        updated_at = NOW()
    WHERE user_id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync role on auth.users update
CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    WHEN (OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data)
    EXECUTE FUNCTION public.sync_user_role();

-- Add helpful comment
COMMENT ON COLUMN public.user_profiles.role IS 'User role: user (default), admin (full access), or premium (paid features)';

-- Backfill existing users with their roles from auth.users
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN
        SELECT id, raw_user_meta_data->>'role' as metadata_role
        FROM auth.users
    LOOP
        UPDATE public.user_profiles
        SET role = COALESCE(user_record.metadata_role::user_role, 'user')
        WHERE user_id = user_record.id;
    END LOOP;
END $$;
