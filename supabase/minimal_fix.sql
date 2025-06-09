-- Minimal fix for OXDN registration - removes all triggers that could interfere with auth.users creation
-- Copy and paste this entire file into Supabase SQL Editor

-- Drop everything that could interfere with auth.users creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
DROP TRIGGER IF EXISTS on_user_created ON public.profiles;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow profile creation during signup" ON public.profiles;
DROP POLICY IF EXISTS "Allow user activity creation" ON public.user_activity;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own activity" ON public.user_activity;
DROP POLICY IF EXISTS "Users can update own activity" ON public.user_activity;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;

-- Drop and recreate tables completely clean
DROP TABLE IF EXISTS public.user_activity CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create minimal profiles table - NO TRIGGERS, NO AUTO-CREATION
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create ONLY the essential policy for profile creation
CREATE POLICY "Allow authenticated users to create own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Allow users to read their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Grant minimal permissions
GRANT INSERT, SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Create simple username check function
CREATE OR REPLACE FUNCTION public.check_username_exists(username_to_check TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE username = username_to_check
    );
END;
$$ language 'plpgsql' SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_username_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_username_exists(TEXT) TO anon;
