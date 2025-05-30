-- Create profiles table with more comprehensive fields
create table profiles (
  id uuid references auth.users on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  bio text,
  role text default 'member',
  discord_id text,
  steam_id text,
  favorite_games text[],
  join_date timestamp with time zone default timezone('utc'::text, now()) not null,
  last_login timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (id)
);

-- Create online_status table
create table online_status (
  user_id uuid references auth.users on delete cascade,
  status text check (status in ('online', 'away', 'offline')),
  last_seen timestamp with time zone default timezone('utc'::text, now()) not null,
  current_game text,
  primary key (user_id)
);

-- Create user_stats table for tracking user activity
create table user_stats (
  user_id uuid references auth.users on delete cascade,
  games_played integer default 0,
  tournaments_won integer default 0,
  total_playtime interval default '0'::interval,
  last_activity timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id)
);

-- Enable Row Level Security
alter table profiles enable row level security;
alter table online_status enable row level security;
alter table user_stats enable row level security;

-- Create policies for profiles
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using ( true );

create policy "Users can insert their own profile"
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update their own profile"
  on profiles for update
  using ( auth.uid() = id );

-- Create policies for online_status
create policy "Online status is viewable by everyone"
  on online_status for select
  using ( true );

create policy "Users can insert their own online status"
  on online_status for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own online status"
  on online_status for update
  using ( auth.uid() = user_id );

-- Create policies for user_stats
create policy "User stats are viewable by everyone"
  on user_stats for select
  using ( true );

create policy "Users can update their own stats"
  on user_stats for update
  using ( auth.uid() = user_id );

-- Create stored procedures for stats
create or replace function increment_games_played(user_id uuid)
returns void as $$
begin
  update user_stats
  set 
    games_played = games_played + 1,
    last_activity = now()
  where user_stats.user_id = increment_games_played.user_id;
end;
$$ language plpgsql security definer;

create or replace function increment_tournaments_won(user_id uuid)
returns void as $$
begin
  update user_stats
  set 
    tournaments_won = tournaments_won + 1,
    last_activity = now()
  where user_stats.user_id = increment_tournaments_won.user_id;
end;
$$ language plpgsql security definer;

-- Create function to handle new user creation
create function public.handle_new_user()
returns trigger as $$
begin
  -- Insert into profiles
  insert into public.profiles (
    id,
    username,
    full_name,
    avatar_url,
    role
  )
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    'member'
  );
  
  -- Insert into online_status
  insert into public.online_status (
    user_id,
    status
  )
  values (
    new.id,
    'offline'
  );

  -- Insert into user_stats
  insert into public.user_stats (
    user_id
  )
  values (
    new.id
  );
  
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger for new user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user(); 