-- Migration: Create user_profiles table
-- Description: Stores extended user profile information including CPF/CNPJ
-- Author: Processa AI Team
-- Date: 2025-01-29

-- Create ENUM type for document type
CREATE TYPE document_type AS ENUM ('cpf', 'cnpj');

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Document information (CPF or CNPJ)
    document_type document_type NOT NULL DEFAULT 'cpf',
    document_number VARCHAR(18) UNIQUE, -- Supports CPF (14 chars with mask) and CNPJ (18 chars with mask)

    -- Personal/Company information
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar_url TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

    -- Constraints
    CONSTRAINT valid_document_length CHECK (
        (document_type = 'cpf' AND length(regexp_replace(document_number, '[^0-9]', '', 'g')) = 11) OR
        (document_type = 'cnpj' AND length(regexp_replace(document_number, '[^0-9]', '', 'g')) = 14) OR
        document_number IS NULL
    )
);

-- Create indexes for better query performance
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX idx_user_profiles_document_number ON public.user_profiles(document_number) WHERE document_number IS NOT NULL;
CREATE INDEX idx_user_profiles_document_type ON public.user_profiles(document_type);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to user_profiles
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.user_profiles
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
    ON public.user_profiles
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.user_profiles
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own profile
CREATE POLICY "Users can delete own profile"
    ON public.user_profiles
    FOR DELETE
    USING (auth.uid() = user_id);

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, full_name, phone, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile automatically when user signs up
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Grant permissions
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;

-- Add helpful comments
COMMENT ON TABLE public.user_profiles IS 'Extended user profile information including CPF/CNPJ for Brazilian users';
COMMENT ON COLUMN public.user_profiles.document_type IS 'Type of document: CPF (individuals) or CNPJ (companies)';
COMMENT ON COLUMN public.user_profiles.document_number IS 'CPF (11 digits) or CNPJ (14 digits) - stored with mask for display';
COMMENT ON COLUMN public.user_profiles.full_name IS 'Full name for CPF or company name for CNPJ';
