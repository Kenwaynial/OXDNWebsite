-- Drop the problematic policy
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;

-- Create a new policy that allows profile creation during signup
CREATE POLICY "Enable profile creation during signup"
ON public.profiles FOR INSERT WITH CHECK (
    -- Allow service role to create profiles
    auth.role() = 'service_role' 
    OR 
    -- Or allow authenticated users to create their own profile
    (auth.role() = 'authenticated' AND auth.uid() = id)
);

-- Ensure service role has proper permissions
GRANT ALL ON public.profiles TO service_role;
