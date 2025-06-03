-- Drop existing triggers
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_profile_created on public.profiles;

-- Clean up any existing functions
drop function if exists public.handle_new_user();
drop function if exists public.check_username_availability();
drop function if exists public.initialize_user_profile();

-- Create schema for profile management
create schema if not exists profile_manager;

-- Create username check function
create or replace function profile_manager.check_username_availability(username text)
returns boolean as $$
begin
  return not exists (
    select 1 from public.profiles
    where lower(profiles.username) = lower(username)
  );
end;
$$ language plpgsql security definer;

-- Create profile initialization function
create or replace function profile_manager.initialize_user_profile()
returns trigger as $$
begin
  -- Create profile
  insert into public.profiles (
    id,
    username,
    email,
    role,
    email_verified,
    created_at,
    updated_at
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    'user',
    false,
    now(),
    now()
  );

  -- Initialize user activity
  insert into public.user_activity (
    user_id,
    status,
    last_seen,
    total_logins
  ) values (
    new.id,
    'offline',
    now(),
    0
  );

  return new;
end;
$$ language plpgsql security definer;

-- Create registration trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function profile_manager.initialize_user_profile();

-- Create RPC function for registration checks
create or replace function profile_manager.validate_registration(
  username text,
  email text
) returns json as $$
declare
  result json;
begin
  -- Check username format
  if length(username) < 3 or length(username) > 30 then
    return json_build_object(
      'valid', false,
      'message', 'Username must be between 3 and 30 characters'
    );
  end if;

  -- Check username characters
  if not username ~ '^[a-zA-Z0-9_]+$' then
    return json_build_object(
      'valid', false,
      'message', 'Username can only contain letters, numbers, and underscores'
    );
  end if;

  -- Check if username exists
  if not profile_manager.check_username_availability(username) then
    return json_build_object(
      'valid', false,
      'message', 'Username is already taken'
    );
  end if;

  -- Check email format
  if not email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    return json_build_object(
      'valid', false,
      'message', 'Invalid email format'
    );
  end if;

  -- Check if email exists
  if exists (select 1 from public.profiles where profiles.email = email) then
    return json_build_object(
      'valid', false,
      'message', 'Email is already registered'
    );
  end if;

  -- All checks passed
  return json_build_object(
    'valid', true,
    'message', 'Validation successful'
  );
end;
$$ language plpgsql security definer;

-- Add row level security
alter table public.profiles enable row level security;

-- Create policies
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Grant permissions
grant usage on schema profile_manager to anon, authenticated;
grant execute on function profile_manager.validate_registration to anon;
grant execute on function profile_manager.check_username_availability to anon;
