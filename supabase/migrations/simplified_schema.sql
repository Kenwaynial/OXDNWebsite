-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.online_status CASCADE;
DROP TABLE IF EXISTS public.user_stats CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.user_activity CASCADE;

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user'::text,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create combined user_activity table (combines online_status and user_stats)
CREATE TABLE public.user_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Online status fields
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away')),
    last_seen TIMESTAMPTZ DEFAULT NOW(),    -- Stats fields
    total_logins INTEGER DEFAULT 0,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_user_activity_updated_at
    BEFORE UPDATE ON public.user_activity
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    _username TEXT;
BEGIN
    -- Get username from metadata or generate from email
    _username := COALESCE(
        NEW.raw_user_meta_data->>'username',
        REGEXP_REPLACE(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g')
    );

    -- Check if username exists
    IF EXISTS (SELECT 1 FROM public.profiles WHERE username = _username) THEN
        RAISE EXCEPTION 'Username % is already taken', _username;
    END IF;

    -- Create profile
    INSERT INTO public.profiles (id, username, email)
    VALUES (
        NEW.id,
        _username,
        NEW.email
    );

    -- Create user activity record with initial values
    INSERT INTO public.user_activity (user_id, status, total_logins)
    VALUES (NEW.id, 'offline', 0);

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error (you can see this in Supabase logs)
        RAISE LOG 'Error in handle_new_user: %', SQLERRM;
        RETURN NULL; -- Prevents the user creation
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Create function to update online status
CREATE OR REPLACE FUNCTION public.update_user_status(user_id UUID, new_status TEXT)
RETURNS json AS $$
BEGIN
    RETURN jsonb_build_object(
        'status', new_status,
        'last_seen', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to increment login count
CREATE OR REPLACE FUNCTION public.increment_total_logins(user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.user_activity
    SET 
        total_logins = total_logins + 1,
        last_seen = NOW(),
        status = 'online'
    WHERE user_activity.user_id = increment_total_logins.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Allow trigger to insert profile"
    ON public.profiles FOR INSERT
    WITH CHECK (true);

-- User activity policies
CREATE POLICY "User activity is viewable by everyone"
    ON public.user_activity FOR SELECT
    USING (true);

CREATE POLICY "Users can update own activity"
    ON public.user_activity FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Allow trigger to insert user activity"
    ON public.user_activity FOR INSERT
    WITH CHECK (true);

-- Ensure the trigger has proper permissions
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_activity TO authenticated;
GRANT ALL ON public.user_activity TO service_role;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON public.user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_status ON public.user_activity(status);
