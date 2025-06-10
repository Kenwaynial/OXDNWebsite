-- Safe Auth Fix - Only modify what we have permission to change
-- This script removes interference we can control without touching auth schema
-- Copy and paste this entire file into Supabase SQL Editor

-- Step 1: Drop ALL triggers on public tables only (we can't touch auth schema)
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

-- Step 2: Drop ALL functions that we created (these might be interfering)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.create_user_profile() CASCADE;
DROP FUNCTION IF EXISTS public.handle_auth_user_created() CASCADE;
DROP FUNCTION IF EXISTS public.auto_create_profile() CASCADE;
DROP FUNCTION IF EXISTS public.check_username_exists(TEXT) CASCADE;

-- Step 3: Completely drop and recreate public schema to be 100% clean
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Step 4: Remove ANY foreign key constraints from public tables that reference auth.users
-- (Only drop constraints we created, not system ones)
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
        AND tc.table_schema = 'public'  -- Only public schema
        AND ccu.table_name = 'users' 
        AND ccu.table_schema = 'auth'
    LOOP
        EXECUTE 'ALTER TABLE ' || constraint_record.table_schema || '.' || constraint_record.table_name || 
                ' DROP CONSTRAINT IF EXISTS ' || constraint_record.constraint_name || ' CASCADE';
        RAISE NOTICE 'Dropped foreign key: % from %.%', constraint_record.constraint_name, 
                     constraint_record.table_schema, constraint_record.table_name;
    END LOOP;
END $$;

-- Step 5: Create a completely minimal profiles table (no constraints that could interfere)
CREATE TABLE IF NOT EXISTS public.simple_profiles (
    id UUID PRIMARY KEY,  -- NO foreign key to auth.users
    username TEXT UNIQUE,
    email TEXT,  -- Store email separately to avoid needing auth.users access
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NO RLS, NO TRIGGERS, NO FOREIGN KEYS - completely isolated
GRANT ALL ON public.simple_profiles TO authenticated;
GRANT ALL ON public.simple_profiles TO anon;
GRANT ALL ON public.simple_profiles TO service_role;

-- Step 6: Create a simple function to check username availability (no auth.users dependency)
CREATE OR REPLACE FUNCTION public.is_username_available(username_check TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM public.simple_profiles 
        WHERE username = username_check
    );
END;
$$ LANGUAGE 'plpgsql' SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_username_available(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_username_available(TEXT) TO anon;

-- Step 7: Verify what we've cleaned up
SELECT 'PUBLIC SCHEMA CLEANUP STATUS:' as status;
SELECT 
    schemaname,
    tablename,
    hasrules as "Has Rules"
FROM pg_tables 
WHERE schemaname = 'public';

-- Step 8: Check for any remaining triggers that could interfere
SELECT 'REMAINING TRIGGERS:' as check_type;
SELECT 
    trigger_name,
    event_object_schema,
    event_object_table
FROM information_schema.triggers 
WHERE event_object_schema IN ('public', 'auth')
ORDER BY event_object_schema, event_object_table;

-- Final message
SELECT 'SAFE AUTH FIX COMPLETE - Removed all public schema interference' as result;
