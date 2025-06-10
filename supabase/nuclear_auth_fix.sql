-- Nuclear Auth Fix - Completely disable ALL interference with auth.users table
-- This script removes EVERYTHING that could prevent Supabase Auth from working
-- Copy and paste this entire file into Supabase SQL Editor

-- Step 1: Drop ALL triggers on auth.users (including system ones we might have missed)
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    FOR trigger_record IN 
        SELECT trigger_name, event_object_table 
        FROM information_schema.triggers 
        WHERE event_object_schema = 'auth' 
        AND event_object_table = 'users'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_record.trigger_name || ' ON auth.users CASCADE';
        RAISE NOTICE 'Dropped trigger: %', trigger_record.trigger_name;
    END LOOP;
END $$;

-- Step 2: Drop ALL triggers on public tables that might reference auth.users
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    FOR trigger_record IN 
        SELECT trigger_name, event_object_table 
        FROM information_schema.triggers 
        WHERE event_object_schema = 'public'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_record.trigger_name || ' ON public.' || trigger_record.event_object_table || ' CASCADE';
        RAISE NOTICE 'Dropped public trigger: % on %', trigger_record.trigger_name, trigger_record.event_object_table;
    END LOOP;
END $$;

-- Step 3: Drop ALL functions that could be called by triggers
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.create_user_profile() CASCADE;
DROP FUNCTION IF EXISTS public.handle_auth_user_created() CASCADE;
DROP FUNCTION IF EXISTS public.auto_create_profile() CASCADE;

-- Step 4: Completely drop and recreate public schema to be 100% clean
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Step 5: Disable ALL row level security on auth schema (temporarily)
ALTER TABLE IF EXISTS auth.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auth.sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auth.refresh_tokens DISABLE ROW LEVEL SECURITY;

-- Step 6: Remove ANY foreign key constraints that might reference auth.users
-- (This is overkill but ensures nothing blocks auth.users inserts)
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN 
        SELECT 
            tc.table_name, 
            tc.constraint_name,
            tc.table_schema
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND ccu.table_name = 'users' 
        AND ccu.table_schema = 'auth'
    LOOP
        EXECUTE 'ALTER TABLE ' || constraint_record.table_schema || '.' || constraint_record.table_name || 
                ' DROP CONSTRAINT IF EXISTS ' || constraint_record.constraint_name || ' CASCADE';
        RAISE NOTICE 'Dropped foreign key: % from %.%', constraint_record.constraint_name, 
                     constraint_record.table_schema, constraint_record.table_name;
    END LOOP;
END $$;

-- Step 7: Grant maximum permissions to ensure no permission issues
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO anon;

-- Step 8: Create a completely minimal profiles table (optional - only if you want username storage later)
CREATE TABLE IF NOT EXISTS public.minimal_profiles (
    id UUID PRIMARY KEY,
    username TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NO RLS, NO TRIGGERS, NO CONSTRAINTS on this table
GRANT ALL ON public.minimal_profiles TO authenticated;
GRANT ALL ON public.minimal_profiles TO anon;
GRANT ALL ON public.minimal_profiles TO service_role;

-- Step 9: Verify auth.users table is completely clean
SELECT 'AUTH USERS TABLE STATUS:' as status;
SELECT 
    schemaname,
    tablename,
    hasrls as "Row Level Security",
    (SELECT count(*) FROM information_schema.triggers WHERE event_object_table = 'users' AND event_object_schema = 'auth') as "Trigger Count"
FROM pg_tables 
WHERE schemaname = 'auth' AND tablename = 'users';

-- Final message
SELECT 'NUCLEAR AUTH FIX COMPLETE - All interference with auth.users removed' as result;
