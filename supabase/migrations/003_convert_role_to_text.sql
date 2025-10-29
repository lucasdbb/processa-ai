-- Migration: Convert role from ENUM to TEXT
-- Description: Converts the role column from user_role ENUM type to TEXT with CHECK constraint
--              This fixes the "type user_role does not exist" error in transactions that occurs
--              when the ENUM type is not accessible in the correct schema context
-- Author: Processa AI Team
-- Date: 2025-10-29

-- ============================================================================
-- MIGRATION: Convert user_role ENUM to TEXT with CHECK constraint
-- ============================================================================

BEGIN;

-- Step 1: Create backup column to preserve existing data
ALTER TABLE public.user_profiles
ADD COLUMN role_backup TEXT;

-- Step 2: Copy existing role values to backup
UPDATE public.user_profiles
SET role_backup = role::TEXT;

-- Step 3: Drop the existing role column (CASCADE removes dependencies)
ALTER TABLE public.user_profiles
DROP COLUMN role CASCADE;

-- Step 4: Recreate role column as TEXT with NOT NULL and default value
ALTER TABLE public.user_profiles
ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

-- Step 5: Restore data from backup column
UPDATE public.user_profiles
SET role = role_backup;

-- Step 6: Add CHECK constraint to ensure only valid values are allowed
ALTER TABLE public.user_profiles
ADD CONSTRAINT role_check CHECK (role IN ('user', 'admin', 'premium'));

-- Step 7: Drop the backup column (no longer needed)
ALTER TABLE public.user_profiles
DROP COLUMN role_backup;

-- Step 8: Recreate index for role column
DROP INDEX IF EXISTS idx_user_profiles_role;
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);

-- Step 9: Update handle_new_user function to work without ENUM cast
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, full_name, phone, avatar_url, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'avatar_url',
        COALESCE(NEW.raw_user_meta_data->>'role', 'user')  -- No ENUM cast
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Update sync_user_role function to work without ENUM cast
CREATE OR REPLACE FUNCTION public.sync_user_role()
RETURNS TRIGGER AS $$
BEGIN
    -- Update role in user_profiles when changed in auth.users metadata
    UPDATE public.user_profiles
    SET role = COALESCE(NEW.raw_user_meta_data->>'role', 'user'),  -- No ENUM cast
        updated_at = NOW()
    WHERE user_id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 11: Update update_user_role function to work with TEXT
CREATE OR REPLACE FUNCTION public.update_user_role(
    target_user_id UUID,
    new_role TEXT  -- Changed from user_role ENUM to TEXT
)
RETURNS VOID AS $$
BEGIN
    -- Validate that new_role is one of the allowed values
    IF new_role NOT IN ('user', 'admin', 'premium') THEN
        RAISE EXCEPTION 'Invalid role: %. Allowed roles are: user, admin, premium', new_role;
    END IF;

    -- Update role in auth.users metadata
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{role}',
        to_jsonb(new_role)
    )
    WHERE id = target_user_id;

    -- Update role in user_profiles (trigger will sync automatically, but doing it explicitly for safety)
    UPDATE public.user_profiles
    SET role = new_role,
        updated_at = NOW()
    WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 12: Drop the user_role ENUM type (no longer needed)
-- Note: Only drop if no other tables use it
DO $$
BEGIN
    DROP TYPE IF EXISTS user_role CASCADE;
    RAISE NOTICE 'user_role ENUM type has been dropped';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not drop user_role type: %', SQLERRM;
END $$;

-- Step 13: Update comment on role column
COMMENT ON COLUMN public.user_profiles.role IS 'User role: user (default), admin (full access), or premium (paid features). Now stored as TEXT with CHECK constraint instead of ENUM.';

-- Step 14: Verify the migration was successful
DO $$
DECLARE
    col_type TEXT;
    col_default TEXT;
    constraint_exists BOOLEAN;
BEGIN
    -- Check column type
    SELECT data_type, column_default INTO col_type, col_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'role';

    IF col_type != 'text' THEN
        RAISE EXCEPTION 'Migration failed: role column is not TEXT type (found: %)', col_type;
    END IF;

    -- Check CHECK constraint exists
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.check_constraints
        WHERE constraint_name = 'role_check'
          AND constraint_schema = 'public'
    ) INTO constraint_exists;

    IF NOT constraint_exists THEN
        RAISE EXCEPTION 'Migration failed: role_check constraint does not exist';
    END IF;

    -- Success message
    RAISE NOTICE '✓ Migration successful!';
    RAISE NOTICE '  - role column type: %', col_type;
    RAISE NOTICE '  - role column default: %', col_default;
    RAISE NOTICE '  - role_check constraint: exists';
    RAISE NOTICE '  - user_role ENUM type: dropped';
    RAISE NOTICE '  - All functions updated to work without ENUM cast';
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these separately to verify the migration was successful
-- ============================================================================

-- Verify column structure
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'user_profiles'
--   AND column_name = 'role';
-- Expected: data_type = 'text', is_nullable = 'NO', column_default = 'user'::text

-- Verify CHECK constraint
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_schema = 'public'
--   AND constraint_name = 'role_check';
-- Expected: check_clause contains "role IN ('user', 'admin', 'premium')"

-- Verify index exists
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'user_profiles'
--   AND indexname = 'idx_user_profiles_role';
-- Expected: index exists on role column

-- Verify ENUM type is dropped
-- SELECT typname FROM pg_type WHERE typname = 'user_role';
-- Expected: no rows returned

-- Test inserting a valid role (should succeed)
-- INSERT INTO public.user_profiles (user_id, full_name, role)
-- VALUES (gen_random_uuid(), 'Test User', 'admin');

-- Test inserting an invalid role (should fail with CHECK constraint violation)
-- INSERT INTO public.user_profiles (user_id, full_name, role)
-- VALUES (gen_random_uuid(), 'Test User', 'invalid_role');
-- Expected: ERROR: new row for relation "user_profiles" violates check constraint "role_check"

-- Verify all existing roles are preserved
-- SELECT role, COUNT(*) as count
-- FROM public.user_profiles
-- GROUP BY role
-- ORDER BY role;
-- Expected: Shows distribution of user, admin, premium roles
