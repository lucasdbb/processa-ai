-- Add status column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add check constraint for status values
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_status_check 
CHECK (status IN ('active', 'inactive', 'suspended', 'overdue'));

-- Update existing profiles to have status 'active' if null
UPDATE public.profiles SET status = 'active' WHERE status IS NULL;
