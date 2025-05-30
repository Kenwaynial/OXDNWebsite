-- Drop existing policies
DROP POLICY IF EXISTS "Allow public read access" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read access" ON public.user_stats;
DROP POLICY IF EXISTS "Allow users to update own stats" ON public.user_stats;
DROP POLICY IF EXISTS "Allow public read access" ON public.online_status;
DROP POLICY IF EXISTS "Allow users to update own status" ON public.online_status;

-- Create new policies for profiles
CREATE POLICY "Enable read access for all users"
    ON public.profiles
    FOR SELECT
    USING (true);

CREATE POLICY "Enable insert for authenticated users only"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users based on id"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- Create new policies for user_stats
CREATE POLICY "Enable read access for all users"
    ON public.user_stats
    FOR SELECT
    USING (true);

CREATE POLICY "Enable insert for authenticated users only"
    ON public.user_stats
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for users based on user_id"
    ON public.user_stats
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Create new policies for online_status
CREATE POLICY "Enable read access for all users"
    ON public.online_status
    FOR SELECT
    USING (true);

CREATE POLICY "Enable insert for authenticated users only"
    ON public.online_status
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for users based on user_id"
    ON public.online_status
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;

GRANT SELECT ON public.user_stats TO authenticated;
GRANT SELECT ON public.user_stats TO anon;
GRANT INSERT, UPDATE ON public.user_stats TO authenticated;

GRANT SELECT ON public.online_status TO authenticated;
GRANT SELECT ON public.online_status TO anon;
GRANT INSERT, UPDATE ON public.online_status TO authenticated; 