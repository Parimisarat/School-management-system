-- Migration: Module 7 - Discipline Monitor
-- Recreates discipline_incidents and adds discipline_categories

-- Drop existing table if it exists
drop table if exists public.discipline_incidents cascade;

-- Create discipline_categories table
create table public.discipline_categories (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    name text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (school_id, name)
);

-- Recreate discipline_incidents table
create table public.discipline_incidents (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null references public.schools(id) on delete cascade,
    student_id uuid not null references public.students(id) on delete cascade,
    incident_date date not null,
    category_id uuid not null references public.discipline_categories(id) on delete restrict,
    severity text not null check (severity in ('Minor', 'Moderate', 'Serious')),
    description text not null,
    notes text, -- teacher remarks / internal notes
    reported_by uuid not null references public.profiles(id) on delete restrict,
    status text not null default 'Logged' check (status in ('Logged', 'Reviewed', 'Escalated', 'Closed')),
    class_teacher_remarks text,
    resolution_note text, -- added when closed
    parent_acknowledged boolean not null default false,
    parent_acknowledged_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for student search and filter
create index idx_discipline_incidents_student on public.discipline_incidents(student_id);
create index idx_discipline_incidents_category on public.discipline_incidents(category_id);
create index idx_discipline_incidents_school on public.discipline_incidents(school_id);

-- Enable RLS on both tables
alter table public.discipline_categories enable row level security;
alter table public.discipline_incidents enable row level security;

-- Policies for discipline_categories
create policy "Read categories in same school"
    on public.discipline_categories for select
    using (school_id = public.get_user_school_id());

create policy "Admin staff can manage categories"
    on public.discipline_categories for all
    using (school_id = public.get_user_school_id() and public.is_admin_staff());

-- Policies for discipline_incidents

-- 1. Select Policies
create policy "Admins can view all incidents"
    on public.discipline_incidents for select
    using (school_id = public.get_user_school_id() and public.is_admin_staff());

create policy "Teachers can view incidents they reported or for their class students"
    on public.discipline_incidents for select
    using (school_id = public.get_user_school_id() and (
        reported_by = auth.uid()
        or exists (
            select 1 from public.user_roles
            where profile_id = auth.uid()
              and role = 'class_teacher'
              and exists (
                  select 1 from public.students s
                  join public.sections sec on s.section_id = sec.id
                  where s.id = student_id and sec.class_teacher_id = auth.uid()
              )
        )
    ));

create policy "Parents can view their child's incidents on the table"
    on public.discipline_incidents for select
    using (school_id = public.get_user_school_id() and public.is_parent_of_student(student_id));

-- 2. Insert Policies
create policy "Teachers and admins can insert incidents"
    on public.discipline_incidents for insert
    with check (
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

-- 3. Update Policies
create policy "Admins can update all incidents"
    on public.discipline_incidents for update
    using (school_id = public.get_user_school_id() and public.is_admin_staff());

create policy "Teachers can update incidents they reported or their class students' status"
    on public.discipline_incidents for update
    using (
        school_id = public.get_user_school_id() 
        and (
            reported_by = auth.uid()
            or (
                exists (
                    select 1 from public.user_roles
                    where profile_id = auth.uid()
                      and role = 'class_teacher'
                )
                and exists (
                    select 1 from public.students s
                    join public.sections sec on s.section_id = sec.id
                    where s.id = student_id and sec.class_teacher_id = auth.uid()
                )
            )
        )
    );

create policy "Parents can update acknowledgement fields"
    on public.discipline_incidents for update
    using (school_id = public.get_user_school_id() and public.is_parent_of_student(student_id));

-- View for parent access (excludes sensitive columns)
create or replace view public.parent_discipline_incidents as
select
    di.id,
    di.school_id,
    di.student_id,
    di.incident_date,
    dc.name as category_name,
    di.severity,
    di.description,
    di.parent_acknowledged,
    di.parent_acknowledged_at,
    di.created_at
from public.discipline_incidents di
join public.discipline_categories dc on di.category_id = dc.id
where di.student_id in (
    select s.id from public.students s where s.parent_id = auth.uid()
);

-- Trigger to create default categories for new schools
create or replace function public.trg_create_default_discipline_categories()
returns trigger as $$
begin
    insert into public.discipline_categories (school_id, name)
    values
        (new.id, 'Late to class'),
        (new.id, 'Uniform violation'),
        (new.id, 'Disruptive behaviour'),
        (new.id, 'Absenteeism'),
        (new.id, 'Physical altercation'),
        (new.id, 'Disrespect to staff'),
        (new.id, 'Cheating'),
        (new.id, 'Mobile phone violation'),
        (new.id, 'Other')
    on conflict (school_id, name) do nothing;
    return new;
end;
$$ language plpgsql security definer;

create or replace trigger trg_schools_create_default_categories
after insert on public.schools
for each row
execute function public.trg_create_default_discipline_categories();

-- Seed default categories for existing schools
insert into public.discipline_categories (school_id, name)
select s.id, cat.name
from public.schools s
cross join (
    values 
        ('Late to class'),
        ('Uniform violation'),
        ('Disruptive behaviour'),
        ('Absenteeism'),
        ('Physical altercation'),
        ('Disrespect to staff'),
        ('Cheating'),
        ('Mobile phone violation'),
        ('Other')
) as cat(name)
on conflict (school_id, name) do nothing;

-- Trigger to enforce 24-hour edit limit and parent update restrictions
create or replace function public.trg_discipline_incidents_tamper_proof()
returns trigger as $$
declare
    v_user_role text;
begin
    -- Get the user's role
    select role into v_user_role
    from public.user_roles
    where profile_id = auth.uid()
    limit 1;

    if (TG_OP = 'UPDATE') then
        -- 1. Enforce parent restriction (only allow acknowledging)
        if (v_user_role = 'parent') then
            if (old.school_id != new.school_id or
                old.student_id != new.student_id or
                old.incident_date != new.incident_date or
                old.category_id != new.category_id or
                old.severity != new.severity or
                old.description != new.description or
                old.notes != new.notes or
                old.reported_by != new.reported_by or
                old.status != new.status or
                old.resolution_note != new.resolution_note or
                old.class_teacher_remarks != new.class_teacher_remarks) then
                raise exception 'Parents can only acknowledge incidents.';
            end if;
            -- Ensure they can only set parent_acknowledged to true and set the timestamp
            if (new.parent_acknowledged = false and old.parent_acknowledged = true) then
                raise exception 'Cannot un-acknowledge an incident.';
            end if;
        end if;

        -- 2. Enforce 24-hour edit limit for teachers (on core fields)
        if (v_user_role in ('class_teacher', 'subject_teacher')) then
            -- If changing core fields after 24 hours, raise error
            if (old.created_at < now() - interval '24 hours') then
                if (old.student_id != new.student_id or
                    old.incident_date != new.incident_date or
                    old.category_id != new.category_id or
                    old.severity != new.severity or
                    old.description != new.description or
                    old.notes != new.notes or
                    old.reported_by != new.reported_by) then
                    raise exception 'Incident details cannot be edited after 24 hours.';
                end if;
            end if;
            
            -- Also ensure subject teachers cannot modify class_teacher_remarks or status of other teachers' incidents
            if (v_user_role = 'subject_teacher') then
                if (old.status != new.status or
                    old.class_teacher_remarks != new.class_teacher_remarks or
                    old.resolution_note != new.resolution_note) then
                    raise exception 'Subject teachers cannot modify status or remarks.';
                end if;
            end if;
        end if;
    end if;
    return new;
end;
$$ language plpgsql security definer;

create or replace trigger trg_discipline_incidents_tamper_proof_val
before update on public.discipline_incidents
for each row
execute function public.trg_discipline_incidents_tamper_proof();

-- Repeat offense flag function
create or replace function public.get_student_repeat_flags(p_student_id uuid)
returns table (category_id uuid, category_name text, incident_count bigint) as $$
declare
    v_term_start date;
    v_term_end date;
    v_today date := current_date;
    v_month int;
begin
    -- Determine term dates
    v_month := extract(month from v_today);
    if v_month >= 6 and v_month <= 9 then
        v_term_start := make_date(extract(year from v_today)::int, 6, 1);
        v_term_end := make_date(extract(year from v_today)::int, 9, 30);
    elsif v_month >= 10 or v_month = 1 then
        if v_month = 1 then
            v_term_start := make_date((extract(year from v_today)::int - 1), 10, 1);
            v_term_end := make_date(extract(year from v_today)::int, 1, 31);
        else
            v_term_start := make_date(extract(year from v_today)::int, 10, 1);
            v_term_end := make_date((extract(year from v_today)::int + 1), 1, 31);
        end if;
    else
        v_term_start := make_date(extract(year from v_today)::int, 2, 1);
        v_term_end := make_date(extract(year from v_today)::int, 5, 31);
    end if;

    return query
    select 
        di.category_id,
        dc.name as category_name,
        count(*) as incident_count
    from public.discipline_incidents di
    join public.discipline_categories dc on di.category_id = dc.id
    where di.student_id = p_student_id
      and di.incident_date >= v_term_start
      and di.incident_date <= v_term_end
    group by di.category_id, dc.name
    having count(*) >= 3;
end;
$$ language plpgsql security definer stable;
