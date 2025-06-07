-- Base schema for OXDN Website
-- Created: 2025-06-08

-- Create profiles table with essential fields only
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL,
    username text NOT NULL UNIQUE,
    email text NOT NULL UNIQUE,
    display_name text,
    avatar_url text,
    role text DEFAULT 'user'::text,
    email_verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- Create user activity tracking table
CREATE TABLE IF NOT EXISTS public.user_activity (
    user_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'offline'::text,
    last_seen timestamp with time zone DEFAULT now(),
    total_logins integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_activity_pkey PRIMARY KEY (user_id),
    CONSTRAINT user_activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- Add table comments
COMMENT ON TABLE public.profiles IS 'Holds user profile information with essential fields only';
COMMENT ON TABLE public.user_activity IS 'Tracks user online status and login activity';

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at timestamp
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_user_activity_updated_at ON public.user_activity;
CREATE TRIGGER set_user_activity_updated_at
    BEFORE UPDATE ON public.user_activity
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
