-- Drop existing functions first
DROP FUNCTION IF EXISTS public.handle_registration;
DROP FUNCTION IF EXISTS public.create_profile_for_user;

-- Drop and recreate profiles table
DROP TABLE IF EXISTS public.profiles;

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user',
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the create_profile_for_user function
CREATE OR REPLACE FUNCTION public.create_profile_for_user(
    user_id UUID,
    user_email TEXT,
    user_metadata JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        email,
        username,
        display_name,
        email_verified,
        created_at,
        updated_at
    )
    VALUES (
        user_id,
        user_email,
        user_metadata->>'username',
        COALESCE(user_metadata->>'display_name', user_metadata->>'username'),
        FALSE,
        NOW(),
        NOW()
    )
    ON CONFLICT (email) DO UPDATE
    SET 
        username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        updated_at = NOW()
    WHERE profiles.email_verified = FALSE;
END;
$$;

-- Create the handle_registration function
CREATE OR REPLACE FUNCTION public.handle_registration(
    user_id UUID,
    user_email TEXT,
    user_metadata JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- First try to clean up any existing unverified user
    DELETE FROM public.profiles
    WHERE email = user_email
    AND email_verified = FALSE;
    
    -- Then create the new profile
    PERFORM public.create_profile_for_user(
        user_id,
        user_email,
        user_metadata
    );
END;
$$;

-- Create RLS policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.create_profile_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_registration TO authenticated; 