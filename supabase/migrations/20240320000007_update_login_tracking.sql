-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.increment_total_logins(uuid);

-- Create function to increment total_logins and update last_activity
CREATE OR REPLACE FUNCTION public.increment_total_logins(user_id uuid)
RETURNS json AS $$
DECLARE
    updated_record json;
BEGIN
    INSERT INTO public.user_stats (user_id, total_logins, last_activity)
    VALUES (
        user_id,
        1,
        now()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        total_logins = user_stats.total_logins + 1,
        last_activity = now(),
        updated_at = now()
    RETURNING jsonb_build_object(
        'total_logins', total_logins,
        'last_activity', last_activity
    ) INTO updated_record;

    RETURN updated_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
