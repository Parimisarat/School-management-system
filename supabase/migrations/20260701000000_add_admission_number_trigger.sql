-- Migration to add database trigger for generating sequential admission numbers automatically
-- Assumes public.admission_seq sequence already exists from the previous migration

create or replace function public.generate_admission_number()
returns trigger as $$
declare
    v_year text;
    v_seq_val bigint;
begin
    v_year := to_char(now(), 'YYYY');
    v_seq_val := nextval('public.admission_seq');
    new.admission_number := 'ADM-' || v_year || '-' || lpad(v_seq_val::text, 5, '0');
    return new;
end;
$$ language plpgsql;

create or replace trigger tr_generate_admission_number
    before insert on public.admissions
    for each row
    when (new.admission_number is null or new.admission_number = '')
    execute function public.generate_admission_number();

-- Backfill any existing records that do not have an admission number
update public.admissions
set admission_number = 'ADM-' || to_char(created_at, 'YYYY') || '-' || lpad(nextval('public.admission_seq')::text, 5, '0')
where admission_number is null or admission_number = '';
