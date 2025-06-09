-- Fix database issues preventing user signup
-- This addresses the "Database error saving new user" problem

-- First, let's remove any problematic triggers that might be interfering
DROP TRIGGER IF EXISTS on_auth_user_created ON public.profiles;
DROP TRIGGER IF EXISTS on_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;

-- Remove any functions that might be causing issues
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Ensure the profiles table has the correct structure
-- Remove any constraints that might be causing issues
ALTER TABLE public.profiles ALTER COLUMN email_verified SET DEFAULT false;
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user';

-- Make sure there are no foreign key constraints blocking auth.users creation
-- (The profiles.id should reference auth.users.id, but shouldn't block auth user creation)

-- Reset and simplify the policies to allow signup
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile creation during signup" ON public.profiles;

-- Create a simple policy that allows authenticated users to create their own profile
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Ensure proper permissions for signup flow
GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.profiles TO anon;
GRANT INSERT ON public.profiles TO authenticated;

-- Create a simpler trigger function for after profile creation (not auth user creation)
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create user_activity record after profile is successfully created
    INSERT INTO public.user_activity (user_id, status)
    VALUES (NEW.id, 'offline')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create trigger for new profiles (not auth users)
CREATE TRIGGER on_profile_created
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_profile();
