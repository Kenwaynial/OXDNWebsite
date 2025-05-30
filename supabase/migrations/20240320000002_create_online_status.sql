-- Create online_status table
CREATE TABLE IF NOT EXISTS public.online_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('online', 'offline', 'away')),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id
CREATE INDEX IF NOT EXISTS idx_online_status_user_id ON public.online_status(user_id);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_online_status_updated_at
    BEFORE UPDATE ON public.online_status
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create RLS policies
ALTER TABLE public.online_status ENABLE ROW LEVEL SECURITY;

-- Allow users to read all online statuses
CREATE POLICY "Allow public read access"
    ON public.online_status
    FOR SELECT
    USING (true);

-- Allow users to update their own status
CREATE POLICY "Allow users to update own status"
    ON public.online_status
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Allow users to insert their own status
CREATE POLICY "Allow users to insert own status"
    ON public.online_status
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user_online_status()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.online_status (user_id, status)
    VALUES (NEW.id, 'offline');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_online_status();

-- Create online status for existing users
INSERT INTO public.online_status (user_id, status)
SELECT id, 'offline'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.online_status); 