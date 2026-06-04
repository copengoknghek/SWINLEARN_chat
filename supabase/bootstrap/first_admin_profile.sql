-- Run this after applying migrations and creating your first Auth user.
-- Replace the email below with the account that should enter /admin.
-- This inserts the profile if missing, or updates it if it already exists.

insert into public.profiles (
  id,
  email,
  role,
  status,
  campus,
  must_change_password,
  full_name,
  display_name
)
select
  users.id,
  users.email,
  'admin',
  'active',
  'hanoi',
  false,
  coalesce(
    users.raw_user_meta_data->>'full_name',
    users.raw_user_meta_data->>'display_name',
    split_part(users.email, '@', 1)
  ),
  coalesce(
    users.raw_user_meta_data->>'display_name',
    users.raw_user_meta_data->>'full_name',
    split_part(users.email, '@', 1)
  )
from auth.users
where users.email = 'admin@swinburne.edu.vn'
on conflict (id) do update
set
  role = 'admin',
  status = 'active',
  campus = coalesce(public.profiles.campus, excluded.campus),
  must_change_password = false,
  full_name = coalesce(public.profiles.full_name, excluded.full_name),
  display_name = coalesce(public.profiles.display_name, excluded.display_name),
  updated_at = now();

-- Optional check: this should return one admin row.
select id, email, full_name, display_name, role, campus, status, must_change_password
from public.profiles
where role = 'admin';
