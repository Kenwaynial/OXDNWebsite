-- Create a function to clean up unverified users
CREATE OR REPLACE FUNCTION public.cleanup_unverified_user(user_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_id UUID;
BEGIN
    -- Get the user ID from auth.users
    SELECT id INTO user_id
    FROM auth.users
    WHERE email = user_email
    AND email_confirmed_at IS NULL;

    -- If user exists and is unverified
    IF user_id IS NOT NULL THEN
        -- Delete from profiles first (due to foreign key constraint)
        DELETE FROM public.profiles
        WHERE id = user_id;

        -- Delete from auth.users
        DELETE FROM auth.users
        WHERE id = user_id;
    END IF;
END;
$$;

-- Create a function to handle registration with cleanup
CREATE OR REPLACE FUNCTION public.handle_registration(
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
    PERFORM public.cleanup_unverified_user(user_email);
    
    -- Then create the new profile
    PERFORM public.create_profile_for_user(
        auth.uid(),
        user_email,
        user_metadata
    );
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.cleanup_unverified_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_registration TO authenticated; 