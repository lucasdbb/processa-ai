-- =====================================================
-- ADD ADDITIONAL PROFILE FIELDS
-- =====================================================
-- Description: Add phone, document fields to profiles table
-- Created: 2025-01-03
-- =====================================================

-- Add new columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS document_type TEXT CHECK (document_type IN ('cpf', 'cnpj', NULL)),
ADD COLUMN IF NOT EXISTS document_number TEXT;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_profiles_document_number ON public.profiles(document_number);

-- Update trigger to include new fields from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, phone, document_type, document_number)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'document_type',
        NEW.raw_user_meta_data->>'document_number'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
