-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure the auth schema exists and has proper permissions
CREATE SCHEMA IF NOT EXISTS auth;

-- Grant necessary permissions to the auth schema
GRANT USAGE ON SCHEMA auth TO postgres, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres, authenticated, service_role;

-- Ensure the public schema has proper permissions
GRANT USAGE ON SCHEMA public TO postgres, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, authenticated, service_role;

-- Ensure the profiles table has proper permissions
ALTER TABLE public.profiles OWNER TO postgres;
GRANT ALL ON TABLE public.profiles TO postgres, authenticated, service_role;

-- Ensure the auth.users table has proper permissions
ALTER TABLE auth.users OWNER TO postgres;
GRANT ALL ON TABLE auth.users TO postgres, authenticated, service_role;

-- Create a trigger to automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, role, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    NEW.email,
    'member',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 