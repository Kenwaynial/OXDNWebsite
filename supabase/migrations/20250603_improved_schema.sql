-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.user_gaming_profiles CASCADE;
DROP TABLE IF EXISTS public.user_achievements CASCADE;
DROP TABLE IF EXISTS public.user_activity CASCADE;
DROP TABLE IF EXISTS public.user_stats CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create profiles table with enhanced fields
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username CITEXT UNIQUE NOT NULL,
    email CITEXT UNIQUE NOT NULL,
    display_name TEXT,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    role TEXT DEFAULT 'user'::text CHECK (role IN ('user', 'admin', 'moderator')),
    email_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- Create user_gaming_profiles table for gaming-related info
CREATE TABLE public.user_gaming_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    discord_id TEXT,
    steam_id TEXT,
    favorite_games TEXT[],
    preferred_server TEXT,
    skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create user_activity table
CREATE TABLE public.user_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away')),
    current_game TEXT,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    total_logins INTEGER DEFAULT 0,
    UNIQUE(user_id)
);

-- Create user_stats table
CREATE TABLE public.user_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    games_played INTEGER DEFAULT 0,
    tournaments_participated INTEGER DEFAULT 0,
    tournaments_won INTEGER DEFAULT 0,
    total_playtime INTERVAL DEFAULT '0'::INTERVAL,
    win_rate DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create user_achievements table
CREATE TABLE public.user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_name TEXT NOT NULL,
    achievement_description TEXT,
    achieved_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, achievement_name)
);

-- Create updated_at function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
RETURNS TRIGGER AS $$
DECLARE
    _username TEXT;
BEGIN
    -- Get username from metadata or generate from email
    _username := COALESCE(
        NEW.raw_user_meta_data->>'username',
        REGEXP_REPLACE(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g')
    );

    -- Create profile
    INSERT INTO public.profiles (id, username, email, role)
    VALUES (
        NEW.id,
        _username,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'user')
    );

    -- Create user activity record
    INSERT INTO public.user_activity (user_id, status)
    VALUES (NEW.id, 'offline');

    -- Create user stats record
    INSERT INTO public.user_stats (user_id)
    VALUES (NEW.id);

    -- Create gaming profile
    INSERT INTO public.user_gaming_profiles (user_id)
    VALUES (NEW.id);

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Error in handle_new_user_registration: %', SQLERRM;
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_user_gaming_profiles_updated_at
    BEFORE UPDATE ON public.user_gaming_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_user_stats_updated_at
    BEFORE UPDATE ON public.user_stats
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_registration();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_gaming_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- User gaming profiles policies
CREATE POLICY "Gaming profiles are viewable by everyone"
    ON public.user_gaming_profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own gaming profile"
    ON public.user_gaming_profiles FOR UPDATE
    USING (auth.uid() = user_id);

-- User activity policies
CREATE POLICY "User activity is viewable by everyone"
    ON public.user_activity FOR SELECT
    USING (true);

CREATE POLICY "Users can update own activity"
    ON public.user_activity FOR UPDATE
    USING (auth.uid() = user_id);

-- User stats policies
CREATE POLICY "User stats are viewable by everyone"
    ON public.user_stats FOR SELECT
    USING (true);

CREATE POLICY "Users can update own stats"
    ON public.user_stats FOR UPDATE
    USING (auth.uid() = user_id);

-- User achievements policies
CREATE POLICY "Achievements are viewable by everyone"
    ON public.user_achievements FOR SELECT
    USING (true);

CREATE POLICY "Only system can insert achievements"
    ON public.user_achievements FOR INSERT
    WITH CHECK (auth.uid() IN (
        SELECT id FROM public.profiles WHERE role = 'admin'
    ));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_activity_status ON public.user_activity(status);
CREATE INDEX IF NOT EXISTS idx_user_stats_tournaments_won ON public.user_stats(tournaments_won DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_games_played ON public.user_stats(games_played DESC);
