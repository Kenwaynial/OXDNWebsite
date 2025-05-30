-- Drop existing functions
DROP FUNCTION IF EXISTS public.handle_registration;
DROP FUNCTION IF EXISTS public.create_profile_for_user;

-- Create the create_profile_for_user function
CREATE OR REPLACE FUNCTION public.create_profile_for_user(
    user_id UUID,
    user_email TEXT,
    user_metadata JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        email,
        username,
        email_verified,
        created_at,
        updated_at
    )
    VALUES (
        user_id,
        user_email,
        user_metadata->>'username',
        FALSE,
        NOW(),
        NOW()
    )
    ON CONFLICT (email) DO UPDATE
    SET 
        username = EXCLUDED.username,
        updated_at = NOW()
    WHERE profiles.email_verified = FALSE;
END;
$$;

-- Create the handle_registration function
CREATE OR REPLACE FUNCTION public.handle_registration(
    user_id UUID,
    user_email TEXT,
    user_metadata JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- First try to clean up any existing unverified user
    DELETE FROM public.profiles
    WHERE email = user_email
    AND email_verified = FALSE;
    
    -- Then create the new profile
    PERFORM public.create_profile_for_user(
        user_id,
        user_email,
        user_metadata
    );
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.create_profile_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_registration TO authenticated; 