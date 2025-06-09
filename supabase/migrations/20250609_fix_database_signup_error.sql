-- Fix database error during signup
-- The issue is likely with foreign key constraints or triggers during auth user creation

-- First, let's drop any problematic triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON public.profiles;
DROP TRIGGER IF EXISTS on_user_created ON public.profiles;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;

-- Drop the function that might be causing issues
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate a simpler function that won't cause conflicts
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create user_activity after profile exists
    INSERT INTO public.user_activity (user_id, status, last_seen, total_logins)
    VALUES (NEW.id, 'offline', now(), 0)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create trigger only on profiles table (not auth.users)
CREATE TRIGGER on_profile_created
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Ensure RLS is properly configured
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Make sure we have the right policies for signup
DROP POLICY IF EXISTS "Allow profile creation during signup" ON public.profiles;

CREATE POLICY "Allow profile creation during signup"
ON public.profiles FOR INSERT
WITH CHECK (
    -- Allow authenticated users to create their own profile
    auth.uid() = id
);

-- Allow users to create their own user_activity
DROP POLICY IF EXISTS "Allow user activity creation" ON public.user_activity;

CREATE POLICY "Allow user activity creation"
ON public.user_activity FOR INSERT
WITH CHECK (
    auth.uid() = user_id
);

-- Grant necessary permissions
GRANT INSERT ON public.profiles TO authenticated;
GRANT INSERT ON public.user_activity TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_activity TO service_role;

-- Ensure the trigger function has proper permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
