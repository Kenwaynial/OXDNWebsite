-- Enable profile creation by service role during signup
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;

CREATE POLICY "Service role can manage all profiles"
ON public.profiles
TO service_role
USING (true)
WITH CHECK (true);

-- Ensure proper role assignments
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Update the insert policy to be more specific
DROP POLICY IF EXISTS "Enable profile creation during signup" ON public.profiles;

CREATE POLICY "Enable profile creation during signup"
ON public.profiles 
FOR INSERT 
WITH CHECK (
    -- Allow service role to create profiles (for signup process)
    auth.role() = 'service_role' 
    OR 
    -- Allow authenticated users to create their own profile
    (auth.role() = 'authenticated' AND auth.uid() = id)
);
