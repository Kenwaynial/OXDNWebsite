-- Create helper functions for checking email and username existence
CREATE OR REPLACE FUNCTION public.check_email_exists(email_to_check TEXT)
RETURNS TABLE (
    email TEXT,
    email_verified BOOLEAN
) SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT p.email, p.email_verified
    FROM public.profiles p
    WHERE p.email = email_to_check;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.check_username_exists(username_to_check TEXT)
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE username = username_to_check
    );
END;
$$ LANGUAGE plpgsql;
