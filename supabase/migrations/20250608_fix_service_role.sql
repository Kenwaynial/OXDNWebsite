-- Add specific service role policy
DROP POLICY IF EXISTS "Service role bypass RLS" ON public.profiles;
CREATE POLICY "Service role bypass RLS"
ON public.profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Make sure we have the right permissions
ALTER TABLE public.profiles OWNER TO postgres;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.profiles TO postgres;
GRANT ALL ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- Reset the auth.users permissions
GRANT ALL ON auth.users TO service_role;
GRANT ALL ON auth.users TO postgres;
