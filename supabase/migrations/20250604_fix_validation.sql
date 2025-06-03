-- Drop and recreate the validate_registration function
DROP FUNCTION IF EXISTS public.validate_registration(text, text);

CREATE OR REPLACE FUNCTION public.validate_registration(
    input_username text,
    input_email text
) RETURNS json AS $$
BEGIN
    -- Check username format
    IF length(input_username) < 3 OR length(input_username) > 30 THEN
        RETURN json_build_object(
            'valid', false,
            'message', 'Username must be between 3 and 30 characters'
        );
    END IF;

    -- Check username characters
    IF NOT input_username ~ '^[a-zA-Z0-9_]+$' THEN
        RETURN json_build_object(
            'valid', false,
            'message', 'Username can only contain letters, numbers, and underscores'
        );
    END IF;

    -- Check if username exists
    IF EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE lower(profiles.username) = lower(input_username)
    ) THEN
        RETURN json_build_object(
            'valid', false,
            'message', 'Username is already taken'
        );
    END IF;

    -- Check email format
    IF NOT input_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RETURN json_build_object(
            'valid', false,
            'message', 'Invalid email format'
        );
    END IF;

    -- Check if email exists
    IF EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE lower(profiles.email) = lower(input_email)
    ) THEN
        RETURN json_build_object(
            'valid', false,
            'message', 'Email is already registered'
        );
    END IF;

    -- All checks passed
    RETURN json_build_object(
        'valid', true,
        'message', 'Validation successful'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.validate_registration(text, text) TO anon, authenticated;
