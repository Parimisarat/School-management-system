-- Migration to create custom schema m3_m4 for Modules 3 & 4
-- This isolates Module 3 & 4 data structures from the default public schema used by other team members

-- 1. Create the m3_m4 schema
create schema if not exists m3_m4;

-- 2. Create the students table in m3_m4 schema
create table if not exists m3_m4.students (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    profile_id uuid references public.profiles(id) on delete set null,
    class_id uuid not null references public.classes(id) on delete restrict,
    section_id uuid not null references public.sections(id) on delete restrict,
    admission_number text not null,
    roll_number text,
    parent_id uuid references public.profiles(id) on delete set null,
    date_of_birth date not null,
    gender text check (gender in ('Male', 'Female', 'Other')),
    blood_group text,
    house text,
    photo_url text,
    nationality text default 'Indian',
    religion text,
    mother_tongue text,
    aadhaar_number text,
    father_name text,
    mother_name text,
    emergency_contact_name text,
    emergency_contact_relationship text,
    emergency_contact_phone text,
    current_address text,
    permanent_address text,
    academic_year text default '2025-26',
    is_active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (school_id, admission_number)
);

-- 3. Create the attendance table in m3_m4 schema
create table if not exists m3_m4.attendance (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    student_id uuid not null references m3_m4.students(id) on delete cascade,
    date date not null,
    status text not null check (status in ('Present', 'Absent', 'Late', 'Half Day')),
    remarks text,
    marked_by uuid not null references public.profiles(id) on delete restrict,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (student_id, date)
);

-- 4. Create the homework table in m3_m4 schema
create table if not exists m3_m4.homework (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    class_id uuid not null references public.classes(id) on delete cascade,
    section_id uuid not null references public.sections(id) on delete cascade,
    subject text not null,
    title text not null,
    description text,
    attachment_url text,
    due_date timestamp with time zone not null,
    created_by uuid not null references public.profiles(id) on delete restrict,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Create the homework_submissions table in m3_m4 schema
create table if not exists m3_m4.homework_submissions (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    homework_id uuid not null references m3_m4.homework(id) on delete cascade,
    student_id uuid not null references m3_m4.students(id) on delete cascade,
    submission_text text,
    file_path text,
    submitted_at timestamp with time zone default timezone('utc'::text, now()) not null,
    graded_by uuid references public.profiles(id) on delete set null,
    marks_obtained numeric(5,2),
    feedback text,
    unique (homework_id, student_id)
);
