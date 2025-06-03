-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user_registration CASCADE;
DROP TABLE IF EXISTS public.user_activity CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT DEFAULT 'user'::text,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT username_unique UNIQUE (username),
    CONSTRAINT email_unique UNIQUE (email),
    CONSTRAINT role_check CHECK (role IN ('user', 'admin', 'moderator')),
    CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30),
    CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]+$'),
    CONSTRAINT email_format CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create user_activity table
CREATE TABLE public.user_activity (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'offline',
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    total_logins INTEGER DEFAULT 0,
    CONSTRAINT user_id_unique UNIQUE (user_id),
    CONSTRAINT status_check CHECK (status IN ('online', 'offline', 'away'))
);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
RETURNS TRIGGER AS $$
BEGIN
    -- Extract username from metadata or email
    INSERT INTO public.profiles (
        id,
        username,
        email,
        role,
        email_verified
    ) VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data->>'username',
            REGEXP_REPLACE(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g')
        ),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
        false
    );

    -- Create initial user activity record
    INSERT INTO public.user_activity (user_id, status)
    VALUES (NEW.id, 'offline');

    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        -- If username already exists, append random numbers
        INSERT INTO public.profiles (
            id,
            username,
            email,
            role,
            email_verified
        ) VALUES (
            NEW.id,
            COALESCE(
                NEW.raw_user_meta_data->>'username',
                REGEXP_REPLACE(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g')
            ) || '_' || floor(random() * 1000)::text,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
            false
        );
        
        INSERT INTO public.user_activity (user_id, status)
        VALUES (NEW.id, 'offline');
        
        RETURN NEW;
    WHEN OTHERS THEN
        RAISE LOG 'Error in handle_new_user_registration: %', SQLERRM;
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_registration();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own profile"
    ON public.profiles FOR DELETE
    USING (auth.uid() = id);

CREATE POLICY "User activity is viewable by everyone"
    ON public.user_activity FOR SELECT
    USING (true);

CREATE POLICY "Users can update own activity"
    ON public.user_activity FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity"
    ON public.user_activity FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX profiles_username_idx ON public.profiles(username);
CREATE INDEX profiles_email_idx ON public.profiles(email);
CREATE INDEX profiles_role_idx ON public.profiles(role);
CREATE INDEX user_activity_status_idx ON public.user_activity(status);
CREATE INDEX user_activity_last_seen_idx ON public.user_activity(last_seen);

-- Function to increment login count
CREATE OR REPLACE FUNCTION public.increment_total_logins(user_id uuid)
RETURNS void AS $$
BEGIN
    INSERT INTO public.user_activity (user_id, total_logins, status, last_seen)
    VALUES (user_id, 1, 'online', NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET 
        total_logins = public.user_activity.total_logins + 1,
        status = 'online',
        last_seen = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
