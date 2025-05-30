-- Add email_verified column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Update the create_profile_for_user function to handle email verification
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

-- Create a function to update email verification status
CREATE OR REPLACE FUNCTION public.update_email_verification_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
        UPDATE public.profiles
        SET email_verified = TRUE,
            updated_at = NOW()
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger to update email verification status
DROP TRIGGER IF EXISTS on_auth_user_email_verified ON auth.users;
CREATE TRIGGER on_auth_user_email_verified
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_email_verification_status();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.create_profile_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_email_verification_status TO authenticated; 