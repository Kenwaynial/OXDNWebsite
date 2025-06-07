-- Reset everything first
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role can create profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Enable profile creation during signup" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;

-- Remove any existing triggers
DROP TRIGGER IF EXISTS on_user_created ON public.profiles;
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS set_user_activity_updated_at ON public.user_activity;

-- Make sure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Create base policies for profiles
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Reset user_activity policies first
DROP POLICY IF EXISTS "Users can view any user activity" ON public.user_activity;
DROP POLICY IF EXISTS "Users can update own activity" ON public.user_activity;
DROP POLICY IF EXISTS "Allow insert on signup" ON public.user_activity;

-- Create base policies for user_activity
CREATE POLICY "Users can view any user activity"
ON public.user_activity FOR SELECT
USING (true);

CREATE POLICY "Users can update own activity"
ON public.user_activity FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow insert on signup"
ON public.user_activity FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Updated function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_activity (user_id, status)
    VALUES (NEW.id, 'offline')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create trigger for new users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Grant appropriate permissions
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.user_activity TO anon;
GRANT SELECT, INSERT, UPDATE ON public.user_activity TO authenticated;
GRANT ALL ON public.user_activity TO service_role;
