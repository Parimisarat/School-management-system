-- Migration: Module 8 - Communication
-- Drops and Recreates communication tables (message_threads, messages, notices) in public schema

-- 1. Drop existing tables if they exist
drop table if exists public.notice_targets cascade;
drop table if exists public.notices cascade;
drop table if exists public.messages cascade;
drop table if exists public.message_threads cascade;

-- 2. Create message_threads table
create table public.message_threads (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    student_id uuid not null references m3_m4.students(id) on delete cascade,
    parent_id uuid not null references public.profiles(id) on delete cascade,
    teacher_id uuid not null references public.profiles(id) on delete cascade,
    status text not null default 'Active' check (status in ('Active', 'Resolved')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (student_id, parent_id, teacher_id)
);

-- 3. Create messages table
create table public.messages (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    thread_id uuid not null references public.message_threads(id) on delete cascade,
    sender_id uuid not null references public.profiles(id) on delete cascade,
    message_text text not null check (char_length(message_text) <= 1000),
    is_read boolean not null default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Create notices table
create table public.notices (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    title text not null,
    content text not null,
    created_by uuid not null references public.profiles(id) on delete restrict,
    target_audience text not null check (target_audience in ('All', 'Class', 'Section')),
    class_id uuid references public.classes(id) on delete cascade,
    section_id uuid references public.sections(id) on delete cascade,
    is_urgent boolean not null default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Create performance indexes
create index idx_message_threads_student on public.message_threads(student_id);
create index idx_message_threads_parent on public.message_threads(parent_id);
create index idx_message_threads_teacher on public.message_threads(teacher_id);
create index idx_messages_thread on public.messages(thread_id);
create index idx_notices_school on public.notices(school_id);
create index idx_notices_class on public.notices(class_id);
create index idx_notices_section on public.notices(section_id);

-- 6. Enable Row Level Security (RLS)
alter table public.message_threads enable row level security;
alter table public.messages enable row level security;
alter table public.notices enable row level security;

-- 7. Policies for message_threads
create policy "Allow users to view their own message threads"
    on public.message_threads for select
    using (
        school_id = public.get_user_school_id()
        and (
            parent_id = auth.uid()
            or teacher_id = auth.uid()
            or public.is_admin_staff()
        )
    );

create policy "Allow parents and teachers to create threads"
    on public.message_threads for insert
    with check (
        school_id = public.get_user_school_id()
        and (
            parent_id = auth.uid()
            or teacher_id = auth.uid()
        )
    );

create policy "Allow teachers to resolve threads"
    on public.message_threads for update
    using (
        school_id = public.get_user_school_id()
        and teacher_id = auth.uid()
    );

-- 8. Policies for messages
create policy "Allow users to view messages in their threads"
    on public.messages for select
    using (
        exists (
            select 1 from public.message_threads mt
            where mt.id = thread_id
              and (mt.parent_id = auth.uid() or mt.teacher_id = auth.uid() or public.is_admin_staff())
        )
    );

create policy "Allow thread participants to send messages"
    on public.messages for insert
    with check (
        sender_id = auth.uid()
        and exists (
            select 1 from public.message_threads mt
            where mt.id = thread_id
              and mt.status = 'Active'
              and (mt.parent_id = auth.uid() or mt.teacher_id = auth.uid())
        )
    );

-- 9. Policies for notices
create policy "Allow all authenticated users to read notices"
    on public.notices for select
    using (
        school_id = public.get_user_school_id()
        and (
            target_audience = 'All'
            or public.is_admin_staff()
            or (
                -- Parents see notices targeting their student's class/section
                exists (
                    select 1 from m3_m4.students s
                    where s.parent_id = auth.uid()
                      and (
                          (target_audience = 'Class' and s.class_id = class_id)
                          or (target_audience = 'Section' and s.section_id = section_id)
                      )
                )
            )
            or (
                -- Students see notices targeting their own class/section
                exists (
                    select 1 from m3_m4.students s
                    where s.profile_id = auth.uid()
                      and (
                          (target_audience = 'Class' and s.class_id = class_id)
                          or (target_audience = 'Section' and s.section_id = section_id)
                      )
                )
            )
            or (
                -- Teachers see notices targeting their section/class
                exists (
                    select 1 from public.sections sec
                    where sec.class_teacher_id = auth.uid()
                      and (
                          (target_audience = 'Class' and sec.class_id = class_id)
                          or (target_audience = 'Section' and sec.id = section_id)
                      )
                )
            )
        )
    );

create policy "Admins can manage all notices"
    on public.notices for all
    using (school_id = public.get_user_school_id() and public.is_admin_staff());

create policy "Teachers can insert class-level notices for their class"
    on public.notices for insert
    with check (
        school_id = public.get_user_school_id()
        and created_by = auth.uid()
        and target_audience = 'Class'
        and exists (
            select 1 from public.sections sec
            where sec.class_teacher_id = auth.uid()
              and sec.class_id = class_id
        )
    );

create policy "Teachers can delete/update their own notices"
    on public.notices for all
    using (
        school_id = public.get_user_school_id()
        and created_by = auth.uid()
    );
