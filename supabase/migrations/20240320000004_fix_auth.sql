-- Drop the trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create a function to handle profile creation
CREATE OR REPLACE FUNCTION public.create_profile_for_user(user_id UUID, user_email TEXT, user_metadata JSONB)
RETURNS void AS $$
DECLARE
    base_username TEXT;
    final_username TEXT;
    counter INTEGER := 0;
BEGIN
    -- Get the base username from metadata or use email prefix
    base_username := COALESCE(user_metadata->>'username', split_part(user_email, '@', 1));
    
    -- Try to use the base username first
    final_username := base_username;
    
    -- If username exists, append a number until we find an available one
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
        counter := counter + 1;
        final_username := base_username || counter::TEXT;
    END LOOP;

    -- Insert the profile with the unique username
    INSERT INTO public.profiles (
        id,
        username,
        email,
        role,
        created_at,
        updated_at
    )
    VALUES (
        user_id,
        final_username,
        user_email,
        'member',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_profile_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile_for_user TO service_role;

-- Drop all existing policies for the profiles table
DO $$ 
BEGIN
    -- Drop policies if they exist
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
    DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
    DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;
END $$;

-- Create new policies
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id); 