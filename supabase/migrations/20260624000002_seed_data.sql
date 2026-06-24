-- Seeds a default school and academic classes for the form selector
insert into public.schools (id, name, address, phone, email)
values 
  ('11111111-1111-1111-1111-111111111111', 'Oakridge International School', '123 Academic Lane', '555-0199', 'contact@oakridge.edu')
on conflict (email) do nothing;

insert into public.classes (id, school_id, name, code)
values
  ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Grade 1', 'G1'),
  ('c2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Grade 2', 'G2'),
  ('c3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Grade 3', 'G3')
on conflict (school_id, name) do nothing;
