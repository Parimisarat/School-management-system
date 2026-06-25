-- Migration for SMS Authentication & Authorization (Module M9 Auth integration)
-- Adds first_login column to profiles table

alter table public.profiles add column if not exists first_login boolean default true;
