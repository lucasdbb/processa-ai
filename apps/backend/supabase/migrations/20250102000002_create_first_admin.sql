-- =====================================================
-- CREATE FIRST ADMIN USER
-- =====================================================
-- Description: Creates the first admin user for the platform
-- Usage: Execute this migration after running initial_schema.sql
--        and replace the email/password with your credentials
-- =====================================================

-- IMPORTANT: Replace these values before executing!
-- Email: Change to your desired admin email
-- Password: Change to a strong password (will be hashed by Supabase)

DO $$
DECLARE
    admin_email TEXT := 'admin@processa.ai';  -- CHANGE THIS
    admin_password TEXT := 'ChangeMe123!';    -- CHANGE THIS
    admin_full_name TEXT := 'Administrador';  -- CHANGE THIS
    new_user_id UUID;
BEGIN
    -- Create user in auth.users using Supabase Auth API
    -- Note: This uses the Supabase admin API to create the user
    -- The password will be hashed automatically

    -- Since we can't directly insert into auth.users via SQL (managed by Supabase),
    -- we need to use one of these methods:
    -- 1. Register via API endpoint (recommended)
    -- 2. Use Supabase Dashboard > Authentication > Users > "Add User"
    -- 3. Use Supabase Admin API

    -- For now, we'll just prepare the profile update query
    -- You must first create the user via one of the methods above

    RAISE NOTICE 'To create the first admin user:';
    RAISE NOTICE '1. Go to Supabase Dashboard > Authentication > Users';
    RAISE NOTICE '2. Click "Add User"';
    RAISE NOTICE '3. Fill in:';
    RAISE NOTICE '   - Email: %', admin_email;
    RAISE NOTICE '   - Password: (your secure password)';
    RAISE NOTICE '   - User Metadata: {"full_name": "%", "role": "admin"}', admin_full_name;
    RAISE NOTICE '4. Or use the backend API: POST /api/auth/register';
    RAISE NOTICE '5. Then run this to promote to admin:';
    RAISE NOTICE '   UPDATE public.profiles SET role = ''admin'' WHERE email = ''%'';', admin_email;

END $$;

-- =====================================================
-- ALTERNATIVE: Promote existing user to admin
-- =====================================================
-- If you already registered a user and want to make them admin,
-- uncomment and run this query (replace the email):

-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE email = 'your-email@example.com';

-- Verify admin users
-- SELECT id, email, full_name, role, created_at
-- FROM public.profiles
-- WHERE role = 'admin';
