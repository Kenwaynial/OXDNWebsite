-- Disable triggers temporarily
ALTER TABLE public.online_status DISABLE TRIGGER ALL;
ALTER TABLE public.user_stats DISABLE TRIGGER ALL;
ALTER TABLE public.profiles DISABLE TRIGGER ALL;

-- Delete data from tables in correct order to respect foreign key constraints
DELETE FROM public.online_status;
DELETE FROM public.user_stats;
DELETE FROM public.profiles;

-- Reset all serial sequences
ALTER SEQUENCE IF EXISTS public.user_stats_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.online_status_id_seq RESTART WITH 1;

-- Re-enable triggers
ALTER TABLE public.online_status ENABLE TRIGGER ALL;
ALTER TABLE public.user_stats ENABLE TRIGGER ALL;
ALTER TABLE public.profiles ENABLE TRIGGER ALL;
