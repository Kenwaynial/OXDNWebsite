-- Create function to increment total_logins
CREATE OR REPLACE FUNCTION public.increment_total_logins(user_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO public.user_stats (user_id, total_logins, last_activity)
  VALUES (
    increment_total_logins.user_id,
    1,
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_logins = user_stats.total_logins + 1,
    last_activity = now(),
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
