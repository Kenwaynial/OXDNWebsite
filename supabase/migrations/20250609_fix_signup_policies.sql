-- Fix policies to allow profile creation during signup
-- This allows the registration flow to work without service role

-- Add policy to allow profile creation during signup process
DROP POLICY IF EXISTS "Allow profile creation during signup" ON public.profiles;

CREATE POLICY "Allow profile creation during signup"
ON public.profiles FOR INSERT
WITH CHECK (
    -- Allow authenticated users to create their own profile during signup
    auth.uid() = id
);

-- Grant necessary permissions
GRANT INSERT ON public.profiles TO authenticated;
