-- Create trigger to automatically create user_activity record
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create user activity record
    INSERT INTO public.user_activity (user_id, status)
    VALUES (NEW.id, 'offline')
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_user_created ON public.profiles;
CREATE TRIGGER on_user_created
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
