-- Migration file to add fields for Module M2 - Admission & Document Management

-- 1. Add new columns to public.admissions table
alter table public.admissions add column if not exists admission_number text;
alter table public.admissions add column if not exists blood_group text;
alter table public.admissions add column if not exists nationality text;
alter table public.admissions add column if not exists religion text;
alter table public.admissions add column if not exists mother_tongue text;
alter table public.admissions add column if not exists aadhaar_number text;

-- Parent Details
alter table public.admissions add column if not exists father_name text;
alter table public.admissions add column if not exists mother_name text;
alter table public.admissions add column if not exists occupation text;
alter table public.admissions add column if not exists alternate_phone text;

-- Address Information
alter table public.admissions add column if not exists current_address text;
alter table public.admissions add column if not exists permanent_address text;

-- Academic Information
alter table public.admissions add column if not exists previous_school text;
alter table public.admissions add column if not exists previous_class text;
alter table public.admissions add column if not exists percentage_grade text;

-- Emergency Contacts
alter table public.admissions add column if not exists emergency_contact_name text;
alter table public.admissions add column if not exists emergency_contact_relationship text;
alter table public.admissions add column if not exists emergency_contact_phone text;

-- JSON logs for notes and timeline
alter table public.admissions add column if not exists review_notes jsonb default '[]'::jsonb;
alter table public.admissions add column if not exists activity_log jsonb default '[]'::jsonb;

-- 2. Modify status constraint on admissions table
alter table public.admissions drop constraint if exists admissions_status_check;
alter table public.admissions add constraint admissions_status_check check (
    status in ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Pending', 'Enrolled')
);

-- 3. Add status column to public.documents table
alter table public.documents add column if not exists status text default 'Pending' check (status in ('Pending', 'Uploaded', 'Verified'));

-- 4. Create sequence and trigger to generate sequential ADM numbers automatically
create sequence if not exists public.admission_seq;

-- 5. Create storage bucket for document uploads
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

-- 6. Setup storage security policies for the documents bucket
create policy "Allow public read access to documents bucket"
    on storage.objects for select
    using (bucket_id = 'documents');

create policy "Allow authenticated manage access to documents bucket"
    on storage.objects for all
    using (bucket_id = 'documents' and auth.role() = 'authenticated');
