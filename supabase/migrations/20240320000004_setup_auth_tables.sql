-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_stats table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_logins INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create online_status table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.online_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('online', 'offline', 'away')),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_user_stats_updated_at ON public.user_stats;
CREATE TRIGGER set_user_stats_updated_at
    BEFORE UPDATE ON public.user_stats
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_online_status_updated_at ON public.online_status;
CREATE TRIGGER set_online_status_updated_at
    BEFORE UPDATE ON public.online_status
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_status ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
DROP POLICY IF EXISTS "Allow public read access" ON public.profiles;
CREATE POLICY "Allow public read access"
    ON public.profiles
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;
CREATE POLICY "Allow users to update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- Create RLS policies for user_stats
DROP POLICY IF EXISTS "Allow public read access" ON public.user_stats;
CREATE POLICY "Allow public read access"
    ON public.user_stats
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow users to update own stats" ON public.user_stats;
CREATE POLICY "Allow users to update own stats"
    ON public.user_stats
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Create RLS policies for online_status
DROP POLICY IF EXISTS "Allow public read access" ON public.online_status;
CREATE POLICY "Allow public read access"
    ON public.online_status
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow users to update own status" ON public.online_status;
CREATE POLICY "Allow users to update own status"
    ON public.online_status
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create profile
    INSERT INTO public.profiles (id, username, email)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'username',
        NEW.email
    );

    -- Create user stats
    INSERT INTO public.user_stats (user_id)
    VALUES (NEW.id);

    -- Create online status
    INSERT INTO public.online_status (user_id, status)
    VALUES (NEW.id, 'offline');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user(); 