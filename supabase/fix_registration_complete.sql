-- Complete fix for OXDN registration functionality
-- Copy and paste this entire file into Supabase SQL Editor

-- Clean up any existing problematic triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON public.profiles;
DROP TRIGGER IF EXISTS on_user_created ON public.profiles;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop ALL existing policies to recreate them properly
DROP POLICY IF EXISTS "Allow profile creation during signup" ON public.profiles;
DROP POLICY IF EXISTS "Allow user activity creation" ON public.user_activity;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own activity" ON public.user_activity;
DROP POLICY IF EXISTS "Users can update own activity" ON public.user_activity;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;

-- Ensure tables exist with proper structure
DROP TABLE IF EXISTS public.user_activity CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.user_activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    status TEXT DEFAULT 'offline',
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_logins INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Allow profile creation during signup"
ON public.profiles FOR INSERT
WITH CHECK (
    auth.uid() = id
);

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (
    auth.uid() = id
);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (
    auth.uid() = id
)
WITH CHECK (
    auth.uid() = id
);

-- Create RLS policies for user_activity
CREATE POLICY "Allow user activity creation"
ON public.user_activity FOR INSERT
WITH CHECK (
    auth.uid() = user_id
);

CREATE POLICY "Users can view own activity"
ON public.user_activity FOR SELECT
USING (
    auth.uid() = user_id
);

CREATE POLICY "Users can update own activity"
ON public.user_activity FOR UPDATE
USING (
    auth.uid() = user_id
)
WITH CHECK (
    auth.uid() = user_id
);

-- Create a simple trigger function for user activity
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create user_activity record when profile is created
    INSERT INTO public.user_activity (user_id, status, last_seen, total_logins)
    VALUES (NEW.id, 'offline', now(), 0)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create trigger on profiles table
CREATE TRIGGER on_profile_created
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT INSERT, SELECT, UPDATE ON public.profiles TO authenticated;
GRANT INSERT, SELECT, UPDATE ON public.user_activity TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_activity TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Create function to check if username exists
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
