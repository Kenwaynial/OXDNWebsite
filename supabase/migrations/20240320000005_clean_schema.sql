-- Drop existing tables and functions
DROP TABLE IF EXISTS public.online_status CASCADE;
DROP TABLE IF EXISTS public.user_stats CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP FUNCTION IF EXISTS public.create_profile_for_user CASCADE;

-- Create profiles table
CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text NOT NULL UNIQUE,
    email text NOT NULL UNIQUE,
    role text NOT NULL DEFAULT 'member'::text,
    avatar_url text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- Create function to handle profile creation
CREATE OR REPLACE FUNCTION public.create_profile_for_user(user_id UUID, user_email TEXT, user_metadata JSONB)
RETURNS void AS $$
DECLARE
    base_username TEXT;
    final_username TEXT;
    counter INTEGER := 0;
BEGIN
    -- Get the base username from metadata or use email prefix
    base_username := COALESCE(user_metadata->>'username', split_part(user_email, '@', 1));
    
    -- Try to use the base username first
    final_username := base_username;
    
    -- If username exists, append a number until we find an available one
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
        counter := counter + 1;
        final_username := base_username || counter::TEXT;
    END LOOP;

    -- Insert the profile with the unique username
    INSERT INTO public.profiles (
        id,
        username,
        email,
        role,
        created_at,
        updated_at
    )
    VALUES (
        user_id,
        final_username,
        user_email,
        'member',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_profile_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile_for_user TO service_role;

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
    DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
END $$;

-- Create policies
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id); 