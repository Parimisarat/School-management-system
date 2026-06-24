-- Supabase Database Schema for Multi-School Management System
-- Module M9 Foundation Setup

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================================
-- 1. BASE TABLES
-- ============================================================================

-- Table: schools
create table public.schools (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    address text,
    phone text,
    email text unique,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: profiles
-- Note: References auth.users from Supabase auth
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    school_id uuid not null references public.schools(id) on delete cascade,
    first_name text not null,
    last_name text not null,
    phone text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: user_roles
create table public.user_roles (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    profile_id uuid not null references public.profiles(id) on delete cascade,
    role text not null check (role in ('super_admin', 'admin_staff', 'class_teacher', 'subject_teacher', 'parent', 'student')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (school_id, profile_id, role)
);

-- ============================================================================
-- 2. ACADEMIC STRUCTURE & STUDENTS
-- ============================================================================

-- Table: classes
create table public.classes (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    name text not null,
    code text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (school_id, name)
);

-- Table: sections
create table public.sections (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    class_id uuid not null references public.classes(id) on delete cascade,
    name text not null,
    room_number text,
    class_teacher_id uuid references public.profiles(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (school_id, class_id, name)
);

-- Table: students
create table public.students (
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
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (school_id, admission_number)
);

-- ============================================================================
-- 3. ENQUIRIES & ADMISSIONS
-- ============================================================================

-- Table: enquiries
create table public.enquiries (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    student_name text not null,
    parent_name text not null,
    phone text not null,
    email text,
    grade_interested uuid references public.classes(id) on delete set null,
    source text,
    status text not null default 'New' check (status in ('New', 'Contacted', 'Qualified', 'Admission Done', 'Closed')),
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: admissions
create table public.admissions (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    enquiry_id uuid references public.enquiries(id) on delete set null,
    first_name text not null,
    last_name text not null,
    date_of_birth date not null,
    gender text check (gender in ('Male', 'Female', 'Other')),
    grade_applied uuid not null references public.classes(id) on delete restrict,
    parent_name text not null,
    parent_phone text not null,
    parent_email text,
    status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected', 'Enrolled')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: documents
create table public.documents (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    student_id uuid references public.students(id) on delete cascade,
    admission_id uuid references public.admissions(id) on delete cascade,
    document_name text not null,
    document_type text not null,
    file_path text not null, -- Path to storage bucket
    uploaded_by uuid not null references public.profiles(id) on delete restrict,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================================================
-- 4. ACADEMICS & GRADES
-- ============================================================================

-- Table: homework
create table public.homework (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    class_id uuid not null references public.classes(id) on delete cascade,
    section_id uuid not null references public.sections(id) on delete cascade,
    subject text not null,
    title text not null,
    description text,
    due_date timestamp with time zone not null,
    created_by uuid not null references public.profiles(id) on delete restrict,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: homework_submissions
create table public.homework_submissions (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    homework_id uuid not null references public.homework(id) on delete cascade,
    student_id uuid not null references public.students(id) on delete cascade,
    submission_text text,
    file_path text,
    submitted_at timestamp with time zone default timezone('utc'::text, now()) not null,
    graded_by uuid references public.profiles(id) on delete set null,
    marks_obtained numeric(5,2),
    feedback text,
    unique (homework_id, student_id)
);

-- Table: attendance
create table public.attendance (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    student_id uuid not null references public.students(id) on delete cascade,
    date date not null,
    status text not null check (status in ('Present', 'Absent', 'Late', 'Half Day')),
    remarks text,
    marked_by uuid not null references public.profiles(id) on delete restrict,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (student_id, date)
);

-- ============================================================================
-- 5. PARENT-TEACHER MEETINGS (PTM)
-- ============================================================================

-- Table: ptm_events
create table public.ptm_events (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    title text not null,
    date date not null,
    description text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: ptm_slots
create table public.ptm_slots (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    event_id uuid not null references public.ptm_events(id) on delete cascade,
    teacher_id uuid not null references public.profiles(id) on delete cascade,
    start_time time not null,
    end_time time not null,
    is_available boolean not null default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (event_id, teacher_id, start_time)
);

-- Table: ptm_bookings
create table public.ptm_bookings (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    slot_id uuid not null unique references public.ptm_slots(id) on delete cascade,
    student_id uuid not null references public.students(id) on delete cascade,
    parent_id uuid not null references public.profiles(id) on delete cascade,
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================================================
-- 6. CO-CURRICULAR & BEHAVIOR
-- ============================================================================

-- Table: activities
create table public.activities (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    name text not null,
    description text,
    coordinator_id uuid references public.profiles(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: activity_enrollments
create table public.activity_enrollments (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    activity_id uuid not null references public.activities(id) on delete cascade,
    student_id uuid not null references public.students(id) on delete cascade,
    enrolled_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (activity_id, student_id)
);

-- Table: achievements
create table public.achievements (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    student_id uuid not null references public.students(id) on delete cascade,
    title text not null,
    description text,
    category text not null, -- Academics, Sports, Arts, etc.
    date_achieved date not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: discipline_incidents
create table public.discipline_incidents (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    student_id uuid not null references public.students(id) on delete cascade,
    incident_date date not null,
    title text not null,
    description text not null,
    action_taken text,
    reported_by uuid not null references public.profiles(id) on delete restrict,
    status text not null default 'Reported' check (status in ('Reported', 'Under Investigation', 'Resolved')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================================================
-- 7. MESSAGES & ANNOUNCEMENTS
-- ============================================================================

-- Table: messages
create table public.messages (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    sender_id uuid not null references public.profiles(id) on delete cascade,
    receiver_id uuid not null references public.profiles(id) on delete cascade,
    message_text text not null,
    is_read boolean not null default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: notices
create table public.notices (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    title text not null,
    content text not null,
    created_by uuid not null references public.profiles(id) on delete restrict,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: notice_targets
create table public.notice_targets (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    notice_id uuid not null references public.notices(id) on delete cascade,
    target_role text not null check (target_role in ('super_admin', 'admin_staff', 'class_teacher', 'subject_teacher', 'parent', 'student')),
    class_id uuid references public.classes(id) on delete cascade, -- Optional scoping to a specific class
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (notice_id, target_role, class_id)
);


-- ============================================================================
-- 8. INDEXES FOR PERFORMANCE & DRILL DOWN
-- ============================================================================

-- Base lookup indexes
create index idx_profiles_school_id on public.profiles(school_id);
create index idx_user_roles_school_profile on public.user_roles(school_id, profile_id);

-- Operational lookup indexes
create index idx_students_school_class_section on public.students(school_id, class_id, section_id);
create index idx_students_parent_id on public.students(parent_id);
create index idx_students_profile_id on public.students(profile_id);
create index idx_sections_class_id on public.sections(class_id);

-- Enquiry/Admission lookup indexes
create index idx_enquiries_school_status on public.enquiries(school_id, status);
create index idx_admissions_school_status on public.admissions(school_id, status);
create index idx_documents_student_id on public.documents(student_id);
create index idx_documents_admission_id on public.documents(admission_id);

-- Academics lookup indexes
create index idx_homework_school_class_section on public.homework(school_id, class_id, section_id);
create index idx_homework_submissions_homework_student on public.homework_submissions(homework_id, student_id);
create index idx_attendance_student_date on public.attendance(student_id, date);

-- PTM lookup indexes
create index idx_ptm_slots_event_teacher on public.ptm_slots(event_id, teacher_id);
create index idx_ptm_bookings_slot_student on public.ptm_bookings(slot_id, student_id);

-- Co-curricular & behavior
create index idx_activity_enrollments_student on public.activity_enrollments(student_id);
create index idx_achievements_student on public.achievements(student_id);
create index idx_discipline_incidents_student on public.discipline_incidents(student_id);

-- Messaging
create index idx_messages_sender_receiver on public.messages(sender_id, receiver_id);
create index idx_notice_targets_role_class on public.notice_targets(target_role, class_id);


-- ============================================================================
-- 9. ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS
-- ============================================================================

-- Function to get the user's school ID (cached in transaction context if possible)
create or replace function public.get_user_school_id()
returns uuid as $$
declare
    v_school_id uuid;
begin
    -- Retrieve school_id directly from the profiles table for the authenticated user
    select school_id into v_school_id
    from public.profiles
    where id = auth.uid();
    
    return v_school_id;
end;
$$ language plpgsql security definer stable;

-- Function to check if the user is a Super Admin in their school
create or replace function public.is_super_admin()
returns boolean as $$
begin
    return exists (
        select 1 from public.user_roles
        where profile_id = auth.uid()
          and role = 'super_admin'
    );
end;
$$ language plpgsql security definer stable;

-- Function to check if the user is Admin Staff
create or replace function public.is_admin_staff()
returns boolean as $$
begin
    return exists (
        select 1 from public.user_roles
        where profile_id = auth.uid()
          and role in ('super_admin', 'admin_staff')
    );
end;
$$ language plpgsql security definer stable;

-- Function to check if user has access to a specific student as a parent
create or replace function public.is_parent_of_student(p_student_id uuid)
returns boolean as $$
begin
    return exists (
        select 1 from public.students
        where id = p_student_id
          and parent_id = auth.uid()
    );
end;
$$ language plpgsql security definer stable;

-- Function to check if a user is a teacher assigned to the student's class/section
create or replace function public.is_teacher_of_student(p_student_id uuid)
returns boolean as $$
begin
    return exists (
        select 1 from public.students s
        join public.sections sec on s.section_id = sec.id
        where s.id = p_student_id
          and (
              sec.class_teacher_id = auth.uid()
              or exists (
                  -- Also matches subject teachers that created homework for this section
                  select 1 from public.homework h
                  where h.section_id = s.section_id
                    and h.created_by = auth.uid()
              )
          )
    );
end;
$$ language plpgsql security definer stable;


-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES ON ALL TABLES
-- ============================================================================

-- Enable RLS on all tables
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.classes enable row level security;
alter table public.sections enable row level security;
alter table public.students enable row level security;
alter table public.enquiries enable row level security;
alter table public.admissions enable row level security;
alter table public.documents enable row level security;
alter table public.homework enable row level security;
alter table public.homework_submissions enable row level security;
alter table public.attendance enable row level security;
alter table public.ptm_events enable row level security;
alter table public.ptm_slots enable row level security;
alter table public.ptm_bookings enable row level security;
alter table public.activities enable row level security;
alter table public.activity_enrollments enable row level security;
alter table public.achievements enable row level security;
alter table public.discipline_incidents enable row level security;
alter table public.messages enable row level security;
alter table public.notices enable row level security;
alter table public.notice_targets enable row level security;


-- ----------------------------------------------------------------------------
-- Policies for: schools
-- ----------------------------------------------------------------------------
create policy "Allow read access to matching school"
    on public.schools for select
    using (id = public.get_user_school_id());

create policy "Super admin can update school details"
    on public.schools for update
    using (id = public.get_user_school_id() and public.is_super_admin());


-- ----------------------------------------------------------------------------
-- Policies for: profiles
-- ----------------------------------------------------------------------------
create policy "Read profiles in same school"
    on public.profiles for select
    using (school_id = public.get_user_school_id());

create policy "Users can update their own profile"
    on public.profiles for update
    using (id = auth.uid())
    with check (id = auth.uid() and school_id = public.get_user_school_id());

create policy "Admin staff can insert or delete profiles"
    on public.profiles for all
    using (school_id = public.get_user_school_id() and public.is_admin_staff());


-- ----------------------------------------------------------------------------
-- Policies for: user_roles
-- ----------------------------------------------------------------------------
create policy "Read roles in same school"
    on public.user_roles for select
    using (school_id = public.get_user_school_id());

create policy "Admin staff can manage roles"
    on public.user_roles for all
    using (school_id = public.get_user_school_id() and public.is_admin_staff());


-- ----------------------------------------------------------------------------
-- Policies for: classes
-- ----------------------------------------------------------------------------
create policy "Read classes in same school"
    on public.classes for select
    using (school_id = public.get_user_school_id());

create policy "Admin staff can manage classes"
    on public.classes for all
    using (school_id = public.get_user_school_id() and public.is_admin_staff());


-- ----------------------------------------------------------------------------
-- Policies for: sections
-- ----------------------------------------------------------------------------
create policy "Read sections in same school"
    on public.sections for select
    using (school_id = public.get_user_school_id());

create policy "Admin staff can manage sections"
    on public.sections for all
    using (school_id = public.get_user_school_id() and public.is_admin_staff());


-- ----------------------------------------------------------------------------
-- Policies for: students
-- ----------------------------------------------------------------------------
create policy "Super admin and admin staff can access all students in school"
    on public.students for all
    using (school_id = public.get_user_school_id() and public.is_admin_staff());

create policy "Teachers can read all students in school"
    on public.students for select
    using (
        school_id = public.get_user_school_id()
        and exists (
            select 1 from public.user_roles
            where profile_id = auth.uid()
              and role in ('class_teacher', 'subject_teacher')
        )
    );

create policy "Parents can read their own children"
    on public.students for select
    using (school_id = public.get_user_school_id() and parent_id = auth.uid());

create policy "Students can read their own record"
    on public.students for select
    using (school_id = public.get_user_school_id() and profile_id = auth.uid());


-- ----------------------------------------------------------------------------
-- Policies for: enquiries
-- ----------------------------------------------------------------------------
create policy "Admin staff can manage enquiries"
    on public.enquiries for all
    using (school_id = public.get_user_school_id() and public.is_admin_staff());

create policy "Anonymous/public can create enquiries"
    on public.enquiries for insert
    with check (true); -- Allow enrollment lead forms to submit publicly


-- ----------------------------------------------------------------------------
-- Policies for: admissions
-- ----------------------------------------------------------------------------
create policy "Admin staff can manage admissions"
    on public.admissions for all
    using (school_id = public.get_user_school_id() and public.is_admin_staff());


-- ----------------------------------------------------------------------------
-- Policies for: documents
-- ----------------------------------------------------------------------------
create policy "Admin staff can manage documents"
    on public.documents for all
    using (school_id = public.get_user_school_id() and public.is_admin_staff());

create policy "Parents can read their child's documents"
    on public.documents for select
    using (
        school_id = public.get_user_school_id()
        and student_id is not null
        and public.is_parent_of_student(student_id)
    );

create policy "Students can read their own documents"
    on public.documents for select
    using (
        school_id = public.get_user_school_id()
        and student_id is not null
        and exists (
            select 1 from public.students s
            where s.id = student_id and s.profile_id = auth.uid()
        )
    );


-- ----------------------------------------------------------------------------
-- Policies for: homework
-- ----------------------------------------------------------------------------
create policy "Read homework in same school"
    on public.homework for select
    using (school_id = public.get_user_school_id());

create policy "Teachers and admin staff can manage homework"
    on public.homework for all
    using (
        school_id = public.get_user_school_id()
        and (
            public.is_admin_staff()
            or exists (
                select 1 from public.user_roles
                where profile_id = auth.uid()
                  and role in ('class_teacher', 'subject_teacher')
            )
        )
    );


-- ----------------------------------------------------------------------------
-- Policies for: homework_submissions
-- ----------------------------------------------------------------------------
create policy "Staff can read all submissions"
    on public.homework_submissions for select
    using (school_id = public.get_user_school_id() and (public.is_admin_staff() or exists (
        select 1 from public.user_roles
        where profile_id = auth.uid()
          and role in ('class_teacher', 'subject_teacher')
    )));

create policy "Teachers can grade submissions"
    on public.homework_submissions for update
    using (school_id = public.get_user_school_id() and exists (
        select 1 from public.user_roles
        where profile_id = auth.uid()
          and role in ('class_teacher', 'subject_teacher')
    ));

create policy "Students can manage their own submissions"
    on public.homework_submissions for all
    using (
        school_id = public.get_user_school_id()
        and exists (
            select 1 from public.students s
            where s.id = student_id and s.profile_id = auth.uid()
        )
    );

create policy "Parents can read their child's submissions"
    on public.homework_submissions for select
    using (
        school_id = public.get_user_school_id()
        and public.is_parent_of_student(student_id)
    );


-- ----------------------------------------------------------------------------
-- Policies for: attendance
-- ----------------------------------------------------------------------------
create policy "Staff and teachers can manage attendance"
    on public.attendance for all
    using (
        school_id = public.get_user_school_id()
        and (
            public.is_admin_staff()
            or exists (
                select 1 from public.user_roles
                where profile_id = auth.uid()
                  and role in ('class_teacher', 'subject_teacher')
            )
        )
    );

create policy "Parents can view child's attendance"
    on public.attendance for select
    using (
        school_id = public.get_user_school_id()
        and public.is_parent_of_student(student_id)
    );

create policy "Students can view their own attendance"
    on public.attendance for select
    using (
        school_id = public.get_user_school_id()
        and exists (
            select 1 from public.students s
            where s.id = student_id and s.profile_id = auth.uid()
        )
    );


-- ----------------------------------------------------------------------------
-- Policies for: ptm_events
-- ----------------------------------------------------------------------------
create policy "Read PTM events"
    on public.ptm_events for select
    using (school_id = public.get_user_school_id());

create policy "Admin staff can manage PTM events"
    on public.ptm_events for all
    using (school_id = public.get_user_school_id() and public.is_admin_staff());


-- ----------------------------------------------------------------------------
-- Policies for: ptm_slots
-- ----------------------------------------------------------------------------
create policy "Read PTM slots"
    on public.ptm_slots for select
    using (school_id = public.get_user_school_id());

create policy "Teachers and admin staff can manage slots"
    on public.ptm_slots for all
    using (
        school_id = public.get_user_school_id()
        and (
            public.is_admin_staff()
            or teacher_id = auth.uid()
        )
    );


-- ----------------------------------------------------------------------------
-- Policies for: ptm_bookings
-- ----------------------------------------------------------------------------
create policy "Read PTM bookings"
    on public.ptm_bookings for select
    using (
        school_id = public.get_user_school_id()
        and (
            public.is_admin_staff()
            or parent_id = auth.uid()
            or exists (
                select 1 from public.ptm_slots s
                where s.id = slot_id and s.teacher_id = auth.uid()
            )
        )
    );

create policy "Parents can manage bookings"
    on public.ptm_bookings for all
    using (
        school_id = public.get_user_school_id()
        and parent_id = auth.uid()
        and public.is_parent_of_student(student_id)
    );

create policy "Admin staff can manage all bookings"
    on public.ptm_bookings for all
    using (school_id = public.get_user_school_id() and public.is_admin_staff());


-- ----------------------------------------------------------------------------
-- Policies for: activities
-- ----------------------------------------------------------------------------
create policy "Read activities"
    on public.activities for select
    using (school_id = public.get_user_school_id());

create policy "Admin staff can manage activities"
    on public.activities for all
    using (school_id = public.get_user_school_id() and public.is_admin_staff());


-- ----------------------------------------------------------------------------
-- Policies for: activity_enrollments
-- ----------------------------------------------------------------------------
create policy "Read activity enrollments"
    on public.activity_enrollments for select
    using (school_id = public.get_user_school_id());

create policy "Admin staff can manage activity enrollments"
    on public.activity_enrollments for all
    using (school_id = public.get_user_school_id() and public.is_admin_staff());

create policy "Parents can manage child's enrollment"
    on public.activity_enrollments for all
    using (
        school_id = public.get_user_school_id()
        and public.is_parent_of_student(student_id)
    );

create policy "Students can enroll themselves"
    on public.activity_enrollments for all
    using (
        school_id = public.get_user_school_id()
        and exists (
            select 1 from public.students s
            where s.id = student_id and s.profile_id = auth.uid()
        )
    );


-- ----------------------------------------------------------------------------
-- Policies for: achievements
-- ----------------------------------------------------------------------------
create policy "Read achievements"
    on public.achievements for select
    using (school_id = public.get_user_school_id());

create policy "Staff and teachers can manage achievements"
    on public.achievements for all
    using (
        school_id = public.get_user_school_id()
        and (
            public.is_admin_staff()
            or exists (
                select 1 from public.user_roles
                where profile_id = auth.uid()
                  and role in ('class_teacher', 'subject_teacher')
            )
        )
    );


-- ----------------------------------------------------------------------------
-- Policies for: discipline_incidents
-- ----------------------------------------------------------------------------
create policy "Staff and teachers can read/write discipline records"
    on public.discipline_incidents for all
    using (
        school_id = public.get_user_school_id()
        and (
            public.is_admin_staff()
            or exists (
                select 1 from public.user_roles
                where profile_id = auth.uid()
                  and role in ('class_teacher', 'subject_teacher')
            )
        )
    );

create policy "Parents can view their child's discipline records"
    on public.discipline_incidents for select
    using (
        school_id = public.get_user_school_id()
        and public.is_parent_of_student(student_id)
    );


-- ----------------------------------------------------------------------------
-- Policies for: messages
-- ----------------------------------------------------------------------------
create policy "Users can read their own received or sent messages"
    on public.messages for select
    using (
        school_id = public.get_user_school_id()
        and (sender_id = auth.uid() or receiver_id = auth.uid())
    );

create policy "Users can send messages"
    on public.messages for insert
    with check (
        school_id = public.get_user_school_id()
        and sender_id = auth.uid()
    );


-- ----------------------------------------------------------------------------
-- Policies for: notices
-- ----------------------------------------------------------------------------
create policy "Read notices in same school"
    on public.notices for select
    using (school_id = public.get_user_school_id());

create policy "Staff can manage notices"
    on public.notices for all
    using (
        school_id = public.get_user_school_id()
        and (
            public.is_admin_staff()
            or exists (
                select 1 from public.user_roles
                where profile_id = auth.uid()
                  and role = 'class_teacher'
            )
        )
    );


-- ----------------------------------------------------------------------------
-- Policies for: notice_targets
-- ----------------------------------------------------------------------------
create policy "Read notice targets in same school"
    on public.notice_targets for select
    using (school_id = public.get_user_school_id());

create policy "Staff can manage notice targets"
    on public.notice_targets for all
    using (
        school_id = public.get_user_school_id()
        and (
            public.is_admin_staff()
            or exists (
                select 1 from public.user_roles
                where profile_id = auth.uid()
                  and role = 'class_teacher'
            )
        )
    );
