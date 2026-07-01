-- Migration to add student onboarding & profile fields for Module M3
-- To be run in the Supabase SQL Editor

-- 1. Add fields to public.students table
alter table public.students add column if not exists house text;
alter table public.students add column if not exists photo_url text;
alter table public.students add column if not exists nationality text default 'Indian';
alter table public.students add column if not exists religion text;
alter table public.students add column if not exists mother_tongue text;
alter table public.students add column if not exists aadhaar_number text;
alter table public.students add column if not exists father_name text;
alter table public.students add column if not exists mother_name text;
alter table public.students add column if not exists emergency_contact_name text;
alter table public.students add column if not exists emergency_contact_relationship text;
alter table public.students add column if not exists emergency_contact_phone text;
alter table public.students add column if not exists current_address text;
alter table public.students add column if not exists permanent_address text;
alter table public.students add column if not exists academic_year text default '2025-26';
alter table public.students add column if not exists is_active boolean default true;

-- 2. Create storage bucket for student photos
insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', true)
on conflict (id) do nothing;

-- 3. Set up storage security policies for student-photos bucket
drop policy if exists "Allow public read access to student-photos bucket" on storage.objects;
create policy "Allow public read access to student-photos bucket"
    on storage.objects for select
    using (bucket_id = 'student-photos');

drop policy if exists "Allow authenticated manage access to student-photos bucket" on storage.objects;
create policy "Allow authenticated manage access to student-photos bucket"
    on storage.objects for all
    using (bucket_id = 'student-photos' and auth.role() = 'authenticated');

-- 4. Enable pgcrypto for password hashing in Postgres
create extension if not exists pgcrypto;

-- 5. Create secure database function to register users without logging admin out
create or replace function public.create_user_in_auth(
    p_email text,
    p_password text,
    p_first_name text,
    p_last_name text,
    p_school_id uuid,
    p_role text
) returns uuid as $$
declare
    v_user_id uuid;
begin
    -- 1. Insert into auth.users (minimum required fields)
    insert into auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        is_sso_user
    ) values (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        p_email,
        crypt(p_password, gen_salt('bf', 10)),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('first_name', p_first_name, 'last_name', p_last_name, 'school_id', p_school_id),
        now(),
        now(),
        false
    ) returning id into v_user_id;

    -- 2. Create profile
    insert into public.profiles (id, school_id, first_name, last_name, created_at, updated_at, first_login)
    values (v_user_id, p_school_id, p_first_name, p_last_name, now(), now(), true);

    -- 3. Assign role
    insert into public.user_roles (school_id, profile_id, role)
    values (p_school_id, v_user_id, p_role);

    return v_user_id;
end;
$$ language plpgsql security definer;
