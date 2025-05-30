-- Create user_stats table
CREATE TABLE IF NOT EXISTS public.user_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_activity TIMESTAMPTZ NOT NULL DEFAULT now(),
    total_logins INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS user_stats_user_id_idx ON public.user_stats(user_id);
CREATE INDEX IF NOT EXISTS user_stats_last_activity_idx ON public.user_stats(last_activity);

-- Add trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION public.handle_user_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_user_stats_updated_at
    BEFORE UPDATE ON public.user_stats
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_stats_updated_at();

-- Add RLS policies
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own stats
CREATE POLICY "Users can view own stats"
    ON public.user_stats
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow users to update their own stats
CREATE POLICY "Users can update own stats"
    ON public.user_stats
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Function to create user stats on new user
CREATE OR REPLACE FUNCTION public.handle_new_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_stats (user_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user stats on new user
CREATE TRIGGER on_auth_user_created_stats
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_stats(); 