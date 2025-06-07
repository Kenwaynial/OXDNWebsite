-- Remove user_stats table since it's not being used
DROP TABLE IF EXISTS public.user_stats;

-- Remove unused fields from profiles table
ALTER TABLE public.profiles 
    DROP COLUMN IF EXISTS discord_id,
    DROP COLUMN IF EXISTS steam_id,
    DROP COLUMN IF EXISTS favorite_games;

-- Update comment on the table to reflect current schema
COMMENT ON TABLE public.profiles IS 'Holds user profile information with essential fields only';

-- Update comment on user_activity table to clarify its purpose
COMMENT ON TABLE public.user_activity IS 'Tracks user online status and login activity';

-- Add a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Ensure the updated_at trigger exists
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
