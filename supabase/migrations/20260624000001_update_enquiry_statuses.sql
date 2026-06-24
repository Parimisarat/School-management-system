-- DB Migration update for Module M1 - Enquiry Management
-- Updates enquiries status values and adds an auto-generated enquiry_number

-- 1. Drop existing status check constraint from enquiries
alter table public.enquiries drop constraint if exists enquiries_status_check;

-- 2. Add new status check constraint corresponding to Module M1
alter table public.enquiries add constraint enquiries_status_check check (
    status in ('New', 'Contacted', 'Visit Scheduled', 'Converted', 'Not Interested')
);

-- 3. Add enquiry_number column to enquiries table if it doesn't exist
alter table public.enquiries add column if not exists enquiry_number text;

-- 4. Create sequence and trigger to generate sequential ENQ numbers automatically per school
create sequence if not exists public.enquiry_seq;

create or replace function public.generate_enquiry_number()
returns trigger as $$
declare
    v_year text;
    v_seq_val bigint;
begin
    v_year := to_char(now(), 'YYYY');
    v_seq_val := nextval('public.enquiry_seq');
    new.enquiry_number := 'ENQ-' || v_year || '-' || lpad(v_seq_val::text, 5, '0');
    return new;
end;
$$ language plpgsql;

create or replace trigger tr_generate_enquiry_number
    before insert on public.enquiries
    for each row
    when (new.enquiry_number is null)
    execute function public.generate_enquiry_number();
